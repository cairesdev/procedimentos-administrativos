"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  checklistSchema, dismissSchema, fulfillSchema, refuseSchema, templateSchema,
  type ChecklistInput, type DismissInput, type FulfillInput, type RefuseInput,
  type TemplateInput,
} from "./schemas";

const BASE = "/checklists";

const semVazio = (valor?: string) => valor?.trim() || undefined;

/**
 * "setor:<uuid>" | "departamento:<uuid>" | "fornecedor" — um `<select>`
 * devolve um valor, e o destino tem duas partes.
 */
const destinoDe = (valor?: string) => {
  const [tipo, id] = (valor ?? "").split(":");
  if (tipo === "fornecedor") return { paraFornecedor: true };
  if (tipo === "setor" && id) return { setorId: id };
  if (tipo === "departamento" && id) return { departamentoId: id };
  return {};
};

const itemParaApi = (item: {
  titulo: string; descricao?: string; exigeAnexo?: boolean; recorrente?: boolean;
  periodicidadeDias?: number | null; responsavel?: string;
}) => ({
  titulo: item.titulo,
  descricao: semVazio(item.descricao) ?? null,
  exigeAnexo: item.exigeAnexo ?? false,
  recorrente: item.recorrente ?? false,
  // Periodicidade só existe em item recorrente: mandá-la junto com
  // `recorrente: false` seria recusado pelo CHECK do banco.
  periodicidadeDias: item.recorrente ? (item.periodicidadeDias ?? null) : null,
  paraFornecedor: false,
  setorId: null,
  departamentoId: null,
  ...destinoDe(item.responsavel),
});

// ---------------------------------------------------------------------------
// Modelos

export const createTemplate = async (input: TemplateInput) =>
  runAction(async () => {
    const dados = templateSchema.parse(input);
    await apiRequest(endpoints.checklistTemplates, {
      method: "POST",
      body: {
        nome: dados.nome,
        descricao: semVazio(dados.descricao) ?? null,
        ativo: dados.ativo,
        itens: dados.itens.map((item) => ({
          ...itemParaApi(item),
          prazoDias: item.prazoDias ?? null,
        })),
      },
    });
    revalidatePath(`${BASE}/modelos`);
  }, "Modelo criado");

export const updateTemplate = async (id: string, input: TemplateInput) =>
  runAction(async () => {
    const dados = templateSchema.parse(input);
    await apiRequest(`${endpoints.checklistTemplates}/${id}`, {
      method: "PUT",
      body: {
        nome: dados.nome,
        descricao: semVazio(dados.descricao) ?? null,
        ativo: dados.ativo,
        itens: dados.itens.map((item) => ({
          ...itemParaApi(item),
          prazoDias: item.prazoDias ?? null,
        })),
      },
    });
    revalidatePath(`${BASE}/modelos`);
  }, "Modelo atualizado");

export const deleteTemplate = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.checklistTemplates}/${id}`, { method: "DELETE" });
    revalidatePath(`${BASE}/modelos`);
  }, "Modelo excluído");

// ---------------------------------------------------------------------------
// Checklists

export const createChecklist = async (input: ChecklistInput) =>
  runAction(async () => {
    const dados = checklistSchema.parse(input);
    await apiRequest(endpoints.checklists, {
      method: "POST",
      body: {
        titulo: semVazio(dados.titulo),
        descricao: semVazio(dados.descricao) ?? null,
        modeloId: semVazio(dados.modeloId) ?? null,
        alvoTipo: dados.alvoTipo ?? null,
        alvoId: semVazio(dados.alvoId) ?? null,
        ...destinoDe(dados.responsavel),
        itens: dados.itens?.map((item) => ({
          ...itemParaApi(item),
          prazoLimite: semVazio(item.prazoLimite) ?? null,
        })),
      },
    });
    revalidatePath(BASE);
  }, "Checklist criado");

export const deleteChecklist = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.checklists}/${id}`, { method: "DELETE" });
    revalidatePath(BASE);
  }, "Checklist excluído");

// ---------------------------------------------------------------------------
// O ciclo do item

/**
 * Devolve o id do ciclo aberto, porque o anexo pende dele.
 *
 * `runAction` descarta o retorno, e aqui ele é necessário: a tela sobe o
 * arquivo contra o ciclo que acabou de nascer.
 */
export const fulfillItem = async (
  checklistId: string, itemId: string, input: FulfillInput,
): Promise<{ success?: string; error?: string; cumprimentoId?: string }> => {
  try {
    const { observacao } = fulfillSchema.parse(input);
    const criado = await apiRequest<{ id: string }>(
      `${endpoints.checklists}/${checklistId}/itens/${itemId}/cumprir`,
      { method: "POST", body: { observacao: semVazio(observacao) ?? null } },
    );
    revalidatePath(`${BASE}/${checklistId}`);
    return { success: "Entrega registrada", cumprimentoId: criado.id };
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Não foi possível registrar" };
  }
};

export const acceptItem = async (checklistId: string, itemId: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.checklists}/${checklistId}/itens/${itemId}/conferir`, {
      method: "POST",
      body: { aceitar: true },
    });
    revalidatePath(`${BASE}/${checklistId}`);
  }, "Item aceito");

export const refuseItem = async (
  checklistId: string, itemId: string, input: RefuseInput,
) =>
  runAction(async () => {
    const { recusaMotivo } = refuseSchema.parse(input);
    await apiRequest(`${endpoints.checklists}/${checklistId}/itens/${itemId}/conferir`, {
      method: "POST",
      body: { aceitar: false, recusaMotivo },
    });
    revalidatePath(`${BASE}/${checklistId}`);
  }, "Item recusado — quem cumpriu vê o motivo");

export const dismissItem = async (
  checklistId: string, itemId: string, input: DismissInput,
) =>
  runAction(async () => {
    const { motivo } = dismissSchema.parse(input);
    await apiRequest(`${endpoints.checklists}/${checklistId}/itens/${itemId}/dispensar`, {
      method: "POST",
      body: { motivo },
    });
    revalidatePath(`${BASE}/${checklistId}`);
  }, "Item dispensado");

export const reopenItem = async (checklistId: string, itemId: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.checklists}/${checklistId}/itens/${itemId}/reabrir`, {
      method: "POST",
    });
    revalidatePath(`${BASE}/${checklistId}`);
  }, "Item reaberto");
