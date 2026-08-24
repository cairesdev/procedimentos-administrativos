/**
 * O que cada tipo de documento oferece ao modelo.
 *
 * É contrato com quem edita o modelo: a tela lista estes marcadores, e salvar
 * um modelo que use outro é recusado na hora — em vez de estourar meses
 * depois, na frente de quem precisa imprimir.
 */

export const TIPOS_DE_DOCUMENTO = [
  "TERMO_AUTORIZACAO",
  "DESPACHO",
  "DESPACHO_FISCAL",
  "RELATORIO_CONTROLADORIA",
  "PARECER",
  "ORDEM_FORNECIMENTO",
  "COMPROVANTE_SOLICITACAO",
] as const;

export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number];

export type CatalogoDeMarcadores = {
  valores: string[];
  listas: Record<string, string[]>;
};

/** Presentes em toda peça, de qualquer módulo. */
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

const ITENS_DA_ORDEM = [
  "produto", "descricao", "unidadeMedida", "marca",
  "quantidade", "valorUnitario", "valorTotal",
];

/**
 * Catálogo por tipo. Peça de tramitação vê o processo; peça de execução vê
 * também o contrato, o fornecedor e os itens.
 */
export const CATALOGO_POR_TIPO: Record<TipoDeDocumento, CatalogoDeMarcadores> = {
  TERMO_AUTORIZACAO: { valores: [...COMUNS, ...PROCESSO], listas: {} },
  DESPACHO: {
    valores: [...COMUNS, ...PROCESSO, "despacho.texto", "despacho.setorDestino"],
    listas: {},
  },
  DESPACHO_FISCAL: {
    valores: [...COMUNS, ...PROCESSO, ...CONTRATO, ...FORNECEDOR],
    listas: {},
  },
  RELATORIO_CONTROLADORIA: {
    valores: [...COMUNS, ...PROCESSO, ...CONTRATO, ...FORNECEDOR, "parecer.favoravel", "parecer.justificativa"],
    listas: {},
  },
  PARECER: {
    valores: [...COMUNS, ...PROCESSO, "parecer.favoravel", "parecer.justificativa"],
    listas: {},
  },
  ORDEM_FORNECIMENTO: {
    valores: [...COMUNS, ...PROCESSO, ...CONTRATO, ...FORNECEDOR, ...ORDEM],
    listas: { itens: ITENS_DA_ORDEM },
  },
  COMPROVANTE_SOLICITACAO: {
    valores: [
      ...COMUNS, ...PROCESSO,
      "solicitacao.situacao", "solicitacao.criadaEm",
      "solicitacao.valorTotal", "solicitacao.valorTotalPorExtenso",
    ],
    listas: { itens: ITENS_DA_ORDEM },
  },
};

/** Módulo dono de cada tipo — a 1ª fatia só tem Processos. */
export const MODULO_DO_TIPO: Record<TipoDeDocumento, string> = {
  TERMO_AUTORIZACAO: "PROCESSOS",
  DESPACHO: "PROCESSOS",
  DESPACHO_FISCAL: "PROCESSOS",
  RELATORIO_CONTROLADORIA: "PROCESSOS",
  PARECER: "PROCESSOS",
  ORDEM_FORNECIMENTO: "PROCESSOS",
  COMPROVANTE_SOLICITACAO: "PROCESSOS",
};
