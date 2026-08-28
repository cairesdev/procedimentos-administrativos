import { apiRequest } from "@/shared/api/http-client";
import { withPage, type Page } from "@/shared/api/pagination";
import type { DocumentTemplate, IssuedDocument, MarkerCatalog, ScopeOption } from "./types";

/**
 * Peças que este servidor alcança. `todos` traz também as restritas a outros
 * setores — é a tela de administração de modelos, e a API exige
 * `documents:template` para atender.
 */
export const listTemplates = (modulo?: string, todos = false) => {
  const query = new URLSearchParams();
  if (modulo) query.set("modulo", modulo);
  if (todos) query.set("todos", "1");
  return apiRequest<DocumentTemplate[]>(
    `/documentos/modelos${query.size > 0 ? `?${query}` : ""}`,
  );
};

/** Setores que alcançam a peça. Vazio = todos. */
export const listTemplateSectors = (tipo: string) =>
  apiRequest<string[]>(`/documentos/modelos/${tipo}/setores`);

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

/** Escopos possíveis para uma peça nova, com os marcadores de cada um. */
export const listScopes = () => apiRequest<ScopeOption[]>("/documentos/escopos");
