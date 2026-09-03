import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { arredondar } from "../../domain/almoxarifado/Fefo";
import { normalizarLinhaDeLocal, type LinhaCrua } from "../../domain/almoxarifado/LinhaDeLocal";
import type {
  AlcanceDeConsulta, AlmoxarifadoRepository,
} from "../ports/AlmoxarifadoRepository";
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

  listarLocais = (
    orgaoId: string, alcance: AlcanceDeConsulta,
    almoxarifadoId?: string, incluirInativos?: boolean,
  ) => this.almoxarifado.listarLocais(orgaoId, alcance, almoxarifadoId, incluirInativos);

  salvarDadosDoLocal: AlmoxarifadoRepository["salvarDadosDoLocal"] = (orgaoId, localId, dados) =>
    this.almoxarifado.salvarDadosDoLocal(orgaoId, localId, dados);

  /**
   * Cadastra a escola sem depender do módulo de patrimônio.
   *
   * Os dois módulos são vendidos separados, e criar local vivia só no
   * patrimônio: quem comprasse apenas o almoxarifado não tinha como cadastrar
   * uma escola — e sem escola o módulo inteiro não sai do lugar.
   */
  criarLocal = async (orgaoId: string, dados: {
    nome: string; codigo: string; almoxarifadoId: string | null;
  }): Promise<string> => {
    await this.exigirCodigoLivre(orgaoId, dados.codigo);
    return this.almoxarifado.criarLocal(orgaoId, dados);
  };

  renomearLocal = async (orgaoId: string, localId: string, dados: {
    nome: string; codigo: string;
  }): Promise<void> => {
    await this.exigirCodigoLivre(orgaoId, dados.codigo, localId);
    await this.almoxarifado.renomearLocal(orgaoId, localId, dados);
  };

  definirSituacaoDoLocal = (orgaoId: string, localId: string, ativo: boolean) =>
    this.almoxarifado.definirSituacaoDoLocal(orgaoId, localId, ativo);

  /**
   * O cadastro de escolas do sistema antigo, colado de uma vez.
   *
   * Trocar de sistema com sessenta escolas para redigitar é onde a implantação
   * empaca: ninguém digita sessenta CNPJs sem errar, e o CNPJ do local é
   * exigido na prestação de contas do PNAE.
   *
   * **Importa o que é novo e relata o resto.** Nada existente é tocado: quem
   * roda a planilha duas vezes — e vai rodar, porque a primeira sempre tem uma
   * linha para corrigir — não duplica nem sobrescreve o que já foi ajustado à
   * mão aqui dentro.
   *
   * Sem transação em volta, de propósito. Uma linha ruim não pode desfazer as
   * cinquenta boas: a operação é feita para ser repetida, e o relatório diz o
   * que falta. Envolver tudo numa transação transformaria "pular e relatar" em
   * "tudo ou nada", que é a outra decisão.
   */
  importarLocais = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    almoxarifadoId: string | null;
    linhas: LinhaCrua[];
  }): Promise<{
    importados: { codigo: string; nome: string; avisos: string[] }[];
    ignorados: { linha: number; motivo: string }[];
  }> => {
    if (entrada.linhas.length === 0) {
      throw new ErroDeNegocio("Cole a planilha das escolas antes de importar");
    }

    if (entrada.almoxarifadoId) {
      /**
       * Almoxarifado de outra prefeitura penduraria a escola no vizinho — o
       * `criarLocal` grava o `orgao_id` da sessão e não confere o destino.
       * A listagem já filtra por órgão, então achar aqui é o bastante.
       */
      const almoxarifados = await this.almoxarifado.listarAlmoxarifados(entrada.orgaoId);
      if (!almoxarifados.some((item) => item.id === entrada.almoxarifadoId)) {
        throw new NaoEncontrado("Almoxarifado não encontrado");
      }
    }

    const importados: { codigo: string; nome: string; avisos: string[] }[] = [];
    const ignorados: { linha: number; motivo: string }[] = [];

    for (const [indice, crua] of entrada.linhas.entries()) {
      const linha = indice + 1;
      const conferida = normalizarLinhaDeLocal(crua);

      if (!conferida.aproveitavel) {
        ignorados.push({ linha, motivo: conferida.motivo });
        continue;
      }

      const { local } = conferida;

      /**
       * A conferência é por código, um a um — e não uma consulta só no começo.
       * Duas linhas da mesma planilha com o código repetido são o caso comum
       * (a escola aparece duas vezes na exportação), e a segunda precisa
       * encontrar a primeira já gravada.
       */
      if (await this.almoxarifado.codigoDeLocalEmUso(entrada.orgaoId, local.codigo)) {
        ignorados.push({
          linha,
          motivo: `já existe um local com o código ${local.codigo}`,
        });
        continue;
      }

      const id = await this.almoxarifado.criarLocal(entrada.orgaoId, {
        nome: local.nome,
        codigo: local.codigo,
        almoxarifadoId: entrada.almoxarifadoId,
      });

      await this.almoxarifado.salvarDadosDoLocal(entrada.orgaoId, id, {
        almoxarifadoId: entrada.almoxarifadoId,
        cnpj: local.cnpj,
        endereco: local.endereco,
        bairro: local.bairro,
        municipio: local.municipio,
        uf: local.uf,
        cep: local.cep,
        telefone: local.telefone,
        email: local.email,
        responsavel: local.responsavel,
      });

      importados.push({ codigo: local.codigo, nome: local.nome, avisos: conferida.avisos });
    }

    /**
     * Um evento para o lote, e não um por escola: o que a auditoria precisa
     * responder é "quem trouxe o cadastro, quando, e quanto entrou".
     */
    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "LOCAIS_IMPORTADOS",
      detalhes: {
        linhas: entrada.linhas.length,
        importados: importados.length,
        ignorados: ignorados.length,
        almoxarifadoId: entrada.almoxarifadoId,
      },
    });

    return { importados, ignorados };
  };

  /**
   * O código identifica a escola nos papéis, e o banco já o exige único por
   * prefeitura. Conferir antes troca o erro de constraint — que chega à tela
   * como falha genérica — por uma frase que diz o que fazer.
   */
  private exigirCodigoLivre = async (orgaoId: string, codigo: string, exceto?: string) => {
    if (await this.almoxarifado.codigoDeLocalEmUso(orgaoId, codigo, exceto)) {
      throw new ErroDeNegocio(`Já existe um local com o código ${codigo}`);
    }
  };

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

  listarSolicitacoes: AlmoxarifadoRepository["listarSolicitacoes"] = (
    orgaoId, filtros, alcance,
  ) => this.almoxarifado.listarSolicitacoes(orgaoId, filtros, alcance);

  /**
   * Fora do alcance dá "não encontrada", e não "sem permissão".
   *
   * A escola vizinha não precisa saber que o pedido existe. Distinguir os dois
   * erros contaria, a quem chutasse um id, que ali há alguma coisa.
   */
  buscarSolicitacao = async (orgaoId: string, id: string, alcance: AlcanceDeConsulta) => {
    const solicitacao = await this.almoxarifado.buscarSolicitacao(orgaoId, id, alcance);
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");
    return solicitacao;
  };

  listarEstoqueDoLocal: AlmoxarifadoRepository["listarEstoqueDoLocal"] = (
    orgaoId, localId, alcance,
  ) => this.almoxarifado.listarEstoqueDoLocal(orgaoId, localId, alcance);
}
