import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { arredondar } from "../../domain/almoxarifado/Fefo";
import type { AlmoxarifadoRepository } from "../ports/AlmoxarifadoRepository";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

/** Uma linha da planilha de entrada, no formato que o legado já usava. */
export type LinhaDePlanilha = {
  nome: string;
  unidade: string;
  quantidade: number;
  dataValidade?: string | null;
};

/**
 * Cadastros e entrada de estoque.
 *
 * A entrada é o momento em que o produto entra no catálogo global: a planilha
 * traz nome e unidade de medida, e o par vira produto novo ou reaproveita o que
 * já existe. É o que evita quarenta grafias de "arroz tipo 1" no produto
 * inteiro.
 */
export class GerenciarAlmoxarifado {
  constructor(
    private readonly almoxarifado: AlmoxarifadoRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  // ---- Cadastros -----------------------------------------------------------

  listarAlmoxarifados = (orgaoId: string) => this.almoxarifado.listarAlmoxarifados(orgaoId);

  criarAlmoxarifado = (orgaoId: string, nome: string) =>
    this.almoxarifado.criarAlmoxarifado(orgaoId, nome);

  atualizarAlmoxarifado = (orgaoId: string, id: string, dados: { nome: string; ativo: boolean }) =>
    this.almoxarifado.atualizarAlmoxarifado(orgaoId, id, dados);

  removerAlmoxarifado = async (orgaoId: string, id: string) => {
    const almoxarifados = await this.almoxarifado.listarAlmoxarifados(orgaoId);
    const alvo = almoxarifados.find((item) => item.id === id);
    if (!alvo) throw new NaoEncontrado("Almoxarifado não encontrado");

    // Excluir levaria remessa e histórico junto. Desativar tira das listas e
    // preserva o que já foi movimentado.
    if (alvo.remessas > 0 || alvo.locais > 0) {
      throw new ErroDeNegocio(
        `Este almoxarifado tem ${alvo.remessas} remessa(s) e ${alvo.locais} local(is) `
        + "vinculado(s). Desative-o em vez de excluir.",
        409,
      );
    }
    await this.almoxarifado.removerAlmoxarifado(orgaoId, id);
  };

  listarTipos = (orgaoId: string) => this.almoxarifado.listarTipos(orgaoId);

  criarTipo = (orgaoId: string, nome: string) => this.almoxarifado.criarTipo(orgaoId, nome);

  atualizarTipo = (orgaoId: string, id: string, dados: { nome: string; ativo: boolean }) =>
    this.almoxarifado.atualizarTipo(orgaoId, id, dados);

  removerTipo = async (orgaoId: string, id: string) => {
    const tipos = await this.almoxarifado.listarTipos(orgaoId);
    const alvo = tipos.find((item) => item.id === id);
    if (!alvo) throw new NaoEncontrado("Tipo de estoque não encontrado");

    if (alvo.remessas > 0) {
      throw new ErroDeNegocio(
        `Este tipo classifica ${alvo.remessas} remessa(s). Desative-o em vez de excluir — `
        + "apagar tiraria a classificação do histórico.",
        409,
      );
    }
    await this.almoxarifado.removerTipo(orgaoId, id);
  };

  listarProdutos = (busca?: string) => this.almoxarifado.listarProdutos(busca);

  listarLocais = (orgaoId: string, almoxarifadoId?: string) =>
    this.almoxarifado.listarLocais(orgaoId, almoxarifadoId);

  salvarDadosDoLocal: AlmoxarifadoRepository["salvarDadosDoLocal"] = (orgaoId, localId, dados) =>
    this.almoxarifado.salvarDadosDoLocal(orgaoId, localId, dados);

  buscarConfiguracao = (orgaoId: string) => this.almoxarifado.buscarConfiguracao(orgaoId);

  salvarConfiguracao: AlmoxarifadoRepository["salvarConfiguracao"] = (orgaoId, dados) =>
    this.almoxarifado.salvarConfiguracao(orgaoId, dados);

  // ---- Entrada -------------------------------------------------------------

  listarRemessas: AlmoxarifadoRepository["listarRemessas"] = (orgaoId, filtros) =>
    this.almoxarifado.listarRemessas(orgaoId, filtros);

  buscarRemessa = async (orgaoId: string, id: string) => {
    const remessa = await this.almoxarifado.buscarRemessa(orgaoId, id);
    if (!remessa) throw new NaoEncontrado("Remessa não encontrada");
    return remessa;
  };

  /**
   * Cria a remessa e seus lotes numa transação só.
   *
   * Remessa sem lote é entrada em branco que alguém vai ter de caçar depois;
   * lote sem remessa é estoque órfão. Os dois nascem juntos ou nenhum nasce.
   */
  registrarEntrada = async (dados: {
    orgaoId: string;
    usuarioId: string;
    almoxarifadoId: string;
    codigo: string;
    titulo: string;
    data: string;
    tipoEstoqueId: string;
    localArmazenado?: string;
    notaFiscal?: string;
    fornecedorId?: string;
    linhas: LinhaDePlanilha[];
  }): Promise<{ id: string; lotes: number }> => {
    if (dados.linhas.length === 0) {
      throw new ErroDeNegocio("A remessa precisa de ao menos um item");
    }

    const emUso = await this.almoxarifado.codigoDeRemessaEmUso(
      dados.orgaoId, dados.almoxarifadoId, dados.codigo,
    );
    if (emUso) {
      throw new Conflito(`Já existe remessa com o código ${dados.codigo} neste almoxarifado`);
    }

    for (const [indice, linha] of dados.linhas.entries()) {
      if (!linha.nome?.trim()) {
        throw new ErroDeNegocio(`Linha ${indice + 1}: o nome do produto está vazio`, 422);
      }
      if (!linha.unidade?.trim()) {
        throw new ErroDeNegocio(
          `Linha ${indice + 1} ("${linha.nome}"): falta a unidade de medida`, 422,
        );
      }
      if (!Number.isFinite(linha.quantidade) || linha.quantidade <= 0) {
        throw new ErroDeNegocio(
          `Linha ${indice + 1} ("${linha.nome}"): quantidade precisa ser maior que zero`, 422,
        );
      }
    }

    return this.transacao(async (tx) => {
      const id = await this.almoxarifado.criarRemessa(dados.orgaoId, {
        almoxarifadoId: dados.almoxarifadoId,
        codigo: dados.codigo,
        titulo: dados.titulo,
        data: dados.data,
        localArmazenado: dados.localArmazenado,
        tipoEstoqueId: dados.tipoEstoqueId,
        responsavelUsuarioId: dados.usuarioId,
        notaFiscal: dados.notaFiscal,
        fornecedorId: dados.fornecedorId,
      }, tx);

      for (const linha of dados.linhas) {
        // O produto entra no catálogo global aqui, se ainda não existir.
        const produtoId = await this.almoxarifado.garantirProduto(
          linha.nome.trim().toUpperCase(),
          linha.unidade.trim().toUpperCase(),
          tx,
        );
        await this.almoxarifado.adicionarLote(dados.orgaoId, {
          remessaId: id,
          produtoId,
          quantidade: arredondar(linha.quantidade),
          dataValidade: linha.dataValidade || null,
        }, tx);
      }

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "ENTRADA_ESTOQUE_REGISTRADA",
        referenciaId: id,
        detalhes: {
          codigo: dados.codigo,
          titulo: dados.titulo,
          lotes: dados.linhas.length,
          notaFiscal: dados.notaFiscal ?? null,
        },
      }, tx);

      return { id, lotes: dados.linhas.length };
    });
  };

  removerLote = async (dados: { orgaoId: string; usuarioId: string; loteId: string }) => {
    const temMovimento = await this.almoxarifado.loteTemMovimento(dados.orgaoId, dados.loteId);
    if (temMovimento) {
      throw new ErroDeNegocio(
        "Este lote já saiu para alguma unidade. Apagá-lo tiraria o rastro de quem recebeu — "
        + "use o ajuste de estoque para corrigir a quantidade.",
        409,
      );
    }

    await this.almoxarifado.removerLote(dados.orgaoId, dados.loteId);
    await this.auditoria.registrar({
      orgaoId: dados.orgaoId,
      usuarioId: dados.usuarioId,
      tipoEvento: "LOTE_ESTOQUE_EXCLUIDO",
      referenciaId: dados.loteId,
      detalhes: {},
    });
  };

  // ---- Consulta ------------------------------------------------------------

  listarDisponiveis: AlmoxarifadoRepository["listarDisponiveis"] = (
    orgaoId, almoxarifadoId, tipoEstoqueId,
  ) => this.almoxarifado.listarDisponiveis(orgaoId, almoxarifadoId, tipoEstoqueId);

  listarSolicitacoes: AlmoxarifadoRepository["listarSolicitacoes"] = (orgaoId, filtros) =>
    this.almoxarifado.listarSolicitacoes(orgaoId, filtros);

  buscarSolicitacao = async (orgaoId: string, id: string) => {
    const solicitacao = await this.almoxarifado.buscarSolicitacao(orgaoId, id);
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");
    return solicitacao;
  };

  listarEstoqueDoLocal: AlmoxarifadoRepository["listarEstoqueDoLocal"] = (orgaoId, localId) =>
    this.almoxarifado.listarEstoqueDoLocal(orgaoId, localId);
}
