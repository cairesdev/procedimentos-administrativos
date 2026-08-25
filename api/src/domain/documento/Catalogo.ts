/**
 * De onde cada documento fala — e, por consequência, quais marcadores tem.
 *
 * O escopo existe para o administrador poder criar peça nova sem código: ele
 * escolhe de onde o documento fala, e o catálogo de marcadores e a busca dos
 * dados vêm daí. O `tipo` voltou a ser só a identidade da peça.
 */

export const ESCOPOS = [
  "PROCESSO",
  "PROCESSO_CONTRATO",
  "ORDEM_FORNECIMENTO",
  "SOLICITACAO",
] as const;

export type EscopoDeDocumento = (typeof ESCOPOS)[number];

export const ROTULO_DO_ESCOPO: Record<EscopoDeDocumento, string> = {
  PROCESSO: "Processo em tramitação",
  PROCESSO_CONTRATO: "Processo com contrato e fornecedor",
  ORDEM_FORNECIMENTO: "Ordem de fornecimento, com itens",
  SOLICITACAO: "Solicitação de itens",
};

/** O que a tela de emissão passa como referência em cada escopo. */
export const REFERENCIA_DO_ESCOPO: Record<EscopoDeDocumento, string> = {
  PROCESSO: "processo",
  PROCESSO_CONTRATO: "processo",
  ORDEM_FORNECIMENTO: "ordem de fornecimento",
  SOLICITACAO: "solicitação",
};

export type CatalogoDeMarcadores = {
  valores: string[];
  listas: Record<string, string[]>;
};

/** Presentes em toda peça, de qualquer escopo. */
const COMUNS = [
  "orgao.nome", "orgao.cnpj", "orgao.municipio", "orgao.uf", "orgao.endereco",
  "data.porExtenso", "data.curta", "data.hora",
  "autor.nome", "autor.cargo",
  "documento.codigo", "documento.titulo",
];

const PROCESSO = [
  "processo.numeroProtocolo", "processo.numeroProcessoAdm", "processo.tipo",
  "processo.status", "processo.dataAbertura", "processo.setorAtual",
  "processo.unidadeSolicitante",
];

/** Último despacho e parecer do processo — servem a qualquer peça de trâmite. */
const TRAMITE = [
  "despacho.texto", "despacho.setorDestino",
  "parecer.favoravel", "parecer.justificativa",
];

const CONTRATO = [
  "contrato.numero", "contrato.objeto", "contrato.dataInicio", "contrato.dataFim",
  "contrato.valorTotal", "contrato.valorTotalPorExtenso", "contrato.fiscal",
  "contrato.origem", "contrato.origemNumero",
];

const FORNECEDOR = [
  "fornecedor.razaoSocial", "fornecedor.documento", "fornecedor.endereco",
  "fornecedor.email", "fornecedor.telefone",
  "fornecedor.inscricaoEstadual", "fornecedor.inscricaoMunicipal",
];

const ORDEM = [
  "ordem.numero", "ordem.numeroEmpenho", "ordem.numeroRequisicao",
  "ordem.projetoAtividade", "ordem.elementoDespesa", "ordem.fonteRecurso",
  "ordem.numeroParcelas", "ordem.numeroNotaFiscal",
  "ordem.valor", "ordem.valorPorExtenso",
];

const ITENS = [
  "produto", "descricao", "unidadeMedida", "marca",
  "quantidade", "valorUnitario", "valorTotal",
];

export const CATALOGO_POR_ESCOPO: Record<EscopoDeDocumento, CatalogoDeMarcadores> = {
  PROCESSO: {
    valores: [...COMUNS, ...PROCESSO, ...TRAMITE],
    listas: {},
  },
  PROCESSO_CONTRATO: {
    valores: [...COMUNS, ...PROCESSO, ...TRAMITE, ...CONTRATO, ...FORNECEDOR],
    listas: {},
  },
  ORDEM_FORNECIMENTO: {
    valores: [...COMUNS, ...PROCESSO, ...CONTRATO, ...FORNECEDOR, ...ORDEM],
    listas: { itens: ITENS },
  },
  SOLICITACAO: {
    valores: [
      ...COMUNS, ...PROCESSO,
      "solicitacao.situacao", "solicitacao.criadaEm",
      "solicitacao.valorTotal", "solicitacao.valorTotalPorExtenso",
    ],
    listas: { itens: ITENS },
  },
};

export const ehEscopo = (valor: string): valor is EscopoDeDocumento =>
  (ESCOPOS as readonly string[]).includes(valor);

/**
 * Identificador do tipo a partir do nome que o administrador digitou.
 * "Termo de recebimento" vira TERMO_DE_RECEBIMENTO — precisa caber no CHECK
 * da tabela e na URL da tela de edição.
 */
export const tipoAPartirDoNome = (nome: string): string =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
