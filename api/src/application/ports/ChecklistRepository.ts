import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";

export type ItemDeModelo = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  exigeAnexo: boolean;
  prazoDias: number | null;
  recorrente: boolean;
  periodicidadeDias: number | null;
  setorId: string | null;
  departamentoId: string | null;
  paraFornecedor: boolean;
  /** Agrupador da tela — "Receita", "Licitações". Vem da coluna DIMENSÃO. */
  secao: string | null;
  /** Código oficial do critério (`2.2`, `8.5`). Não é a ordem. */
  codigo: string | null;
  /** Peso: é a obrigatória que o TCE cobra. Nulo em checklist comum. */
  classificacao: "OBRIGATORIA" | "ESSENCIAL" | "RECOMENDADA" | null;
  /** O arquivo que quem cumpre baixa, preenche e devolve. */
  modeloArquivo: string | null;
  modeloNomeOriginal: string | null;
  /** Setores que apoiam sem responder pelo item. */
  apoios: { setorId: string | null; departamentoId: string | null; nome: string }[];
};

export type ModeloDeChecklist = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  totalItens: number;
  /**
   * Modelo que veio com o sistema, não da prefeitura.
   *
   * Mora numa linha com `orgao_id` nulo e é lido por todas — é assim que o
   * roteiro do PNTP chega pronto a quem instala. Toda prefeitura **usa**; para
   * mudar, duplica para si. Sem esta bandeira a tela ofereceria "editar" num
   * registro que o `UPDATE ... WHERE orgao_id = $1` nunca alcançaria, e o
   * salvar não faria nada sem dizer por quê.
   */
  global: boolean;
};

/** Um apoio, como a tela o envia: só o destino. */
export type ApoioParaGravar = {
  setorId?: string | null;
  departamentoId?: string | null;
};

/**
 * O `nome` do apoio é de leitura — vem do join com setor ou departamento.
 * Exigi-lo na escrita faria a tela mandar de volta um dado que ela recebeu
 * pronto, e que o banco já sabe.
 */
export type NovoItemDeModelo = Omit<ItemDeModelo, "id" | "apoios"> & {
  apoios?: ApoioParaGravar[];
};

/** O último ciclo de um item — é dele que a situação é derivada. */
export type UltimoCiclo = {
  id: string;
  ciclo: number;
  situacao: "AGUARDANDO" | "ACEITO" | "RECUSADO";
  vigenciaAte: string | null;
  cumpridoEm: string;
  cumpridoPorNome: string | null;
  observacao: string | null;
  recusaMotivo: string | null;
  conferidoPorNome: string | null;
  conferidoEm: string | null;
  anexos: { id: string; nomeOriginal: string; tamanhoBytes: number }[];
};

export type ItemDeChecklist = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  exigeAnexo: boolean;
  prazoLimite: string | null;
  recorrente: boolean;
  periodicidadeDias: number | null;
  setorId: string | null;
  setorNome: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
  paraFornecedor: boolean;
  /** Agrupador da tela — "Receita", "Licitações". Vem da coluna DIMENSÃO. */
  secao: string | null;
  /** Código oficial do critério (`2.2`, `8.5`). Não é a ordem. */
  codigo: string | null;
  /** Peso: é a obrigatória que o TCE cobra. Nulo em checklist comum. */
  classificacao: "OBRIGATORIA" | "ESSENCIAL" | "RECOMENDADA" | null;
  /** O arquivo que quem cumpre baixa, preenche e devolve. */
  modeloArquivo: string | null;
  modeloNomeOriginal: string | null;
  /** Setores que apoiam sem responder pelo item. */
  apoios: { setorId: string | null; departamentoId: string | null; nome: string }[];
  dispensadoEm: string | null;
  dispensaMotivo: string | null;
  dispensadoPorNome: string | null;
  ultimoCiclo: UltimoCiclo | null;
  /** Todos os ciclos anteriores, do mais novo ao mais antigo. */
  historico: UltimoCiclo[];
};

export type ChecklistResumo = {
  id: string;
  titulo: string;
  alvoTipo: string | null;
  alvoId: string | null;
  criadoEm: string;
  totalItens: number;
  /** Contados no banco: em aberto é o que ainda deve alguma coisa. */
  emAberto: number;
};

export type ChecklistCompleto = ChecklistResumo & {
  descricao: string | null;
  modeloId: string | null;
  modeloNome: string | null;
  setorId: string | null;
  setorNome: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
  criadoPorNome: string | null;
  itens: ItemDeChecklist[];
};

export type NovoChecklist = {
  orgaoId: string;
  titulo: string;
  descricao?: string | null;
  modeloId?: string | null;
  alvoTipo?: string | null;
  alvoId?: string | null;
  setorId?: string | null;
  departamentoId?: string | null;
  criadoPor: string;
};

export type NovoItemDeChecklist = {
  ordem: number;
  titulo: string;
  descricao?: string | null;
  exigeAnexo: boolean;
  prazoLimite?: string | null;
  recorrente: boolean;
  periodicidadeDias?: number | null;
  setorId?: string | null;
  departamentoId?: string | null;
  paraFornecedor: boolean;
  secao?: string | null;
  codigo?: string | null;
  classificacao?: "OBRIGATORIA" | "ESSENCIAL" | "RECOMENDADA" | null;
  modeloArquivo?: string | null;
  modeloNomeOriginal?: string | null;
  apoios?: ApoioParaGravar[];
};

/** Só o que a regra de cumprimento precisa saber sobre o item. */
export type ItemParaCumprir = {
  id: string;
  checklistId: string;
  titulo: string;
  exigeAnexo: boolean;
  recorrente: boolean;
  periodicidadeDias: number | null;
  dispensadoEm: string | null;
  ultimoCicloId: string | null;
  ultimoCicloSituacao: "AGUARDANDO" | "ACEITO" | "RECUSADO" | null;
  ultimoCicloVigenciaAte: string | null;
  ultimoCiclo: number;
};

export interface ChecklistRepository {
  // ---- Modelos -------------------------------------------------------------
  listarModelos(orgaoId: string): Promise<ModeloDeChecklist[]>;
  buscarModelo(orgaoId: string, id: string): Promise<
    (ModeloDeChecklist & { itens: ItemDeModelo[] }) | null
  >;
  criarModelo(orgaoId: string, dados: { nome: string; descricao?: string | null }): Promise<string>;
  atualizarModelo(
    orgaoId: string, id: string, dados: { nome: string; descricao?: string | null; ativo: boolean },
  ): Promise<void>;
  removerModelo(orgaoId: string, id: string): Promise<void>;
  /** Substitui os itens inteiros: a tela manda a lista como ela ficou. */
  substituirItensDoModelo(
    orgaoId: string, modeloId: string, itens: NovoItemDeModelo[], tx: Tx,
  ): Promise<void>;
  modeloEstaEmUso(orgaoId: string, modeloId: string): Promise<boolean>;

  // ---- Checklists ----------------------------------------------------------
  listar(orgaoId: string, filtros: Paginacao & {
    alvoTipo?: string; alvoId?: string; emAberto?: boolean;
  }): Promise<Pagina<ChecklistResumo>>;
  /** Registros que casam com o texto digitado — número, nome, documento. */
  buscarAlvos(orgaoId: string, tipo: string, busca: string): Promise<
    { tipo: string; id: string; numero: string; rotulo: string }[]
  >;
  /** Os do alvo, sem paginação: o card do processo mostra todos. */
  listarDoAlvo(orgaoId: string, alvoTipo: string, alvoId: string): Promise<ChecklistResumo[]>;
  buscar(orgaoId: string, id: string): Promise<ChecklistCompleto | null>;
  criar(dados: NovoChecklist, itens: NovoItemDeChecklist[], tx: Tx): Promise<string>;
  atualizar(orgaoId: string, id: string, dados: {
    titulo: string; descricao?: string | null;
    setorId?: string | null; departamentoId?: string | null;
  }): Promise<void>;
  remover(orgaoId: string, id: string): Promise<void>;
  substituirItens(
    orgaoId: string, checklistId: string, itens: NovoItemDeChecklist[], tx: Tx,
  ): Promise<void>;

  // ---- Cumprimento ---------------------------------------------------------
  buscarItemParaCumprir(orgaoId: string, itemId: string): Promise<ItemParaCumprir | null>;
  abrirCiclo(dados: {
    itemId: string;
    ciclo: number;
    cumpridoPor: string | null;
    cumpridoPorExterno: boolean;
    observacao: string | null;
    vigenciaAte: string | null;
  }, tx: Tx): Promise<string>;
  responderCiclo(dados: {
    cicloId: string;
    usuarioId: string;
    aceitar: boolean;
    recusaMotivo: string | null;
  }, tx: Tx): Promise<void>;
  dispensarItem(
    orgaoId: string, itemId: string, usuarioId: string, motivo: string,
  ): Promise<void>;
  reabrirItem(orgaoId: string, itemId: string): Promise<void>;

  // ---- Anexo ---------------------------------------------------------------
  registrarAnexo(dados: {
    cumprimentoId: string;
    arquivo: string;
    nomeOriginal: string;
    tamanhoBytes: number;
  }): Promise<string>;
  /** O arquivo de referência do item — o "BAIXAR" da planilha. */
  modeloDoItem(orgaoId: string, itemId: string): Promise<
    { arquivo: string; nomeOriginal: string } | null
  >;
  buscarAnexo(orgaoId: string, anexoId: string): Promise<
    { arquivo: string; nomeOriginal: string } | null
  >;
}
