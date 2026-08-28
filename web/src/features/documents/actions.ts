"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/shared/api/http-client";
import { runAction } from "@/shared/api/action-result";
import {
  cancelDocumentSchema, newTemplateSchema, templateSchema,
  type CancelDocumentInput, type NewTemplateInput, type TemplateInput,
} from "./schemas";

/**
 * Prepara a peça e leva direto para ela, agora em rascunho: o usuário revisa
 * o texto e as datas antes de emitir.
 */
export const issueDocument = async (input: {
  tipo: string;
  referenciaId: string;
  voltarPara: string;
}) => {
  let destino = "";

  const resultado = await runAction(async () => {
    const { id } = await apiRequest<{ id: string; codigo: string }>("/documentos", {
      method: "POST",
      body: { tipo: input.tipo, referenciaId: input.referenciaId },
    });
    revalidatePath(input.voltarPara);
    // `voltar` carrega a tela de origem: a peça é a mesma em qualquer módulo,
    // e sem isso o botão de voltar teria de chutar um destino.
    destino = `/documentos/${id}?voltar=${encodeURIComponent(input.voltarPara)}`;
  }, "Documento pronto para revisão");

  // O redirect fica fora do runAction: ele funciona lançando, e seria
  // confundido com falha da emissão.
  if (destino) redirect(destino);
  return resultado;
};

/** Salva o texto revisado. Só vale enquanto a peça é rascunho. */
export const saveDraftBody = async (id: string, corpo: string) =>
  runAction(async () => {
    await apiRequest(`/documentos/${id}/corpo`, { method: "PUT", body: { corpo } });
    revalidatePath(`/documentos/${id}`);
  }, "Texto salvo");

/** Confirma a emissão: a peça ganha data e passa a valer na conferência. */
export const issueDraft = async (id: string, voltarPara: string) => {
  let emitido = false;

  const resultado = await runAction(async () => {
    await apiRequest(`/documentos/${id}/emitir`, { method: "POST" });
    revalidatePath(`/documentos/${id}`);
    revalidatePath(voltarPara);
    emitido = true;
  }, "Documento emitido");

  // Recarrega na mesma URL: a peça agora sai sem o editor, com data e QR.
  if (emitido) redirect(`/documentos/${id}?voltar=${encodeURIComponent(voltarPara)}`);
  return resultado;
};

/** Descarta o rascunho e volta para a tela de origem. */
export const discardDraft = async (id: string, voltarPara: string) => {
  let descartado = false;

  const resultado = await runAction(async () => {
    await apiRequest(`/documentos/${id}`, { method: "DELETE" });
    revalidatePath(voltarPara);
    descartado = true;
  }, "Rascunho descartado");

  if (descartado) redirect(voltarPara);
  return resultado;
};

export const cancelDocument = async (id: string, input: CancelDocumentInput) =>
  runAction(async () => {
    const body = cancelDocumentSchema.parse(input);
    await apiRequest(`/documentos/${id}/cancelar`, { method: "POST", body });
    revalidatePath(`/documentos/${id}`);
  }, "Documento cancelado");

export const saveTemplate = async (tipo: string, input: TemplateInput) =>
  runAction(async () => {
    const body = templateSchema.parse(input);
    await apiRequest(`/documentos/modelos/${tipo}`, { method: "PUT", body });
    revalidatePath("/administracao/documentos");
    revalidatePath(`/administracao/documentos/${tipo}`);
  }, "Modelo salvo");

/**
 * Amarra a peça a setores. Lista vazia devolve a peça a todo mundo.
 *
 * Só a versão da prefeitura aceita restrição: mexer no modelo global daqui
 * mudaria a regra de todas as outras prefeituras de uma vez.
 */
export const saveTemplateSectors = async (tipo: string, setores: string[]) =>
  runAction(async () => {
    await apiRequest(`/documentos/modelos/${tipo}/setores`, {
      method: "PUT",
      body: { setores },
    });
    revalidatePath(`/administracao/documentos/${tipo}`);
  }, "Setores atualizados");

export const restoreDefaultTemplate = async (tipo: string) =>
  runAction(async () => {
    await apiRequest(`/documentos/modelos/${tipo}`, { method: "DELETE" });
    revalidatePath("/administracao/documentos");
    revalidatePath(`/administracao/documentos/${tipo}`);
  }, "Modelo padrão restaurado");

/** Peça nova, criada pela prefeitura. O tipo sai do nome, na API. */
export const createTemplate = async (input: NewTemplateInput) => {
  let destino = "";

  const resultado = await runAction(async () => {
    const body = newTemplateSchema.parse(input);
    const { tipo } = await apiRequest<{ id: string; tipo: string }>("/documentos/modelos", {
      method: "POST",
      body,
    });
    revalidatePath("/administracao/documentos");
    destino = `/administracao/documentos/${tipo}`;
  }, "Documento criado");

  // Fora do runAction: `redirect` funciona lançando e seria lido como falha.
  if (destino) redirect(destino);
  return resultado;
};

/** Exclui de vez — só peça criada pela própria prefeitura. */
export const deleteTemplate = async (tipo: string) =>
  runAction(async () => {
    await apiRequest(`/documentos/modelos/${tipo}/excluir`, { method: "DELETE" });
    revalidatePath("/administracao/documentos");
  }, "Documento excluído");
