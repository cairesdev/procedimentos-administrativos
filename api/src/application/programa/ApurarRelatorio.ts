import { NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { distribuirPorFaixa } from "../../domain/programa/FaixaEtaria";
import { aderencia, diasEntre, periodicidadeApurada, retratoDaFila } from "../../domain/programa/Espera";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type {
  EsperaCrua, ProgramaRepository, QuadroDaEquipe, QuadroDaFila, QuadroDePessoas,
} from "../ports/ProgramaRepository";

export type RelatorioDoPrograma = {
  programa: { id: string; nome: string; sigla: string | null };
  janela: { desde: string; ate: string; dias: number };
  pessoas: QuadroDePessoas;
  fila: QuadroDaFila;
  equipe: QuadroDaEquipe;
  /** Somatórios do item 3, que o ofício pede em uma frase. */
  resumoDaEquipe: {
    profissionais: number;
    horasContratadas: number;
    horasNoPrograma: number;
    exclusivos: number;
    parciais: number;
  };
};

/**
 * O relatório que responde ao Ministério Público.
 *
 * Os três itens do ofício, nesta ordem: quantas pessoas por faixa etária,
 * qual a fila com tempo médio e periodicidade, e quem são os profissionais com
 * carga horária, local, vínculo e dedicação.
 *
 * **As contas ficam no domínio, não no SQL.** Média, mediana e distribuição
 * por faixa moram em `domain/programa/`, são testadas sem banco, e são as
 * mesmas que a tela e a peça impressa usam. Calcular no SQL seria uma segunda
 * implementação das mesmas regras — e no dia em que divergissem, a tela diria
 * um número e o ofício diria outro.
 *
 * **A leitura entra na auditoria.** É o mesmo raciocínio do prontuário: o
 * relatório reúne situação e CID de todo mundo do programa numa página só, e
 * quem o emitiu fica registrado.
 */
export class ApurarRelatorio {
  constructor(
    private readonly programas: ProgramaRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  apurar = async (
    orgaoId: string,
    programaId: string,
    usuarioId: string,
    desde: string,
    ate: string,
  ): Promise<RelatorioDoPrograma> => {
    const catalogo = await this.programas.listarProgramas(orgaoId);
    const programa = catalogo.find((item) => item.id === programaId);
    if (!programa) throw new NaoEncontrado("Programa não encontrado");

    const [esperas, nascimentos, porSituacao, equipe] = await Promise.all([
      this.programas.esperasDoPrograma(orgaoId, programaId, desde),
      this.programas.nascimentosDosAtivos(orgaoId, programaId),
      this.programas.contarPorSituacao(orgaoId, programaId),
      this.programas.listarEquipe(orgaoId, programaId),
    ]);

    const dias = Math.max(diasEntre(desde, ate), 1);

    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "RELATORIO_DE_PROGRAMA_APURADO",
      referenciaId: programaId,
      detalhes: { desde, ate, inscritos: nascimentos.length },
    });

    return {
      programa: { id: programa.id, nome: programa.nome, sigla: programa.sigla },
      janela: { desde, ate, dias },
      pessoas: {
        porSituacao,
        porFaixa: distribuirPorFaixa(nascimentos),
        totalAtivos: nascimentos.length,
      },
      fila: this.montarFila(esperas, dias),
      equipe,
      resumoDaEquipe: resumir(equipe),
    };
  };

  /**
   * Salva o recorte que a peça oficial vai citar.
   *
   * Duas etapas de propósito: a tela apura à vontade, com o período que
   * quiser, e só quando a secretaria decide anexar ao ofício é que nasce um
   * recorte com data e autor. Recorte a cada consulta encheria a tabela de
   * perguntas que ninguém respondeu.
   */
  recortar = async (
    orgaoId: string,
    programaId: string,
    usuarioId: string,
    desde: string,
    ate: string,
  ): Promise<{ id: string }> => {
    const id = await this.programas.criarRecorte(orgaoId, {
      programaId, desde, ate, criadoPor: usuarioId,
    });
    if (!id) throw new NaoEncontrado("Programa não encontrado");
    return { id };
  };

  verRecorte = async (orgaoId: string, id: string) => {
    const recorte = await this.programas.acharRecorte(orgaoId, id);
    if (!recorte) throw new NaoEncontrado("Recorte não encontrado");
    return recorte;
  };

  /**
   * A fila, terapia por terapia.
   *
   * Por terapia, e não somada, porque foi assim que o levantamento decidiu e
   * porque somar esconderia o caso que importa: a criança atendida em
   * fonoaudiologia e esperando terapia ocupacional há oito meses.
   */
  private montarFila = (esperas: EsperaCrua[], dias: number): QuadroDaFila => {
    const porTerapia = new Map<string, EsperaCrua[]>();
    for (const espera of esperas) {
      const lista = porTerapia.get(espera.terapiaId) ?? [];
      lista.push(espera);
      porTerapia.set(espera.terapiaId, lista);
    }

    return [...porTerapia.entries()].map(([terapiaId, linhas]) => {
      const retrato = retratoDaFila(linhas);
      const sessoes = linhas.reduce((soma, linha) => soma + linha.sessoesComparecidas, 0);
      const apurada = periodicidadeApurada(sessoes, dias);

      /**
       * A periodicidade combinada é a média das que foram informadas.
       *
       * Indicação sem periodicidade combinada fica de fora da média, em vez de
       * entrar como zero — zero puxaria o combinado para baixo e faria a
       * aderência parecer melhor do que é.
       */
      const combinadas = linhas
        .map((linha) => linha.periodicidadeSemanal)
        .filter((valor): valor is number => typeof valor === "number" && valor > 0);
      const combinada = combinadas.length > 0
        ? Math.round((combinadas.reduce((s, v) => s + v, 0) / combinadas.length) * 10) / 10
        : null;

      // A periodicidade é por pessoa em atendimento, e não do serviço inteiro:
      // dez sessões entre cinco crianças são duas por criança, não dez.
      const emAtendimento = linhas.filter((linha) => linha.iniciadaEm).length;
      const porPessoa = emAtendimento > 0
        ? Math.round((apurada / emAtendimento) * 10) / 10
        : 0;

      return {
        terapiaId,
        terapiaNome: linhas[0]!.terapiaNome,
        ...retrato,
        periodicidadeApurada: porPessoa,
        periodicidadeCombinada: combinada,
        aderencia: aderencia(combinada, porPessoa),
      };
    }).sort((a, b) => b.naFila - a.naFila);
  };
}

const resumir = (equipe: QuadroDaEquipe): RelatorioDoPrograma["resumoDaEquipe"] => {
  const ativos = equipe.filter((membro) => !membro.encerradoEm);
  return {
    profissionais: ativos.length,
    horasContratadas: soma(ativos.map((m) => Number(m.cargaHorariaSemanal))),
    horasNoPrograma: soma(ativos.map((m) => Number(m.horasNoPrograma))),
    /**
     * "Exclusivamente ou parcialmente" — a pergunta literal do ofício.
     *
     * Exclusivo é quem dedica ao programa toda a carga que tem. Não é o mesmo
     * que "trabalha só com TEA": alguém com 20h de contrato e 20h no programa
     * é exclusivo aqui, mesmo tendo outro vínculo noutra prefeitura. O
     * relatório diz o que este sistema sabe, e não o que ele imagina.
     */
    exclusivos: ativos.filter(
      (m) => Number(m.horasNoPrograma) >= Number(m.cargaHorariaSemanal),
    ).length,
    parciais: ativos.filter(
      (m) => Number(m.horasNoPrograma) < Number(m.cargaHorariaSemanal),
    ).length,
  };
};

const soma = (valores: number[]): number =>
  Math.round(valores.reduce((total, valor) => total + valor, 0) * 10) / 10;
