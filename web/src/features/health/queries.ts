import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { comFiltros } from "@/shared/api/filtros";
import type { Page } from "@/shared/api/pagination";
import type {
  CnesEstablishment, CnesMunicipality, HealthUnit, Patient, PatientSummary,
  VisitRecord, VisitSummary,
} from "./types";

export const listHealthUnits = () => apiRequest<HealthUnit[]>(endpoints.healthUnits);

export const findHealthUnit = (id: string) =>
  apiRequest<HealthUnit>(`${endpoints.healthUnits}/${id}`);

/**
 * A API aberta do CNES não busca estabelecimento por nome — só por município.
 *
 * Por isso a tela pergunta o município primeiro. A limitação é do serviço do
 * Ministério, e desenhar a tela contra ela é mais honesto que fingir uma busca
 * que filtraria no cliente.
 */
export const searchCnesMunicipalities = (nome: string) =>
  apiRequest<CnesMunicipality[]>(comFiltros(endpoints.cnesMunicipalities, { nome }));

export const listCnesEstablishments = (codigoMunicipio: string) =>
  apiRequest<CnesEstablishment[]>(endpoints.cnesByMunicipality(codigoMunicipio));

export const searchPatients = (termo: string, pagina?: string) =>
  apiRequest<Page<PatientSummary>>(comFiltros(endpoints.patients, { termo, pagina }));

export const findPatient = (id: string) =>
  apiRequest<Patient>(`${endpoints.patients}/${id}`);

/**
 * O histórico de visitas — e a única leitura que entra na auditoria.
 *
 * `completo` derruba o corte de doze meses. O corte é a série de trabalho, e
 * não expurgo: nada foi apagado, e o histórico completo alcança os vinte anos
 * de guarda.
 */
export const listPatientHistory = (id: string, completo = false) =>
  apiRequest<VisitSummary[]>(
    comFiltros(endpoints.patientHistory(id), { completo: completo ? "true" : undefined }),
  );

export const listVisits = (filtros: {
  termo?: string; status?: string; unidade?: string; pagina?: string; completo?: boolean;
} = {}) => {
  const { completo, ...resto } = filtros;
  return apiRequest<Page<VisitSummary>>(
    comFiltros(endpoints.visits, { ...resto, ...(completo ? { completo: "true" } : {}) }),
  );
};

export const findVisit = (id: string) => apiRequest<VisitRecord>(endpoints.visit(id));
