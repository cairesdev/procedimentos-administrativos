import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type {
  DossieDoProcesso, FiltrosDoRelatorio, Panorama, PorSetor, ProcessoEncontrado,
  RelatorioProcessoRepository,
} from "../ports/RelatorioProcessoRepository";

export const TIPOS_DE_RELATORIO = ["PANORAMA", "DOSSIE", "SETOR"] as const;
export type TipoDeRelatorio = (typeof TIPOS_DE_RELATORIO)[number];

/** O recorte salvo — é dele que a peça emitida nasce. */
export type RecorteSalvo = {
  id: string;
  tipo: TipoDeRelatorio;
  periodoInicio: string;
  periodoFim: string;
  filtros: Record<string, string | null>;
};

export interface RecorteRepository {
  salvar(
    orgaoId: string,
    usuarioId: string,
    tipo: TipoDeRelatorio,
    filtros: FiltrosDoRelatorio,
  ): Promise<{ id: string }>;
  buscar(orgaoId: string, id: string): Promise<RecorteSalvo | null>;
}

/**
 * Relatórios de processos: panorama e tramitação por setor.
 *
 * **A tela não salva nada.** Ela apura direto dos filtros da URL, e o resultado
 * é recalculado a cada abertura — assim o relatório pode ser recarregado,
 * compartilhado por link e refeito amanhã com os números de amanhã.
 *
 * O recorte só é gravado quando alguém vai **emitir a peça**, porque aí é
 * preciso um registro para o documento apontar. O que se grava é a pergunta —
 * tipo, período e filtros —, nunca a resposta: guardar os números faria o
 * relatório reaberto mostrar dados de ontem enquanto a tela ao lado mostra os
 * de hoje, e ninguém saberia qual está certo.
 */
export class ApurarRelatorioDeProcessos {
  constructor(
    private readonly relatorios: RelatorioProcessoRepository,
    private readonly recortes: RecorteRepository,
  ) {}

  /**
   * Período invertido devolveria relatório vazio, e quem lê concluiria que não
   * houve movimento — o pior jeito de errar num relatório.
   */
  private exigirPeriodoCoerente = (filtros: FiltrosDoRelatorio) => {
    if (filtros.periodoFim < filtros.periodoInicio) {
      throw new ErroDeNegocio("O fim do período é anterior ao início");
    }
  };

  panorama = async (orgaoId: string, filtros: FiltrosDoRelatorio): Promise<Panorama> => {
    this.exigirPeriodoCoerente(filtros);
    return this.relatorios.panorama(orgaoId, filtros);
  };

  porSetor = async (orgaoId: string, filtros: FiltrosDoRelatorio): Promise<PorSetor> => {
    this.exigirPeriodoCoerente(filtros);
    return this.relatorios.porSetor(orgaoId, filtros);
  };

  /**
   * Tudo sobre um processo, numa folha só.
   *
   * Hoje isso exige abrir cinco telas — o processo, a licitação, o contrato, os
   * itens, a tramitação — e juntar de cabeça. É a consulta que o controle
   * interno faz antes de dar parecer, e a que o Tribunal pede quando questiona
   * uma despesa.
   */
  dossie = async (orgaoId: string, processoId: string): Promise<DossieDoProcesso> => {
    const dossie = await this.relatorios.dossie(orgaoId, processoId);
    if (!dossie) throw new NaoEncontrado("Processo não encontrado");
    return dossie;
  };

  buscarProcessos = (orgaoId: string, busca: string): Promise<ProcessoEncontrado[]> =>
    this.relatorios.buscarProcessos(orgaoId, busca);

  salvarRecorte = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    tipo: TipoDeRelatorio;
    filtros: FiltrosDoRelatorio;
  }): Promise<{ id: string }> => {
    this.exigirPeriodoCoerente(entrada.filtros);
    return this.recortes.salvar(
      entrada.orgaoId, entrada.usuarioId, entrada.tipo, entrada.filtros,
    );
  };

  buscarRecorte = async (orgaoId: string, id: string): Promise<RecorteSalvo> => {
    const recorte = await this.recortes.buscar(orgaoId, id);
    if (!recorte) throw new NaoEncontrado("Relatório não encontrado");
    return recorte;
  };
}
