import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";
import type { AtoDaFicha } from "../../domain/saude/AtosDaFicha";

export type StatusDoAtendimento = "EM_ANDAMENTO" | "ENCERRADO";

/** O mínimo que o guarda da ficha precisa saber antes de deixar escrever. */
export type AtendimentoResumido = {
  id: string;
  numero: string;
  status: StatusDoAtendimento;
  pacienteId: string | null;
  abertoEm: string;
};

/** Quem assina — o carimbo, tirado do cadastro do usuário. */
export type CredencialDoProfissional = {
  nome: string;
  conselhoTipo: "CRM" | "COREN" | null;
  conselhoNumero: string | null;
  conselhoUf: string | null;
};

export type AtendimentoNaLista = AtendimentoResumido & {
  pacienteNome: string | null;
  prontuario: number | null;
  unidadeSaudeNome: string;
  prioridade: boolean | null;
  temTriagem: boolean;
  temAvaliacao: boolean;
  desfechoTipo: string | null;
};

export type Triagem = {
  glicemia: number | null;
  paSistolica: number | null;
  paDiastolica: number | null;
  pulso: number | null;
  saturacao: number | null;
  temperatura: number | null;
  queixa: string | null;
  conduta: string | null;
  prioridade: boolean;
  fechadoPor: string | null;
  fechadoEm: string | null;
};

export type Exame = {
  id: string;
  descricao: string;
  resultado: string | null;
  solicitadoPor: string;
  solicitadoEm: string;
  resultadoPor: string | null;
  resultadoEm: string | null;
};

export type ItemPrescrito = {
  id: string;
  medicamento: string;
  dose: string;
  via: string;
  frequencia: string;
  observacao: string | null;
  administracoes: {
    id: string; horario: string; executadoPor: string; observacao: string | null;
  }[];
};

export type Prescricao = {
  id: string;
  orientacoes: string | null;
  fechadoPor: string | null;
  fechadoEm: string | null;
  itens: ItemPrescrito[];
};

export type Ficha = {
  atendimento: AtendimentoNaLista & { unidadeSaudeId: string; abertoPor: string };
  paciente: {
    id: string; prontuario: number; nome: string; nomeMae: string | null;
    dataNascimento: string | null; cns: string | null; endereco: string | null;
    cidade: string | null; uf: string | null; telefone: string | null; email: string | null;
    condicoes: { tipo: string; descricao: string | null }[];
  } | null;
  triagem: Triagem | null;
  avaliacao: { queixaClinica: string; fechadoPor: string | null; fechadoEm: string | null } | null;
  exames: Exame[];
  prescricoes: Prescricao[];
  evolucoes: { id: string; tipo: string; texto: string; autor: string; fechadoEm: string }[];
  procedimentos: {
    id: string; tipo: string; descricao: string | null; autor: string; executadoEm: string;
  }[];
  desfecho: {
    tipo: string; destino: string | null; horario: string;
    fechadoPor: string; fechadoEm: string;
  } | null;
  /** As rasuras. Aparecem ao lado do bloco que corrigem, nunca no lugar dele. */
  retificacoes: {
    id: string; tabelaOrigem: string; registroId: string; texto: string;
    autor: string; criadoEm: string;
  }[];
};

export type FiltroDeAtendimentos = Paginacao & {
  termo?: string;
  status?: StatusDoAtendimento;
  unidadeSaudeId?: string;
  /**
   * Sem isto a consulta corta em doze meses.
   *
   * O corte é a "série de trabalho" da decisão 8 — filtro, não expurgo. Quem
   * abre o histórico completo de um paciente passa `true` e vê os vinte anos.
   */
  incluirAntigos?: boolean;
};

export interface AtendimentoSaudeRepository {
  proximoNumero(orgaoId: string, ano: number, tx: Tx): Promise<number>;

  abrir(
    dados: {
      orgaoId: string; unidadeSaudeId: string; numero: string;
      pacienteId: string | null; abertoPor: string;
    },
    tx: Tx,
  ): Promise<string>;

  /** Filtra por órgão sempre: o id sozinho seria vazamento entre prefeituras. */
  resumo(orgaoId: string, atendimentoId: string): Promise<AtendimentoResumido | null>;

  /**
   * Amarra o paciente à ficha que abriu sem identificação.
   *
   * O `paciente_id IS NULL` no WHERE é a trava: só preenche o vazio, nunca
   * troca. Trocar moveria registro clínico de uma pessoa para outra.
   */
  identificar(orgaoId: string, atendimentoId: string, pacienteId: string): Promise<boolean>;

  credencialDoProfissional(
    orgaoId: string, usuarioId: string,
  ): Promise<CredencialDoProfissional | null>;

  /** Já existe bloco fechado deste tipo? Triagem, avaliação e prescrição são únicos. */
  blocoFechado(atendimentoId: string, ato: AtoDaFicha): Promise<boolean>;

  listar(orgaoId: string, filtros: FiltroDeAtendimentos): Promise<Pagina<AtendimentoNaLista>>;

  historicoDoPaciente(
    orgaoId: string, pacienteId: string, incluirAntigos: boolean,
  ): Promise<AtendimentoNaLista[]>;

  ficha(orgaoId: string, atendimentoId: string): Promise<Ficha | null>;

  // --- Os blocos. Cada um nasce fechado ou é fechado no mesmo ato. ---

  salvarTriagem(atendimentoId: string, dados: Omit<Triagem, "fechadoPor" | "fechadoEm">,
    autorId: string): Promise<void>;

  salvarAvaliacao(atendimentoId: string, queixaClinica: string, autorId: string): Promise<void>;

  solicitarExame(atendimentoId: string, descricao: string, autorId: string): Promise<string>;

  informarResultado(
    atendimentoId: string, exameId: string, resultado: string, autorId: string,
  ): Promise<boolean>;

  criarPrescricao(
    atendimentoId: string,
    dados: {
      orientacoes: string | null;
      itens: {
        medicamento: string; dose: string; via: string; frequencia: string;
        observacao?: string | null;
      }[];
    },
    autorId: string,
    tx: Tx,
  ): Promise<string>;

  /** O item pertence a uma prescrição deste atendimento e deste órgão? */
  itemAlcancavel(orgaoId: string, itemId: string): Promise<{ atendimentoId: string } | null>;

  registrarAdministracao(
    itemId: string,
    dados: { horario: Date; observacao?: string | null },
    autorId: string,
  ): Promise<string>;

  registrarEvolucao(
    atendimentoId: string, tipo: "ENFERMAGEM" | "MEDICA", texto: string, autorId: string,
  ): Promise<string>;

  registrarProcedimento(
    atendimentoId: string, tipo: string, descricao: string | null, autorId: string,
  ): Promise<string>;

  /**
   * O desfecho e o encerramento acontecem juntos ou não acontecem.
   *
   * Desfecho gravado com o atendimento aberto deixaria a ficha aceitando
   * registro novo depois da alta; atendimento encerrado sem desfecho seria
   * paciente que sumiu do sistema sem ninguém dizer para onde foi.
   */
  registrarDesfecho(
    atendimentoId: string,
    dados: { tipo: string; destino: string | null; horario: Date },
    autorId: string,
    tx: Tx,
  ): Promise<void>;

  registrarRetificacao(
    atendimentoId: string,
    dados: { tabelaOrigem: string; registroId: string; texto: string },
    autorId: string,
  ): Promise<string>;
}
