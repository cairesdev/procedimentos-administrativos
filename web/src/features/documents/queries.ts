import { apiRequest } from "@/shared/api/http-client";
import { withPage, type Page } from "@/shared/api/pagination";
import type { DocumentTemplate, IssuedDocument, MarkerCatalog } from "./types";

export const listTemplates = (modulo?: string) =>
  apiRequest<DocumentTemplate[]>(
    `/documentos/modelos${modulo ? `?modulo=${modulo}` : ""}`,
  );

export const findTemplate = (tipo: string) =>
  apiRequest<DocumentTemplate>(`/documentos/modelos/${tipo}`);

export const getMarkerCatalog = (tipo: string) =>
  apiRequest<MarkerCatalog>(`/documentos/modelos/${tipo}/marcadores`);

/** Peças já emitidas para um processo, ordem ou solicitação. */
export const listDocumentsFor = (referenciaId: string) =>
  apiRequest<IssuedDocument[]>(`/documentos?referencia=${referenciaId}`);

export const listDocuments = (pagina?: string) => {
  const query = withPage(new URLSearchParams(), pagina);
  return apiRequest<Page<IssuedDocument>>(
    `/documentos${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const findDocument = (id: string) =>
  apiRequest<IssuedDocument>(`/documentos/${id}`);
