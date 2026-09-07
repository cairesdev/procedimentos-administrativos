import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";
import type { DocumentosInformados } from "../../domain/saude/DocumentosDoPaciente";

export type DadosDoPaciente = {
  nome: string;
  nomeMae?: string | null;
  dataNascimento?: string | null;
  sexo?: "M" | "F" | "I" | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
} & DocumentosInformados;

export type PacienteNaLista = {
  id: string;
  prontuario: number;
  nome: string;
  nomeMae: string | null;
  dataNascimento: string | null;
  cns: string | null;
  cpf: string | null;
  telefone: string | null;
};

export type Condicao = {
  id: string;
  tipo: "HAS" | "DM" | "ALERGIA" | "OUTRO";
  descricao: string | null;
  registradoPor: string | null;
  registradoEm: string;
};

export type PacienteCompleto = PacienteNaLista & {
  sexo: string | null;
  nis: string | null;
  cnh: string | null;
  rg: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  condicoes: Condicao[];
};

export interface PacienteRepository {
  /**
   * O número do prontuário, atribuído uma vez e carregado para sempre.
   *
   * Entra em `numeracao_sequencia` com `ano = 0` — a convenção deste projeto
   * para sequência que **não** vira o ano, ao contrário de protocolo e
   * processo. Prontuário que reiniciasse em janeiro daria dois pacientes com o
   * número 1, e o número é justamente o que costura a série histórica.
   */
  proximoProntuario(orgaoId: string, tx: Tx): Promise<number>;

  criar(
    orgaoId: string, prontuario: number, dados: DadosDoPaciente, autorId: string, tx: Tx,
  ): Promise<string>;

  /**
   * Já existe alguém com algum destes documentos?
   *
   * Chamado **antes** de cadastrar, para a recepção reaproveitar o prontuário
   * em vez de criar o segundo. Sem isto o índice único devolveria um erro de
   * banco no meio do balcão, e a atendente concluiria que o sistema quebrou.
   */
  porDocumento(orgaoId: string, documentos: DocumentosInformados): Promise<PacienteNaLista | null>;

  porId(orgaoId: string, id: string): Promise<PacienteCompleto | null>;

  /** Busca por nome, prontuário ou qualquer um dos cinco documentos. */
  buscar(orgaoId: string, termo: string, paginacao: Paginacao): Promise<Pagina<PacienteNaLista>>;

  atualizar(orgaoId: string, id: string, dados: DadosDoPaciente): Promise<boolean>;

  registrarCondicao(
    orgaoId: string,
    pacienteId: string,
    condicao: { tipo: string; descricao?: string | null },
    autorId: string,
  ): Promise<string | null>;

  removerCondicao(orgaoId: string, pacienteId: string, condicaoId: string): Promise<boolean>;
}
