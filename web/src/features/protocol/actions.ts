"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/shared/api/http-client";
import { runAction } from "@/shared/api/action-result";
import {
  cancelRequirementSchema, requirementSchema, serviceSchema, subjectSchema,
  type CancelRequirementInput, type RequirementInput, type ServiceInput, type SubjectInput,
} from "./schemas";

const vazio = (valor?: string) => valor?.trim() || undefined;

export const createSubject = async (input: SubjectInput) =>
  runAction(async () => {
    const dados = subjectSchema.parse(input);
    await apiRequest("/protocolo/assuntos", {
      method: "POST",
      body: { ...dados, descricao: vazio(dados.descricao), setorId: vazio(dados.setorId) },
    });
    revalidatePath("/protocolo/assuntos");
  }, "Assunto criado");

export const updateSubject = async (id: string, input: SubjectInput) =>
  runAction(async () => {
    const dados = subjectSchema.parse(input);
    await apiRequest(`/protocolo/assuntos/${id}`, {
      method: "PUT",
      body: { ...dados, descricao: vazio(dados.descricao), setorId: vazio(dados.setorId) },
    });
    revalidatePath("/protocolo/assuntos");
  }, "Assunto atualizado");

export const deleteSubject = async (id: string) =>
  runAction(async () => {
    await apiRequest(`/protocolo/assuntos/${id}`, { method: "DELETE" });
    revalidatePath("/protocolo/assuntos");
  }, "Assunto excluído");

/**
 * Abre o atendimento e leva direto ao processo: quem atendeu no balcão precisa
 * do número na mão para dizer ao cidadão e imprimir o comprovante.
 */
export const openService = async (input: ServiceInput) => {
  let destino = "";

  const resultado = await runAction(async () => {
    const dados = serviceSchema.parse(input);
    const { id } = await apiRequest<{ id: string; protocolo: string }>(
      "/protocolo/atendimentos",
      {
        method: "POST",
        body: {
          assuntoId: dados.assuntoId,
          descricaoPedido: dados.descricaoPedido,
          requerente: {
            tipo: dados.tipo,
            documento: dados.documento,
            nome: dados.nome,
            contatoEmail: vazio(dados.contatoEmail),
            contatoTelefone: vazio(dados.contatoTelefone),
          },
        },
      },
    );
    revalidatePath("/protocolo/atendimentos");
    destino = `/protocolo/atendimentos/${id}`;
  }, "Atendimento aberto");

  // Fora do runAction: `redirect` funciona lançando e viraria falha da ação.
  if (destino) redirect(destino);
  return resultado;
};

export const createRequirement = async (processoId: string, input: RequirementInput) =>
  runAction(async () => {
    const dados = requirementSchema.parse(input);
    await apiRequest(`/protocolo/processos/${processoId}/exigencias`, {
      method: "POST",
      body: dados,
    });
    revalidatePath(`/protocolo/atendimentos/${processoId}`);
    revalidatePath(`/processos/fila/${processoId}`);
  }, "Exigência registrada");

export const cancelRequirement = async (
  processoId: string,
  exigenciaId: string,
  input: CancelRequirementInput,
) =>
  runAction(async () => {
    const dados = cancelRequirementSchema.parse(input);
    await apiRequest(`/protocolo/exigencias/${exigenciaId}/cancelar`, {
      method: "POST",
      body: dados,
    });
    revalidatePath(`/protocolo/atendimentos/${processoId}`);
    revalidatePath(`/processos/fila/${processoId}`);
  }, "Exigência cancelada");
