import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { AtendimentoSaudeRepository } from "../ports/AtendimentoSaudeRepository";
import type { PacienteRepository } from "../ports/PacienteRepository";
import type { GuardaDaFicha } from "./GuardaDaFicha";

export type ItemInformado = {
  medicamento: string;
  dose: string;
  via: string;
  frequencia: string;
  observacao?: string | null;
};

/**
 * As duas colunas pareadas da segunda folha, e o quadro de exames da primeira.
 *
 * No papel o médico escreve a prescrição à esquerda e o técnico de enfermagem
 * carimba o horário de cada administração à direita. São dois atos, de duas
 * categorias diferentes, e por isso são dois métodos com permissões
 * diferentes — não um formulário que qualquer um preenche inteiro.
 */
export class PrescricaoEExames {
  constructor(
    private readonly atendimentos: AtendimentoSaudeRepository,
    private readonly pacientes: PacienteRepository,
    private readonly guarda: GuardaDaFicha,
    private readonly auditoria: AuditoriaRepository,
    private readonly emTransacao: ExecutorDeTransacao,
  ) {}

  solicitarExame = async (
    orgaoId: string, atendimentoId: string, usuarioId: string, descricao: string,
  ): Promise<{ id: string }> => {
    await this.guarda.autorizar(orgaoId, atendimentoId, usuarioId, "SOLICITAR_EXAME");
    if (!descricao.trim()) throw new ErroDeNegocio("Diga qual exame foi solicitado");

    const id = await this.atendimentos.solicitarExame(
      atendimentoId, descricao.trim(), usuarioId,
    );
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "EXAME_SOLICITADO", referenciaId: atendimentoId,
    });
    return { id };
  };

  /**
   * O resultado chega depois — às vezes dias depois, às vezes já com o
   * paciente de alta. É o único registro do módulo que pode entrar em
   * atendimento encerrado, e é por isso que `exame` não tem gatilho de
   * imutabilidade: uma segunda escrita nele é o comportamento esperado.
   */
  informarResultado = async (
    orgaoId: string, atendimentoId: string, exameId: string,
    usuarioId: string, resultado: string,
  ): Promise<void> => {
    await this.guarda.autorizar(orgaoId, atendimentoId, usuarioId, "RESULTADO_DE_EXAME");
    if (!resultado.trim()) throw new ErroDeNegocio("Escreva o resultado do exame");

    const gravou = await this.atendimentos.informarResultado(
      atendimentoId, exameId, resultado.trim(), usuarioId,
    );
    if (!gravou) {
      throw new NaoEncontrado("Exame não encontrado neste atendimento");
    }
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "RESULTADO_DE_EXAME_INFORMADO",
      referenciaId: atendimentoId, detalhes: { exameId },
    });
  };

  prescrever = async (
    orgaoId: string, atendimentoId: string, usuarioId: string,
    dados: { orientacoes?: string | null; itens: ItemInformado[] },
  ): Promise<{ id: string; alertas: string[] }> => {
    const { atendimento } = await this.guarda.autorizar(
      orgaoId, atendimentoId, usuarioId, "PRESCREVER",
    );

    if (dados.itens.length === 0 && !dados.orientacoes?.trim()) {
      throw new ErroDeNegocio(
        "Uma prescrição vazia não prescreve nada — informe ao menos um "
        + "medicamento ou uma orientação.",
      );
    }

    const alertas = await this.alertasDeAlergia(orgaoId, atendimento.pacienteId, dados.itens);

    const id = await this.emTransacao((tx) => this.atendimentos.criarPrescricao(
      atendimentoId,
      { orientacoes: dados.orientacoes?.trim() || null, itens: dados.itens },
      usuarioId,
      tx,
    ));

    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "PRESCRICAO_REGISTRADA",
      referenciaId: atendimentoId, detalhes: { itens: dados.itens.length },
    });

    return { id, alertas };
  };

  /**
   * O alerta de alergia **não bloqueia**, e isso é decisão, não descuido.
   *
   * A comparação aqui é textual: o nome do medicamento contra o que está
   * escrito na alergia do paciente. Ela pega "dipirona" contra "alergia a
   * dipirona" e não pega interação farmacológica nenhuma — para isso seria
   * preciso uma base de princípios ativos, que este sistema não tem e não vai
   * fingir ter.
   *
   * Bloquear com uma checagem tão grosseira seria pior que não checar: o
   * médico aprenderia a contornar, e a contornar também no dia em que o alerta
   * estivesse certo. O aviso vai para a tela, e quem decide é quem prescreve.
   */
  private alertasDeAlergia = async (
    orgaoId: string, pacienteId: string | null, itens: ItemInformado[],
  ): Promise<string[]> => {
    if (!pacienteId || itens.length === 0) return [];

    const paciente = await this.pacientes.porId(orgaoId, pacienteId);
    const alergias = (paciente?.condicoes ?? [])
      .filter((condicao) => condicao.tipo === "ALERGIA" && condicao.descricao)
      .map((condicao) => condicao.descricao!.toLowerCase());
    if (alergias.length === 0) return [];

    const alertas: string[] = [];
    for (const item of itens) {
      const medicamento = item.medicamento.toLowerCase().trim();
      if (!medicamento) continue;
      for (const alergia of alergias) {
        if (alergia.includes(medicamento) || medicamento.includes(alergia)) {
          alertas.push(
            `${item.medicamento}: o paciente tem alergia registrada — "${alergia}".`,
          );
          break;
        }
      }
    }
    return alertas;
  };

  /**
   * A coluna da direita: o horário em que a medicação foi de fato dada.
   *
   * O horário vem de quem administrou, não do servidor. A enfermagem registra
   * depois de atender o paciente — às vezes uma hora depois —, e `now()`
   * transformaria "dei às 22h" em "registrei às 23h40". O que interessa ao
   * prontuário é a primeira.
   */
  administrar = async (
    orgaoId: string, itemId: string, usuarioId: string,
    dados: { horario: Date; observacao?: string | null },
  ): Promise<{ id: string }> => {
    // O item alcança a prefeitura por join até o atendimento. Sem esta
    // consulta, um id de item de outra prefeitura viraria administração.
    const alcance = await this.atendimentos.itemAlcancavel(orgaoId, itemId);
    if (!alcance) throw new NaoEncontrado("Item de prescrição não encontrado");

    await this.guarda.autorizar(orgaoId, alcance.atendimentoId, usuarioId, "ADMINISTRAR");

    if (dados.horario.getTime() > Date.now() + 60_000) {
      throw new ErroDeNegocio(
        "O horário da administração está no futuro — registre o remédio depois "
        + "de dá-lo, não antes.",
      );
    }

    const id = await this.atendimentos.registrarAdministracao(itemId, dados, usuarioId);
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "MEDICACAO_ADMINISTRADA",
      referenciaId: alcance.atendimentoId, detalhes: { itemId },
    });
    return { id };
  };
}
