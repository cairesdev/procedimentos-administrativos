export type AssetLocation = {
  id: string;
  codigo: string;
  nome: string;
  unidadeId: string | null;
  ativo: boolean;
  bens: number;
};

export type AssetCategory = {
  id: string;
  nome: string;
  ativo: boolean;
  bens: number;
};

export type AssetIntake = {
  id: string;
  data: string;
  notaFiscal: string | null;
  fornecedorId: string | null;
  bens: number;
};

export type Asset = {
  id: string;
  codigoTombamento: string;
  nome: string;
  categoriaId: string;
  categoriaNome: string;
  localAtualId: string;
  localAtualNome: string;
  estadoConservacao: ConservationState;
  status: string;
};

/** Espelha `ESTADOS_DE_CONSERVACAO` da API, que espelha o `CHECK` da tabela. */
export const CONSERVATION_STATE_VALUES = [
  "NOVO", "BOM", "REGULAR", "RUIM", "PESSIMO", "DANIFICADO", "EM_CONSERTO",
] as const;

export type ConservationState = (typeof CONSERVATION_STATE_VALUES)[number];

/**
 * Como o bem está — na ordem em que a pessoa escolhe.
 *
 * Os cinco primeiros são uma régua, do melhor para o pior, e a ordem aqui é a
 * ordem do `<select>`: quem confere o inventário desce a lista até achar o
 * grau, e alfabetar isso faria "bom" vir depois de "antieconômico" em qualquer
 * lista futura.
 *
 * Os dois últimos não são degraus dessa régua. **Danificado** é dano pontual —
 * a tela trincada de um monitor novo em tudo o mais. **Em conserto** diz onde
 * o bem está, não como ele está. Ficaram porque há bens tombados com eles, e
 * reescrever inventário passado é a única coisa que um sistema de patrimônio
 * não pode fazer.
 *
 * A dica embaixo de cada um existe porque "regular" e "ruim" separam mal
 * sozinhos, e o conferente que hesita escolhe "bom" — que é como um acervo
 * inteiro termina classificado como bom.
 */
export const CONSERVATION_STATES: {
  value: ConservationState;
  label: string;
  hint?: string;
}[] = [
  { value: "NOVO", label: "Novo", hint: "Sem uso, ou recém-recebido" },
  { value: "BOM", label: "Bom", hint: "Em uso, sem desgaste aparente" },
  { value: "REGULAR", label: "Regular", hint: "Serve, com desgaste visível" },
  { value: "RUIM", label: "Ruim", hint: "Ainda serve, mas atrapalha o trabalho" },
  { value: "PESSIMO", label: "Péssimo", hint: "Não serve mais para o que foi comprado" },
  { value: "DANIFICADO", label: "Danificado", hint: "Dano pontual, no resto está bem" },
  { value: "EM_CONSERTO", label: "Em conserto", hint: "Fora do local, na assistência" },
];

export type TransferStatus = "PENDENTE" | "ACEITA" | "RECUSADA";

export type AssetTransfer = {
  id: string;
  bemId: string;
  codigoTombamento: string;
  nomeBem: string;
  localOrigemId: string;
  localOrigemNome: string;
  localDestinoId: string;
  localDestinoNome: string;
  enviadoPor: string;
  dataEnvio: string;
  aceitoPor: string | null;
  dataAceite: string | null;
  status: TransferStatus;
};

export type WriteOffReason = "QUEBRADO" | "DOADO" | "EXTRAVIADO" | "LEILAO" | "OUTRO";

export const WRITE_OFF_REASONS: { value: WriteOffReason; label: string }[] = [
  { value: "QUEBRADO", label: "Quebrado / inservível" },
  { value: "DOADO", label: "Doado" },
  { value: "EXTRAVIADO", label: "Extraviado" },
  { value: "LEILAO", label: "Leilão" },
  { value: "OUTRO", label: "Outro" },
];

export type AssetWriteOff = {
  bemId: string;
  codigoTombamento: string;
  nomeBem: string;
  localNome: string;
  motivo: WriteOffReason;
  observacao: string | null;
  dadaPor: string;
  data: string;
};

export type Inventory = {
  id: string;
  localId: string;
  localNome: string;
  dataInicio: string;
  dataConclusao: string | null;
  status: "ABERTO" | "CONCLUIDO";
  conferidos: number;
  esperados: number;
  divergencias: number;
};

export type InventoryItem = {
  id: string | null;
  bemId: string;
  codigoTombamento: string;
  nome: string;
  estadoRegistrado: ConservationState;
  situacao: "ENCONTRADO" | "NAO_ENCONTRADO" | null;
  estadoObservado: ConservationState | null;
  observacao: string | null;
};

export type InventoryDetail = Inventory & { itens: InventoryItem[] };
