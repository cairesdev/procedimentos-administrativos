import { Conflito, ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste, garantirSemVinculos } from "../shared/ExclusaoSegura";
import type {
  DadosFinalizacao, DadosRetirada, EdicaoMotorista, EdicaoVeiculo, EncerramentoManutencao,
  FrotaRepository, NovaManutencao, NovaViagem, NovoMotorista, NovoVeiculo, StatusViagem,
  ViagemResumo,
} from "../ports/FrotaRepository";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";

// Transições que o ciclo aceita. Qualquer outra é 422 com a lista do que dá.
const TRANSICOES: Record<StatusViagem, StatusViagem[]> = {
  SOLICITADA: ["APROVADA", "RECUSADA", "REMARCADA", "CANCELADA"],
  REMARCADA: ["APROVADA", "RECUSADA", "CANCELADA"],
  APROVADA: ["RETIRADA", "CANCELADA"],
  RETIRADA: ["FINALIZADA"],
  FINALIZADA: [],
  RECUSADA: [],
  CANCELADA: [],
};

export class GerenciarFrota {
  constructor(
    private readonly frota: FrotaRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  // ---- Veículos -----------------------------------------------------------

  criarVeiculo = async (dados: NovoVeiculo): Promise<{ id: string }> => {
    if (await this.frota.existePlaca(dados.orgaoId, dados.placa)) {
      throw new Conflito(`Já existe veículo com a placa ${dados.placa.toUpperCase()}`);
    }
    return { id: await this.frota.criarVeiculo(dados) };
  };

  atualizarVeiculo = async (
    orgaoId: string,
    id: string,
    dados: EdicaoVeiculo,
  ): Promise<void> => {
    garantirExiste(await this.frota.buscarVeiculo(orgaoId, id), "Veículo");
    await this.frota.atualizarVeiculo(orgaoId, id, dados);
  };

  removerVeiculo = async (orgaoId: string, id: string): Promise<void> => {
    const veiculo = garantirExiste(await this.frota.buscarVeiculo(orgaoId, id), "Veículo");
    garantirSemVinculos({ viagens: veiculo.viagens }, "Veículo");
    await this.frota.removerVeiculo(orgaoId, id);
  };

  // ---- Motoristas ---------------------------------------------------------

  criarMotorista = async (dados: NovoMotorista): Promise<{ id: string }> => ({
    id: await this.frota.criarMotorista(dados),
  });

  atualizarMotorista = async (
    orgaoId: string,
    id: string,
    dados: EdicaoMotorista,
  ): Promise<void> => {
    garantirExiste(await this.frota.buscarMotorista(orgaoId, id), "Motorista");
    await this.frota.atualizarMotorista(orgaoId, id, dados);
  };

  removerMotorista = async (orgaoId: string, id: string): Promise<void> => {
    const motorista = garantirExiste(await this.frota.buscarMotorista(orgaoId, id), "Motorista");
    garantirSemVinculos({ viagens: motorista.viagens }, "Motorista");
    await this.frota.removerMotorista(orgaoId, id);
  };

  // ---- Viagens ------------------------------------------------------------

  /**
   * Solicitar não bloqueia por conflito de agenda: a decisão do projeto é que
   * o gestor decide. Os conflitos voltam na resposta, para a tela avisar.
   */
  solicitarViagem = async (
    dados: NovaViagem,
  ): Promise<{ id: string; conflitos: ViagemResumo[] }> => {
    const veiculo = garantirExiste(
      await this.frota.buscarVeiculo(dados.orgaoId, dados.veiculoId),
      "Veículo",
    );
    if (!veiculo.ativo) throw new ErroDeNegocio("Veículo inativo não pode ser solicitado");
    if (veiculo.emManutencao) {
      throw new ErroDeNegocio(`Veículo ${veiculo.placa} está em manutenção`);
    }

    const motorista = garantirExiste(
      await this.frota.buscarMotorista(dados.orgaoId, dados.motoristaId),
      "Motorista",
    );
    if (!motorista.ativo) throw new ErroDeNegocio("Motorista inativo não pode ser escalado");
    // CNH vencida barra; vencendo apenas alerta na listagem.
    if (motorista.diasParaVencerCnh < 0) {
      throw new ErroDeNegocio(`CNH de ${motorista.nome} está vencida`);
    }

    // Frota da secretaria: só a unidade dona pede, salvo compartilhamento ligado.
    if (
      veiculo.unidadeId &&
      veiculo.unidadeId !== dados.unidadeSolicitanteId &&
      !(await this.frota.compartilhaEntreSecretarias(dados.orgaoId))
    ) {
      throw new ErroDeNegocio(
        "Este veículo pertence a outra secretaria e o compartilhamento está desligado",
      );
    }

    const conflitos = await this.frota.conflitosDeAgenda(
      dados.orgaoId,
      dados.veiculoId,
      dados.dataHoraDesejada,
    );

    return { id: await this.frota.criarViagem(dados), conflitos };
  };

  private transicionar = async (
    orgaoId: string,
    id: string,
    destino: StatusViagem,
    dataHoraRemarcada?: string,
  ) => {
    const viagem = garantirExiste(await this.frota.buscarViagem(orgaoId, id), "Viagem");
    const permitidos = TRANSICOES[viagem.status];

    if (!permitidos.includes(destino)) {
      throw new ErroDeNegocio(
        permitidos.length === 0
          ? `Viagem ${viagem.status.toLowerCase()} não muda mais de situação`
          : `Viagem ${viagem.status.toLowerCase()} só pode ir para: ${permitidos.join(", ")}`,
        422,
        { statusAtual: viagem.status, permitidos },
      );
    }

    await this.frota.mudarStatusViagem(orgaoId, id, destino, dataHoraRemarcada);
    return viagem;
  };

  aprovarViagem = async (orgaoId: string, id: string, usuarioId?: string): Promise<void> => {
    const viagem = await this.transicionar(orgaoId, id, "APROVADA");
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "VIAGEM_APROVADA",
      referenciaId: id,
      detalhes: { veiculo: viagem.veiculoPlaca, motorista: viagem.motoristaNome },
    });
  };

  recusarViagem = async (
    orgaoId: string,
    id: string,
    motivo: string,
    usuarioId?: string,
  ): Promise<void> => {
    const viagem = await this.transicionar(orgaoId, id, "RECUSADA");
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "VIAGEM_RECUSADA",
      referenciaId: id,
      detalhes: { veiculo: viagem.veiculoPlaca, motivo },
    });
  };

  /** Remarcar é contraproposta do gestor: volta para a mesa do solicitante. */
  remarcarViagem = async (
    orgaoId: string,
    id: string,
    novaDataHora: string,
    usuarioId?: string,
  ): Promise<{ conflitos: ViagemResumo[] }> => {
    const viagem = await this.transicionar(orgaoId, id, "REMARCADA", novaDataHora);
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "VIAGEM_REMARCADA",
      referenciaId: id,
      detalhes: { de: viagem.dataHoraDesejada, para: novaDataHora },
    });

    return {
      conflitos: await this.frota.conflitosDeAgenda(orgaoId, viagem.veiculoId, novaDataHora, id),
    };
  };

  cancelarViagem = async (orgaoId: string, id: string, usuarioId?: string): Promise<void> => {
    await this.transicionar(orgaoId, id, "CANCELADA");
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "VIAGEM_CANCELADA",
      referenciaId: id,
    });
  };

  registrarRetirada = async (
    orgaoId: string,
    id: string,
    dados: DadosRetirada,
    usuarioId?: string,
  ): Promise<void> => {
    const viagem = garantirExiste(await this.frota.buscarViagem(orgaoId, id), "Viagem");
    if (viagem.status !== "APROVADA") {
      throw new ErroDeNegocio("Só viagem aprovada pode ser retirada", 422, {
        statusAtual: viagem.status,
      });
    }

    const veiculo = garantirExiste(
      await this.frota.buscarVeiculo(orgaoId, viagem.veiculoId),
      "Veículo",
    );
    // Hodômetro não anda para trás.
    if (dados.kmInicial < veiculo.quilometragemAtual) {
      throw new ErroDeNegocio(
        `Km inicial (${dados.kmInicial}) menor que o registrado no veículo (${veiculo.quilometragemAtual})`,
      );
    }

    garantirExiste(await this.frota.buscarMotorista(orgaoId, dados.motoristaId), "Motorista");

    await this.frota.registrarRetirada(id, dados);
    await this.frota.mudarStatusViagem(orgaoId, id, "RETIRADA");
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "VIAGEM_RETIRADA",
      referenciaId: id,
      detalhes: { veiculo: veiculo.placa, kmInicial: dados.kmInicial },
    });
  };

  finalizarViagem = async (
    orgaoId: string,
    id: string,
    dados: DadosFinalizacao,
    usuarioId?: string,
  ): Promise<void> => {
    const viagem = garantirExiste(await this.frota.buscarViagem(orgaoId, id), "Viagem");
    if (viagem.status !== "RETIRADA") {
      throw new ErroDeNegocio("Só viagem retirada pode ser finalizada", 422, {
        statusAtual: viagem.status,
      });
    }
    if (!viagem.retirada) throw new ErroDeNegocio("Viagem sem registro de retirada");

    if (dados.kmFinal < viagem.retirada.kmInicial) {
      throw new ErroDeNegocio(
        `Km final (${dados.kmFinal}) menor que o km da retirada (${viagem.retirada.kmInicial})`,
      );
    }

    await this.frota.registrarFinalizacao(orgaoId, id, viagem.veiculoId, dados);
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "VIAGEM_FINALIZADA",
      referenciaId: id,
      detalhes: {
        veiculo: viagem.veiculoPlaca,
        kmRodados: dados.kmFinal - viagem.retirada.kmInicial,
        sinistro: dados.sinistro ?? null,
      },
    });
  };

  // ---- Abastecimento ------------------------------------------------------

  /**
   * Abastecer só faz sentido com o veículo na rua ou logo após a devolução —
   * antes da retirada não há o que abastecer, e viagem recusada/cancelada nunca
   * saiu da garagem.
   */
  registrarAbastecimento = async (
    orgaoId: string,
    viagemId: string,
    dados: { data: string; litros?: number; valor?: number },
  ): Promise<{ id: string }> => {
    const viagem = garantirExiste(await this.frota.buscarViagem(orgaoId, viagemId), "Viagem");

    if (viagem.status !== "RETIRADA" && viagem.status !== "FINALIZADA") {
      throw new ErroDeNegocio(
        "Abastecimento só pode ser lançado em viagem retirada ou finalizada",
        422,
        { statusAtual: viagem.status },
      );
    }
    if (dados.litros === undefined && dados.valor === undefined) {
      throw new ErroDeNegocio("Informe ao menos os litros ou o valor do abastecimento");
    }

    return { id: await this.frota.registrarAbastecimento({ ...dados, viagemId }) };
  };

  removerAbastecimento = async (orgaoId: string, id: string): Promise<void> => {
    garantirExiste(await this.frota.buscarAbastecimento(orgaoId, id), "Abastecimento");
    await this.frota.removerAbastecimento(id);
  };

  // ---- Manutenção ---------------------------------------------------------

  abrirManutencao = async (
    orgaoId: string,
    dados: NovaManutencao,
    usuarioId?: string,
  ): Promise<{ id: string }> => {
    const veiculo = garantirExiste(
      await this.frota.buscarVeiculo(orgaoId, dados.veiculoId),
      "Veículo",
    );
    if (veiculo.emManutencao) {
      throw new ErroDeNegocio(`Veículo ${veiculo.placa} já tem manutenção em aberto`);
    }

    const id = await this.frota.abrirManutencao(dados);
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "MANUTENCAO_ABERTA",
      referenciaId: id,
      detalhes: { veiculo: veiculo.placa, tipo: dados.tipo },
    });
    return { id };
  };

  encerrarManutencao = async (
    orgaoId: string,
    id: string,
    dados: EncerramentoManutencao,
    usuarioId?: string,
  ): Promise<void> => {
    const manutencao = garantirExiste(
      await this.frota.buscarManutencao(orgaoId, id),
      "Manutenção",
    );
    if (manutencao.dataFim) throw new ErroDeNegocio("Manutenção já encerrada");
    if (dados.dataFim < manutencao.dataInicio) {
      throw new ErroDeNegocio("Data de encerramento anterior à de início");
    }

    await this.frota.encerrarManutencao(id, dados);
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "MANUTENCAO_ENCERRADA",
      referenciaId: id,
      detalhes: { veiculo: manutencao.veiculoPlaca, custo: dados.custo ?? manutencao.custo },
    });
  };

  removerManutencao = async (orgaoId: string, id: string): Promise<void> => {
    garantirExiste(await this.frota.buscarManutencao(orgaoId, id), "Manutenção");
    await this.frota.removerManutencao(id);
  };
}
