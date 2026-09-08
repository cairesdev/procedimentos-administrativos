import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { ContagemPorFaixa } from "../../domain/programa/FaixaEtaria";

export type ConselhoDaTerapia = "CRM" | "COREN" | "CRFA" | "CREFITO" | "CRP" | "OUTRO";

export type SituacaoDaInscricao =
  | "EM_INVESTIGACAO" | "DIAGNOSTICADO" | "ALTA" | "TRANSFERIDO" | "ABANDONO";

export type TipoDeVinculo = "EFETIVO" | "CONTRATO" | "CEDIDO" | "TERCEIRIZADO" | "OUTRO";

export type Programa = {
  id: string;
  nome: string;
  sigla: string | null;
  descricao: string | null;
  ativo: boolean;
  terapias: Terapia[];
};

export type Terapia = {
  id: string;
  nome: string;
  conselho: ConselhoDaTerapia | null;
  ativo: boolean;
};

export type InscritoNaLista = {
  id: string;
  pacienteId: string;
  prontuario: number;
  nome: string;
  dataNascimento: string | null;
  situacao: SituacaoDaInscricao;
  inscritoEm: string;
  diagnosticoEm: string | null;
  cid: string | null;
  /** Quantas terapias indicadas e quantas já começaram — o resumo da fila. */
  terapiasIndicadas: number;
  terapiasIniciadas: number;
};

export type IndicacaoNaFicha = {
  id: string;
  terapiaId: string;
  terapiaNome: string;
  indicadaEm: string;
  periodicidadeSemanal: number | null;
  iniciadaEm: string | null;
  encerradaEm: string | null;
  motivoEncerramento: string | null;
  /** Sessões com comparecimento nos últimos 90 dias — a periodicidade real. */
  sessoesRecentes: number;
  ultimaSessao: string | null;
};

export type FichaDoInscrito = {
  inscricao: InscritoNaLista & { observacao: string | null; programaNome: string };
  indicacoes: IndicacaoNaFicha[];
};

export type NovaInscricao = {
  orgaoId: string;
  programaId: string;
  pacienteId: string;
  inscritoEm?: string | null;
  situacao?: SituacaoDaInscricao;
  diagnosticoEm?: string | null;
  cid?: string | null;
  observacao?: string | null;
  criadoPor: string;
};

export type NovaIndicacao = {
  inscricaoId: string;
  terapiaId: string;
  indicadaEm?: string | null;
  periodicidadeSemanal?: number | null;
  indicadaPor: string;
};

export type NovaSessao = {
  indicacaoId: string;
  data: string;
  profissionalId: string;
  compareceu: boolean;
  observacao?: string | null;
};

export type MembroDaEquipe = {
  id: string;
  usuarioId: string;
  nome: string;
  papelBase: string;
  conselho: string | null;
  terapiaId: string | null;
  terapiaNome: string | null;
  cargaHorariaSemanal: number;
  horasNoPrograma: number;
  localNome: string | null;
  unidadeSaudeNome: string | null;
  tipoVinculo: TipoDeVinculo;
  iniciadoEm: string;
  encerradoEm: string | null;
};

export type NovoMembro = {
  programaId: string;
  usuarioId: string;
  terapiaId?: string | null;
  cargaHorariaSemanal: number;
  horasNoPrograma: number;
  localId?: string | null;
  unidadeSaudeId?: string | null;
  tipoVinculo: TipoDeVinculo;
};

// --- O que o ofício pergunta ---

/** Item 1: quantas pessoas, por situação e por faixa etária. */
export type QuadroDePessoas = {
  porSituacao: { situacao: SituacaoDaInscricao; quantidade: number }[];
  /** Faixas de quem está ativo — em investigação ou diagnosticado. */
  porFaixa: ContagemPorFaixa[];
  totalAtivos: number;
};

/** Item 2: a fila, terapia por terapia. */
export type QuadroDaFila = {
  terapiaId: string;
  terapiaNome: string;
  naFila: number;
  esperaMaisAntiga: number;
  mediaNaFila: number;
  iniciados: number;
  mediaAteIniciar: number;
  medianaAteIniciar: number;
  /** Sessões com comparecimento na janela, e a periodicidade que elas dão. */
  periodicidadeApurada: number;
  periodicidadeCombinada: number | null;
  aderencia: number | null;
}[];

/** Item 3: os profissionais, com o que o promotor pediu de cada um. */
export type QuadroDaEquipe = MembroDaEquipe[];

/** As esperas cruas, para o domínio calcular — o SQL não faz média. */
export type EsperaCrua = {
  terapiaId: string;
  terapiaNome: string;
  indicadaEm: string;
  iniciadaEm: string | null;
  periodicidadeSemanal: number | null;
  sessoesComparecidas: number;
};

/** O recorte como a tela o mostra: a pergunta, e quem a fez. */
export type RecorteSalvo = {
  id: string;
  programaId: string;
  programaNome: string;
  desde: string;
  ate: string;
  criadoEm: string;
};

export interface ProgramaRepository {
  // Catálogo — sem pessoa nenhuma, e por isso alcançável pelo administrador.
  listarProgramas(orgaoId: string): Promise<Programa[]>;
  criarPrograma(
    orgaoId: string,
    dados: { nome: string; sigla?: string | null; descricao?: string | null },
  ): Promise<string>;
  atualizarPrograma(
    orgaoId: string,
    id: string,
    dados: { nome: string; sigla?: string | null; descricao?: string | null; ativo?: boolean },
  ): Promise<boolean>;
  criarTerapia(
    orgaoId: string,
    programaId: string,
    dados: { nome: string; conselho?: ConselhoDaTerapia | null },
  ): Promise<string | null>;
  atualizarTerapia(
    orgaoId: string,
    terapiaId: string,
    dados: { nome: string; conselho?: ConselhoDaTerapia | null; ativo: boolean },
  ): Promise<boolean>;

  // Inscritos.
  listarInscritos(
    orgaoId: string,
    filtros: Paginacao & { programaId?: string; situacao?: string; termo?: string },
  ): Promise<Pagina<InscritoNaLista>>;
  /** A pessoa já está neste programa? Evita o erro de banco no balcão. */
  inscricaoDoPaciente(
    orgaoId: string, programaId: string, pacienteId: string,
  ): Promise<{ id: string; nome: string } | null>;
  inscrever(dados: NovaInscricao): Promise<string>;
  fichaDoInscrito(orgaoId: string, inscricaoId: string): Promise<FichaDoInscrito | null>;
  atualizarInscricao(
    orgaoId: string,
    inscricaoId: string,
    dados: {
      situacao: SituacaoDaInscricao;
      diagnosticoEm?: string | null;
      cid?: string | null;
      observacao?: string | null;
      encerradoEm?: string | null;
    },
  ): Promise<boolean>;

  // A fila.
  indicar(orgaoId: string, dados: NovaIndicacao): Promise<string | null>;
  /** A indicação pertence a este órgão? Alcança por dois joins. */
  indicacaoAlcancavel(
    orgaoId: string, indicacaoId: string,
  ): Promise<{ inscricaoId: string; iniciadaEm: string | null } | null>;
  iniciarTerapia(orgaoId: string, indicacaoId: string, em: string): Promise<boolean>;
  encerrarTerapia(
    orgaoId: string, indicacaoId: string, em: string, motivo: string,
  ): Promise<boolean>;

  // As sessões.
  /** `null` quando aquele dia já tem sessão — digitação repetida. */
  registrarSessao(dados: NovaSessao): Promise<string | null>;
  sessoesDaIndicacao(
    orgaoId: string, indicacaoId: string, limite: number,
  ): Promise<{
    id: string; data: string; profissional: string; compareceu: boolean;
    observacao: string | null;
  }[]>;

  // A equipe.
  listarEquipe(orgaoId: string, programaId: string): Promise<QuadroDaEquipe>;
  adicionarMembro(orgaoId: string, dados: NovoMembro): Promise<string | null>;
  encerrarMembro(orgaoId: string, membroId: string, em: string): Promise<boolean>;

  // O relatório.
  /**
   * As linhas cruas das esperas, para o domínio fazer média e mediana.
   *
   * O SQL não calcula média de propósito: a regra de "a média das consumadas
   * sozinha mente" vive em `domain/programa/Espera.ts`, é testada sem banco, e
   * é a mesma que a tela e a peça impressa usam. Média calculada no SQL seria
   * uma segunda implementação da mesma regra, e as duas divergiriam.
   */
  esperasDoPrograma(
    orgaoId: string, programaId: string, desde: string,
  ): Promise<EsperaCrua[]>;
  nascimentosDosAtivos(orgaoId: string, programaId: string): Promise<(string | null)[]>;
  contarPorSituacao(
    orgaoId: string, programaId: string,
  ): Promise<{ situacao: SituacaoDaInscricao; quantidade: number }[]>;

  /**
   * Salva o recorte — programa e período — para a peça oficial apontar.
   *
   * Guarda a **pergunta**, nunca os números: eles são reapurados na emissão
   * pelo mesmo caso de uso que a tela usa. É o que impede o papel e a tela de
   * dizerem coisas diferentes sobre a mesma fila.
   */
  criarRecorte(
    orgaoId: string,
    dados: { programaId: string; desde: string; ate: string; criadoPor: string },
  ): Promise<string | null>;
  acharRecorte(orgaoId: string, id: string): Promise<RecorteSalvo | null>;

  /**
   * O índice de nomes que a coordenação alcança — e nada além disso.
   *
   * Existe porque inscrever alguém exige achar a pessoa, e a busca de
   * pacientes mora sob `health:read`, que a coordenação do programa não tem
   * (nem deve ter: ali começa o prontuário). Aqui vão nome, prontuário e
   * nascimento; condição, CID e histórico continuam do outro lado da porta.
   */
  pessoasParaInscrever(
    orgaoId: string, termo: string,
  ): Promise<{ id: string; prontuario: number; nome: string; dataNascimento: string | null }[]>;

  /**
   * Quem pode entrar na equipe: os profissionais clínicos da prefeitura.
   *
   * Sem passar pelo cadastro de usuários, que é `users:read` e administração.
   * A coordenação precisa do nome e do conselho para montar a equipe, não da
   * senha nem das permissões de ninguém.
   */
  profissionaisDoOrgao(orgaoId: string): Promise<{
    id: string; nome: string; papelBase: string; conselho: string | null;
  }[]>;
}
