import { apiRequest } from "@/shared/api/http-client";
import { comFiltros } from "@/shared/api/filtros";
import { lista } from "@/shared/api/colecao";
import type {
  BySector, FoundProcess, Panorama, ProcessDossier, ReportFilters, ReportType,
} from "./types";

const BASE = "/relatorios";

/**
 * O relatório é apurado a cada abertura, a partir dos filtros da URL.
 *
 * Nada de resultado salvo: assim o endereço pode ser recarregado,
 * compartilhado e reaberto amanhã com os números de amanhã. Quem precisa do
 * retrato de hoje emite a peça, que congela os valores.
 */
export const getPanorama = (filtros: ReportFilters) =>
  apiRequest<unknown>(comFiltros(`${BASE}/panorama`, filtros)).then((corpo) => {
    const dados = (corpo ?? {}) as Partial<Panorama>;
    return {
      totais: dados.totais ?? {
        licitacoes: 0, contratos: 0, fornecedores: 0,
        valorContratado: 0, valorPedido: 0, saldo: 0,
      },
      contratos: lista<Panorama["contratos"][number]>(dados.contratos),
      licitacoes: lista<Panorama["licitacoes"][number]>(dados.licitacoes),
      fornecedores: lista<Panorama["fornecedores"][number]>(dados.fornecedores),
      unidades: lista<Panorama["unidades"][number]>(dados.unidades),
    } satisfies Panorama;
  });

export const getBySector = (filtros: ReportFilters) =>
  apiRequest<unknown>(comFiltros(`${BASE}/setor`, filtros)).then((corpo) => {
    const dados = (corpo ?? {}) as Partial<BySector>;
    return {
      totais: dados.totais ?? { entraram: 0, sairam: 0, parados: 0 },
      setores: lista<BySector["setores"][number]>(dados.setores),
    } satisfies BySector;
  });

/** O recorte salvo: a pergunta que a peça emitida responde. */
export type SavedCut = {
  id: string;
  tipo: ReportType;
  periodoInicio: string;
  periodoFim: string;
  filtros: Record<string, string | null>;
};

export const getReportCut = (id: string) => apiRequest<SavedCut>(`${BASE}/${id}`);

/**
 * O dossiê de um processo.
 *
 * As listas passam pelo mesmo filtro das outras telas: um furo em `tramitacao`
 * ou `itens` explodiria no `.map` durante o render, e o erro apareceria no
 * navegador sem nada no log do servidor.
 */
export const getProcessDossier = (processoId: string) =>
  apiRequest<unknown>(`${BASE}/dossie/${processoId}`).then((corpo) => {
    const dados = (corpo ?? {}) as Partial<ProcessDossier>;
    if (!dados.processo?.id) return null;

    return {
      processo: dados.processo,
      origem: dados.origem ?? null,
      contrato: dados.contrato ?? null,
      itens: lista<ProcessDossier["itens"][number]>(dados.itens),
      tramitacao: lista<ProcessDossier["tramitacao"][number]>(dados.tramitacao),
      ordens: lista<ProcessDossier["ordens"][number]>(dados.ordens),
      documentos: lista<ProcessDossier["documentos"][number]>(dados.documentos),
    } satisfies ProcessDossier;
  });

export const searchProcesses = (busca: string) =>
  apiRequest<unknown>(comFiltros(`${BASE}/processos`, { busca })).then(lista<FoundProcess>);
