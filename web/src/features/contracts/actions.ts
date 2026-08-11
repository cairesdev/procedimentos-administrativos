"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  contractEditSchema,
  contractSchema,
  type ContractEditInput,
  type ContractInput,
} from "./schemas";
import type { CreatedContract } from "./types";

const vazioParaIndefinido = (valor?: string) => (valor?.trim() ? valor.trim() : undefined);

export const createContract = async (input: ContractInput) => {
  let created: CreatedContract | undefined;

  const result = await runAction(async () => {
    const { origem, licitacaoId, ataId, itens, fiscalNomeMatricula, ...contract } =
      contractSchema.parse(input);

    created = await apiRequest<CreatedContract>(endpoints.contracts, {
      method: "POST",
      body: {
        ...contract,
        fiscalNomeMatricula: vazioParaIndefinido(fiscalNomeMatricula),
        licitacaoId: origem === "LICITACAO" ? licitacaoId : undefined,
        ataId: origem === "ATA" ? ataId : undefined,
        // O editor de itens usa "quantidade"; a API guarda como quantidadeTotal.
        itens: itens.map(({ quantidade, descricao, marca, ...item }) => ({
          ...item,
          quantidadeTotal: quantidade,
          descricao: vazioParaIndefinido(descricao),
          marca: vazioParaIndefinido(marca),
        })),
      },
    });
    revalidatePath("/contratos");
  }, "Contrato cadastrado");

  return created
    ? { success: `Contrato cadastrado — protocolo ${created.numeroProtocolo}` }
    : result;
};

// Valor, número e itens ficam de fora: solicitações emitidas dependem deles.
export const updateContract = async (id: string, input: ContractEditInput) =>
  runAction(async () => {
    const { fiscalNomeMatricula, ...body } = contractEditSchema.parse(input);
    await apiRequest(`${endpoints.contracts}/${id}`, {
      method: "PATCH",
      body: { ...body, fiscalNomeMatricula: vazioParaIndefinido(fiscalNomeMatricula) },
    });
    revalidatePath("/contratos");
  }, "Contrato atualizado");

export const deleteContract = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.contracts}/${id}`, { method: "DELETE" });
    revalidatePath("/contratos");
  }, "Contrato excluído e processo cancelado");
