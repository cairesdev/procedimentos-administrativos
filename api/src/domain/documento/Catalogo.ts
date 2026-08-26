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
  "BEM",
  "TRANSFERENCIA_BEM",
  "BAIXA_BEM",
  "INVENTARIO",
  "VIAGEM",
  "MANUTENCAO",
] as const;

export type EscopoDeDocumento = (typeof ESCOPOS)[number];

/** A qual módulo cada escopo pertence — o botão de emissão filtra por isto. */
export const MODULO_DO_ESCOPO: Record<EscopoDeDocumento, string> = {
  PROCESSO: "PROCESSOS",
  PROCESSO_CONTRATO: "PROCESSOS",
  ORDEM_FORNECIMENTO: "PROCESSOS",
  SOLICITACAO: "PROCESSOS",
  BEM: "PATRIMONIO",
  TRANSFERENCIA_BEM: "PATRIMONIO",
  BAIXA_BEM: "PATRIMONIO",
  INVENTARIO: "PATRIMONIO",
  VIAGEM: "FROTAS",
  MANUTENCAO: "FROTAS",
};

export const ROTULO_DO_ESCOPO: Record<EscopoDeDocumento, string> = {
  PROCESSO: "Processo em tramitação",
  PROCESSO_CONTRATO: "Processo com contrato e fornecedor",
  ORDEM_FORNECIMENTO: "Ordem de fornecimento, com itens",
  SOLICITACAO: "Solicitação de itens",
  BEM: "Bem patrimonial",
  TRANSFERENCIA_BEM: "Transferência de bem entre locais",
  BAIXA_BEM: "Baixa de bem",
  INVENTARIO: "Inventário de local, com os bens conferidos",
  VIAGEM: "Viagem, com os abastecimentos",
  MANUTENCAO: "Manutenção de veículo",
};

/** O que a tela de emissão passa como referência em cada escopo. */
export const REFERENCIA_DO_ESCOPO: Record<EscopoDeDocumento, string> = {
  PROCESSO: "processo",
  PROCESSO_CONTRATO: "processo",
  ORDEM_FORNECIMENTO: "ordem de fornecimento",
  SOLICITACAO: "solicitação",
  BEM: "bem",
  // A transferência tem id próprio: um bem transferido três vezes tem três
  // termos, e apontar para o bem não diria qual delas a peça documenta.
  TRANSFERENCIA_BEM: "transferência",
  // `baixa_bem` tem o bem como chave primária — uma baixa por bem.
  BAIXA_BEM: "bem",
  INVENTARIO: "inventário",
  VIAGEM: "viagem",
  MANUTENCAO: "manutenção",
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

/**
 * O bem identificado. Entra em toda peça de patrimônio: transferência, baixa e
 * termo de responsabilidade falam do mesmo objeto, mudando só o ato.
 */
const BEM = [
  "bem.tombamento", "bem.nome", "bem.categoria",
  "bem.estadoConservacao", "bem.status",
  "bem.localAtual", "bem.localTombamento",
  "bem.dataEntrada", "bem.notaFiscal", "bem.fornecedor",
];

const TRANSFERENCIA = [
  "transferencia.localOrigem", "transferencia.localDestino",
  "transferencia.status", "transferencia.dataEnvio", "transferencia.dataAceite",
  "transferencia.enviadoPor", "transferencia.aceitoPor",
];

const BAIXA = [
  "baixa.motivo", "baixa.observacao", "baixa.data", "baixa.responsavel",
];

const INVENTARIO = [
  "inventario.local", "inventario.status",
  "inventario.dataInicio", "inventario.dataConclusao",
  "inventario.totalBens", "inventario.encontrados", "inventario.naoEncontrados",
];

/** Uma linha da folha de conferência. */
const BENS_CONFERIDOS = [
  "tombamento", "nome", "categoria",
  "situacao", "estadoObservado", "observacao",
];

const VEICULO = [
  "veiculo.placa", "veiculo.modelo", "veiculo.ano", "veiculo.tipo",
  "veiculo.unidade", "veiculo.quilometragemAtual",
];

const VIAGEM = [
  "viagem.status", "viagem.motivo", "viagem.responsavel",
  "viagem.unidadeSolicitante", "viagem.dataHoraDesejada", "viagem.dataHoraRemarcada",
  "motorista.nome", "motorista.cnh", "motorista.categoriaCnh", "motorista.validadeCnh",
  // Retirada e finalização vêm com traço enquanto não aconteceram: a
  // autorização é impressa antes da viagem, e a peça não pode sair com lacuna.
  "retirada.dataHora", "retirada.kmInicial", "retirada.notaCombustivel",
  "finalizacao.dataHora", "finalizacao.kmFinal", "finalizacao.sinistro",
  "viagem.kmPercorrido", "viagem.totalLitros", "viagem.totalCombustivel",
];

const ABASTECIMENTOS = ["data", "litros", "valor"];

const MANUTENCAO = [
  "manutencao.tipo", "manutencao.descricao", "manutencao.oficina",
  "manutencao.dataInicio", "manutencao.dataFim", "manutencao.status",
  "manutencao.custo", "manutencao.custoPorExtenso",
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
  BEM: {
    valores: [...COMUNS, ...BEM],
    listas: {},
  },
  TRANSFERENCIA_BEM: {
    valores: [...COMUNS, ...BEM, ...TRANSFERENCIA],
    listas: {},
  },
  BAIXA_BEM: {
    valores: [...COMUNS, ...BEM, ...BAIXA],
    listas: {},
  },
  INVENTARIO: {
    valores: [...COMUNS, ...INVENTARIO],
    listas: { bens: BENS_CONFERIDOS },
  },
  VIAGEM: {
    valores: [...COMUNS, ...VEICULO, ...VIAGEM],
    listas: { abastecimentos: ABASTECIMENTOS },
  },
  MANUTENCAO: {
    valores: [...COMUNS, ...VEICULO, ...MANUTENCAO],
    listas: {},
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
