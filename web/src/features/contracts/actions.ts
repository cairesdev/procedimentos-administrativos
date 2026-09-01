"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  contractEditSchema,
  contractItemEditSchema,
  contractSchema,
  type ContractEditInput,
  type ContractInput,
  type ContractItemEditInput,
} from "./schemas";
import type { CreatedContract } from "./types";

const vazioParaIndefinido = (valor?: string) => (valor?.trim() ? valor.trim() : undefined);

export const createContract = async (input: ContractInput) => {
  let created: CreatedContract | undefined;

  const result = await runAction(async () => {
    const { origem, licitacaoId, ataId, itens, fiscalNomeMatricula, dataFim, ...contract } =
      contractSchema.parse(input);

    created = await apiRequest<CreatedContract>(endpoints.contracts, {
      method: "POST",
      body: {
        ...contract,
        dataFim: vazioParaIndefinido(dataFim),
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
    revalidatePath("/processos/contratos");
  }, "Contrato cadastrado");

  return created ? { success: "Contrato cadastrado" } : result;
};

/**
 * Corrigir um item do contrato.
 *
 * A API recusa se a quantidade cair abaixo do que já saiu em solicitação — é
 * ela que sabe o consumido, e a mensagem dela diz quanto foi.
 */
export const updateContractItem = async (
  contractId: string, itemId: string, input: ContractItemEditInput,
) =>
  runAction(async () => {
    const dados = contractItemEditSchema.parse(input);
    await apiRequest(`${endpoints.contracts}/${contractId}/itens/${itemId}`, {
      method: "PUT",
      body: {
        ...dados,
        descricao: vazioParaIndefinido(dados.descricao) ?? null,
        marca: vazioParaIndefinido(dados.marca) ?? null,
      },
    });
    revalidatePath(`/processos/contratos/${contractId}`);
  }, "Item atualizado");

/** Item que já saiu em solicitação não é excluído — a API recusa. */
export const deleteContractItem = async (contractId: string, itemId: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.contracts}/${contractId}/itens/${itemId}`, {
      method: "DELETE",
    });
    revalidatePath(`/processos/contratos/${contractId}`);
  }, "Item excluído");

// Número e itens ficam de fora: solicitações emitidas dependem deles. O valor
// entrou, porque é ele que o teto da licitação mede.
export const updateContract = async (id: string, input: ContractEditInput) =>
  runAction(async () => {
    const { fiscalNomeMatricula, dataFim, ...body } = contractEditSchema.parse(input);
    await apiRequest(`${endpoints.contracts}/${id}`, {
      method: "PATCH",
      body: {
        ...body,
        dataFim: vazioParaIndefinido(dataFim) ?? null,
        fiscalNomeMatricula: vazioParaIndefinido(fiscalNomeMatricula) ?? null,
      },
    });
    revalidatePath("/processos/contratos");
  }, "Contrato atualizado");

export const deleteContract = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.contracts}/${id}`, { method: "DELETE" });
    revalidatePath("/processos/contratos");
  }, "Contrato excluído e processo cancelado");
