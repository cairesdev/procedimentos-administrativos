"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/shared/api/http-client";
import { runAction } from "@/shared/api/action-result";
import {
  cancelDocumentSchema, templateSchema,
  type CancelDocumentInput, type TemplateInput,
} from "./schemas";

/**
 * Emite a peça e leva direto para ela: quem clicou quer imprimir, não voltar
 * para a lista e procurar o que acabou de gerar.
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
    destino = `/processos/documentos/${id}`;
  }, "Documento emitido");

  // O redirect fica fora do runAction: ele funciona lançando, e seria
  // confundido com falha da emissão.
  if (destino) redirect(destino);
  return resultado;
};

export const cancelDocument = async (id: string, input: CancelDocumentInput) =>
  runAction(async () => {
    const body = cancelDocumentSchema.parse(input);
    await apiRequest(`/documentos/${id}/cancelar`, { method: "POST", body });
    revalidatePath(`/processos/documentos/${id}`);
  }, "Documento cancelado");

export const saveTemplate = async (tipo: string, input: TemplateInput) =>
  runAction(async () => {
    const body = templateSchema.parse(input);
    await apiRequest(`/documentos/modelos/${tipo}`, { method: "PUT", body });
    revalidatePath("/administracao/documentos");
    revalidatePath(`/administracao/documentos/${tipo}`);
  }, "Modelo salvo");

export const restoreDefaultTemplate = async (tipo: string) =>
  runAction(async () => {
    await apiRequest(`/documentos/modelos/${tipo}`, { method: "DELETE" });
    revalidatePath("/administracao/documentos");
    revalidatePath(`/administracao/documentos/${tipo}`);
  }, "Modelo padrão restaurado");
