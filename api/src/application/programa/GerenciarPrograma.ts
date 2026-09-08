import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { Pagina, Paginacao } from "../shared/Paginacao";
import type {
  ConselhoDaTerapia, FichaDoInscrito, InscritoNaLista, NovaIndicacao, NovaInscricao,
  NovoMembro, Programa, ProgramaRepository, QuadroDaEquipe, SituacaoDaInscricao,
} from "../ports/ProgramaRepository";

/**
 * O programa de cuidado continuado: catálogo, inscritos, fila e equipe.
 *
 * A regra que atravessa tudo aqui é que **o número tem de continuar
 * verdadeiro**. Cada recusa abaixo existe porque a alternativa produziria uma
 * linha que faz a fila parecer menor, o atendimento parecer mais rápido ou a
 * equipe parecer maior do que é — e esse número vai para uma Promotoria.
 */
export class GerenciarPrograma {
  constructor(
    private readonly programas: ProgramaRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  // --- Catálogo ---

  listar = (orgaoId: string): Promise<Programa[]> => this.programas.listarProgramas(orgaoId);

  criarPrograma = async (
    orgaoId: string,
    dados: { nome: string; sigla?: string | null; descricao?: string | null },
  ): Promise<{ id: string }> => {
    if (!dados.nome?.trim()) throw new ErroDeNegocio("Informe o nome do programa");
    return { id: await this.programas.criarPrograma(orgaoId, dados) };
  };

  atualizarPrograma = async (
    orgaoId: string,
    id: string,
    dados: { nome: string; sigla?: string | null; descricao?: string | null; ativo?: boolean },
  ): Promise<void> => {
    const mudou = await this.programas.atualizarPrograma(orgaoId, id, dados);
    if (!mudou) throw new NaoEncontrado("Programa não encontrado");
  };

  criarTerapia = async (
    orgaoId: string,
    programaId: string,
    dados: { nome: string; conselho?: ConselhoDaTerapia | null },
  ): Promise<{ id: string }> => {
    if (!dados.nome?.trim()) throw new ErroDeNegocio("Informe o nome da terapia");
    const id = await this.programas.criarTerapia(orgaoId, programaId, dados);
    if (!id) throw new NaoEncontrado("Programa não encontrado");
    return { id };
  };

  atualizarTerapia = async (
    orgaoId: string,
    terapiaId: string,
    dados: { nome: string; conselho?: ConselhoDaTerapia | null; ativo: boolean },
  ): Promise<void> => {
    const mudou = await this.programas.atualizarTerapia(orgaoId, terapiaId, dados);
    if (!mudou) throw new NaoEncontrado("Terapia não encontrada");
  };

  // --- Inscritos ---

  listarInscritos = (
    orgaoId: string,
    filtros: Paginacao & { programaId?: string; situacao?: string; termo?: string },
  ): Promise<Pagina<InscritoNaLista>> => this.programas.listarInscritos(orgaoId, filtros);

  /**
   * Inscrever alguém no programa.
   *
   * A conferência de duplicidade vem antes do INSERT: o índice único
   * devolveria um erro de banco no meio do atendimento, e quem está
   * cadastrando concluiria que o sistema quebrou em vez de abrir a inscrição
   * que já existe. Recadastrar também faria a fila contar duas esperas da
   * mesma criança.
   */
  inscrever = async (dados: NovaInscricao): Promise<{ id: string }> => {
    if (dados.situacao === "DIAGNOSTICADO" && !dados.diagnosticoEm) {
      throw new ErroDeNegocio(
        "Informe a data do diagnóstico. Sem ela, o número de diagnosticados não "
        + "tem como ser auditado — e é o primeiro que a Promotoria confere.",
      );
    }

    const jaInscrito = await this.programas.inscricaoDoPaciente(
      dados.orgaoId, dados.programaId, dados.pacienteId,
    );
    if (jaInscrito) {
      throw new Conflito(
        `${jaInscrito.nome} já está inscrito neste programa. Abra a inscrição `
        + "existente em vez de criar outra.",
        { inscricaoId: jaInscrito.id },
      );
    }

    const id = await this.programas.inscrever(dados);
    await this.auditoria.registrar({
      orgaoId: dados.orgaoId,
      usuarioId: dados.criadoPor,
      tipoEvento: "INSCRICAO_EM_PROGRAMA",
      referenciaId: id,
      detalhes: { programaId: dados.programaId, situacao: dados.situacao ?? "EM_INVESTIGACAO" },
    });
    return { id };
  };

  ver = async (orgaoId: string, inscricaoId: string): Promise<FichaDoInscrito> => {
    const ficha = await this.programas.fichaDoInscrito(orgaoId, inscricaoId);
    if (!ficha) throw new NaoEncontrado("Inscrição não encontrada");
    return ficha;
  };

  /**
   * Mudar a situação — o número do item 1 do ofício sai daqui.
   *
   * Encerrar (alta, transferência, abandono) exige data, e o banco cobra o
   * mesmo. Abandono sem data seria alguém que sumiu da fila sem deixar quando:
   * o total de ativos cairia e ninguém saberia explicar em que mês.
   */
  atualizarSituacao = async (
    orgaoId: string,
    inscricaoId: string,
    usuarioId: string,
    dados: {
      situacao: SituacaoDaInscricao;
      diagnosticoEm?: string | null;
      cid?: string | null;
      observacao?: string | null;
      encerradoEm?: string | null;
    },
  ): Promise<void> => {
    const encerra = ["ALTA", "TRANSFERIDO", "ABANDONO"].includes(dados.situacao);

    if (dados.situacao === "DIAGNOSTICADO" && !dados.diagnosticoEm) {
      throw new ErroDeNegocio("Informe a data do diagnóstico");
    }
    if (encerra && !dados.encerradoEm) {
      throw new ErroDeNegocio(
        "Informe a data de encerramento. Sem ela, a pessoa sai do total de "
        + "ativos sem deixar registrado em que mês saiu.",
      );
    }

    const mudou = await this.programas.atualizarInscricao(orgaoId, inscricaoId, {
      ...dados,
      encerradoEm: encerra ? dados.encerradoEm : null,
    });
    if (!mudou) throw new NaoEncontrado("Inscrição não encontrada");

    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "SITUACAO_NO_PROGRAMA_ALTERADA",
      referenciaId: inscricaoId, detalhes: { situacao: dados.situacao },
    });
  };

  // --- A fila ---

  /**
   * Indicar uma terapia é colocar a pessoa na fila.
   *
   * `indicada_em` é o começo da espera, e é por isso que ela não pode ser
   * futura: uma indicação datada para a semana que vem começaria a contar
   * espera negativa e faria a média do relatório encolher.
   */
  indicar = async (orgaoId: string, dados: NovaIndicacao): Promise<{ id: string }> => {
    if (dados.indicadaEm && dados.indicadaEm > hoje()) {
      throw new ErroDeNegocio("A indicação não pode ter data futura");
    }

    const id = await this.programas.indicar(orgaoId, dados);
    if (!id) {
      throw new Conflito(
        "Esta terapia já está indicada e não foi encerrada. A pessoa entraria "
        + "duas vezes na mesma fila.",
      );
    }
    await this.auditoria.registrar({
      orgaoId, usuarioId: dados.indicadaPor, tipoEvento: "TERAPIA_INDICADA",
      referenciaId: dados.inscricaoId, detalhes: { terapiaId: dados.terapiaId },
    });
    return { id };
  };

  /**
   * A terapia começou — e a espera acaba aqui.
   *
   * É o registro mais importante do módulo para o relatório: enquanto ele não
   * existe, a pessoa está na fila viva e a espera dela cresce sozinha todo dia.
   */
  iniciar = async (
    orgaoId: string, indicacaoId: string, usuarioId: string, em: string,
  ): Promise<void> => {
    const alcance = await this.programas.indicacaoAlcancavel(orgaoId, indicacaoId);
    if (!alcance) throw new NaoEncontrado("Indicação não encontrada");
    if (alcance.iniciadaEm) {
      throw new Conflito(
        "Esta terapia já foi iniciada. Mudar a data de início mudaria a espera "
        + "que já está registrada.",
      );
    }
    if (em > hoje()) throw new ErroDeNegocio("O início não pode ter data futura");

    const mudou = await this.programas.iniciarTerapia(orgaoId, indicacaoId, em);
    if (!mudou) {
      throw new ErroDeNegocio("O início não pode ser anterior à indicação");
    }
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "TERAPIA_INICIADA", referenciaId: indicacaoId,
      detalhes: { em },
    });
  };

  encerrarTerapia = async (
    orgaoId: string, indicacaoId: string, usuarioId: string, em: string, motivo: string,
  ): Promise<void> => {
    if (!motivo.trim()) throw new ErroDeNegocio("Diga por que a terapia foi encerrada");

    const mudou = await this.programas.encerrarTerapia(orgaoId, indicacaoId, em, motivo.trim());
    if (!mudou) {
      throw new ErroDeNegocio(
        "Só é possível encerrar terapia que começou, e em data igual ou "
        + "posterior ao início.",
      );
    }
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "TERAPIA_ENCERRADA", referenciaId: indicacaoId,
      detalhes: { em, motivo },
    });
  };

  // --- Equipe ---

  listarEquipe = (orgaoId: string, programaId: string): Promise<QuadroDaEquipe> =>
    this.programas.listarEquipe(orgaoId, programaId);

  /** Busca curta demais devolve a prefeitura inteira; duas letras é o piso. */
  procurarPessoas = async (orgaoId: string, termo: string) => {
    const limpo = termo.trim();
    if (limpo.length < 2) return [];
    return this.programas.pessoasParaInscrever(orgaoId, limpo);
  };

  listarProfissionais = (orgaoId: string) =>
    this.programas.profissionaisDoOrgao(orgaoId);

  /**
   * A equipe, com as horas dedicadas ao programa.
   *
   * `horasNoPrograma <= cargaHorariaSemanal` é o CHECK que impede a resposta
   * ao Ministério Público de não fechar com a folha de pagamento — alguém
   * dedicando 40 horas ao TEA num contrato de 20.
   */
  adicionarMembro = async (
    orgaoId: string, usuarioId: string, dados: NovoMembro,
  ): Promise<{ id: string }> => {
    if (dados.horasNoPrograma > dados.cargaHorariaSemanal) {
      throw new ErroDeNegocio(
        `Não é possível dedicar ${dados.horasNoPrograma}h ao programa com uma `
        + `carga horária de ${dados.cargaHorariaSemanal}h. A resposta ao `
        + "Ministério Público não fecharia com a folha.",
      );
    }

    const id = await this.programas.adicionarMembro(orgaoId, dados);
    if (!id) {
      throw new Conflito(
        "Este profissional já está na equipe nesta terapia. Encerre o vínculo "
        + "anterior antes de criar outro.",
      );
    }
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "EQUIPE_DO_PROGRAMA_ALTERADA",
      referenciaId: dados.programaId, detalhes: { profissional: dados.usuarioId },
    });
    return { id };
  };

  encerrarMembro = async (
    orgaoId: string, membroId: string, usuarioId: string, em: string,
  ): Promise<void> => {
    const mudou = await this.programas.encerrarMembro(orgaoId, membroId, em);
    if (!mudou) throw new NaoEncontrado("Vínculo não encontrado");
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "EQUIPE_DO_PROGRAMA_ALTERADA",
      referenciaId: membroId, detalhes: { encerradoEm: em },
    });
  };
}

/** Hoje em `YYYY-MM-DD`, no fuso local — o mesmo dia que a equipe vê. */
export const hoje = (): string => {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
};
