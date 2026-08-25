"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/shared/api/http-client";
import { runAction } from "@/shared/api/action-result";
import {
  serviceSchema, subjectSchema, type ServiceInput, type SubjectInput,
} from "./schemas";

const vazio = (valor?: string) => valor?.trim() || undefined;

export const createSubject = async (input: SubjectInput) =>
  runAction(async () => {
    const dados = subjectSchema.parse(input);
    await apiRequest("/protocolo/assuntos", {
      method: "POST",
      body: { ...dados, descricao: vazio(dados.descricao), setorId: vazio(dados.setorId) },
    });
    revalidatePath("/administracao/assuntos");
  }, "Assunto criado");

export const updateSubject = async (id: string, input: SubjectInput) =>
  runAction(async () => {
    const dados = subjectSchema.parse(input);
    await apiRequest(`/protocolo/assuntos/${id}`, {
      method: "PUT",
      body: { ...dados, descricao: vazio(dados.descricao), setorId: vazio(dados.setorId) },
    });
    revalidatePath("/administracao/assuntos");
  }, "Assunto atualizado");

export const deleteSubject = async (id: string) =>
  runAction(async () => {
    await apiRequest(`/protocolo/assuntos/${id}`, { method: "DELETE" });
    revalidatePath("/administracao/assuntos");
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
    revalidatePath("/processos/protocolo");
    destino = `/processos/fila/${id}`;
  }, "Atendimento aberto");

  // Fora do runAction: `redirect` funciona lançando e viraria falha da ação.
  if (destino) redirect(destino);
  return resultado;
};
