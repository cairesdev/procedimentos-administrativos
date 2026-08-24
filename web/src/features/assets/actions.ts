"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  assetCategorySchema,
  assetEditSchema,
  assetIntakeEditSchema,
  assetIntakeSchema,
  assetLocationSchema,
  inventoryCheckSchema,
  inventorySchema,
  transferSchema,
  writeOffSchema,
  type AssetCategoryInput,
  type AssetEditInput,
  type AssetIntakeEditInput,
  type AssetIntakeInput,
  type AssetLocationInput,
  type InventoryCheckInput,
  type InventoryInput,
  type TransferInput,
  type WriteOffInput,
} from "./schemas";

const LOCATIONS = "/patrimonio/locais";
const CATEGORIES = "/patrimonio/categorias";
const INTAKES = "/patrimonio/entradas";
const ASSETS = "/patrimonio/bens";
const INVENTORIES = "/patrimonio/inventarios";
const TRANSFERS = "/patrimonio/transferencias";

const blankToUndefined = (value?: string) => value?.trim() || undefined;

export const createAssetLocation = async (input: AssetLocationInput) =>
  runAction(async () => {
    const { unidadeId, ...body } = assetLocationSchema.parse(input);
    await apiRequest(endpoints.assetLocations, {
      method: "POST",
      body: { ...body, unidadeId: blankToUndefined(unidadeId) },
    });
    revalidatePath(LOCATIONS);
  }, "Local cadastrado");

export const updateAssetLocation = async (id: string, input: AssetLocationInput) =>
  runAction(async () => {
    // O código do local participa do tombamento — a API não permite trocá-lo.
    const { nome, unidadeId } = assetLocationSchema.parse(input);
    await apiRequest(`${endpoints.assetLocations}/${id}`, {
      method: "PATCH",
      body: { nome, unidadeId: blankToUndefined(unidadeId) ?? null },
    });
    revalidatePath(LOCATIONS);
  }, "Local atualizado");

export const setAssetLocationActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await apiRequest(`${endpoints.assetLocations}/${id}`, {
      method: "PATCH",
      body: { ativo: active },
    });
    revalidatePath(LOCATIONS);
  }, active ? "Local reativado" : "Local inativado");

export const deleteAssetLocation = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.assetLocations}/${id}`, { method: "DELETE" });
    revalidatePath(LOCATIONS);
  }, "Local excluído");

// Devolve o id porque o assistente de entrada já seleciona a categoria criada.
export const createAssetCategory = async (input: AssetCategoryInput) => {
  let created: { id: string } | undefined;

  const result = await runAction(async () => {
    const body = assetCategorySchema.parse(input);
    created = await apiRequest<{ id: string }>(endpoints.assetCategories, {
      method: "POST",
      body,
    });
    revalidatePath(CATEGORIES);
    revalidatePath(INTAKES);
  }, "Categoria cadastrada");

  return created ? { ...result, id: created.id } : result;
};

export const updateAssetCategory = async (id: string, input: AssetCategoryInput) =>
  runAction(async () => {
    const body = assetCategorySchema.parse(input);
    await apiRequest(`${endpoints.assetCategories}/${id}`, { method: "PATCH", body });
    revalidatePath(CATEGORIES);
  }, "Categoria atualizada");

export const setAssetCategoryActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await apiRequest(`${endpoints.assetCategories}/${id}`, {
      method: "PATCH",
      body: { ativo: active },
    });
    revalidatePath(CATEGORIES);
  }, active ? "Categoria reativada" : "Categoria inativada");

export const deleteAssetCategory = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.assetCategories}/${id}`, { method: "DELETE" });
    revalidatePath(CATEGORIES);
  }, "Categoria excluída");

type IntakeCreated = {
  id: string;
  bens: number;
  primeiroTombamento?: string;
  ultimoTombamento?: string;
};

// Uma remessa gera N bens tombados; a API devolve a faixa de códigos gerada.
export const createAssetIntake = async (input: AssetIntakeInput) => {
  let created: IntakeCreated | undefined;

  const result = await runAction(async () => {
    const { fornecedorId, notaFiscal, ...body } = assetIntakeSchema.parse(input);
    created = await apiRequest<IntakeCreated>(endpoints.assetIntakes, {
      method: "POST",
      body: {
        ...body,
        fornecedorId: blankToUndefined(fornecedorId),
        notaFiscal: blankToUndefined(notaFiscal),
      },
    });
    revalidatePath(INTAKES);
    revalidatePath(ASSETS);
  }, "Entrada registrada");

  if (!created) return result;
  const faixa =
    created.primeiroTombamento && created.ultimoTombamento
      ? created.primeiroTombamento === created.ultimoTombamento
        ? ` — ${created.primeiroTombamento}`
        : ` — ${created.primeiroTombamento} a ${created.ultimoTombamento}`
      : "";

  return {
    ...result,
    id: created.id,
    success: `${created.bens} ${created.bens === 1 ? "bem tombado" : "bens tombados"}${faixa}`,
  };
};

export const updateAssetIntake = async (id: string, input: AssetIntakeEditInput) =>
  runAction(async () => {
    const { data, fornecedorId, notaFiscal } = assetIntakeEditSchema.parse(input);
    await apiRequest(`${endpoints.assetIntakes}/${id}`, {
      method: "PATCH",
      body: {
        data,
        fornecedorId: blankToUndefined(fornecedorId) ?? null,
        notaFiscal: blankToUndefined(notaFiscal) ?? null,
      },
    });
    revalidatePath(INTAKES);
  }, "Entrada atualizada");

// Apaga os bens da entrada. O contador do local não volta: tombamento
// não se reaproveita, a etiqueta já pode ter ido para a rua.
export const deleteAssetIntake = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.assetIntakes}/${id}`, { method: "DELETE" });
    revalidatePath(INTAKES);
    revalidatePath(ASSETS);
  }, "Entrada excluída");

export const updateAsset = async (id: string, input: AssetEditInput) =>
  runAction(async () => {
    const body = assetEditSchema.parse(input);
    await apiRequest(`${endpoints.assets}/${id}`, { method: "PATCH", body });
    revalidatePath(ASSETS);
  }, "Bem atualizado");

export const deleteAsset = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.assets}/${id}`, { method: "DELETE" });
    revalidatePath(ASSETS);
  }, "Bem excluído");

export const openInventory = async (input: InventoryInput) => {
  let created: { id: string } | undefined;

  const result = await runAction(async () => {
    const body = inventorySchema.parse(input);
    created = await apiRequest<{ id: string }>(endpoints.inventories, { method: "POST", body });
    revalidatePath(INVENTORIES);
  }, "Inventário aberto");

  return created ? { ...result, id: created.id } : result;
};

export const registerInventoryChecks = async (
  inventoryId: string,
  input: InventoryCheckInput,
) =>
  runAction(async () => {
    const body = inventoryCheckSchema.parse(input);
    await apiRequest(endpoints.inventoryChecks(inventoryId), { method: "POST", body });
    revalidatePath(`${INVENTORIES}/${inventoryId}`);
  }, "Conferência registrada");

export const closeInventory = async (inventoryId: string) =>
  runAction(async () => {
    await apiRequest(endpoints.closeInventory(inventoryId), { method: "POST" , body: {} });
    revalidatePath(`${INVENTORIES}/${inventoryId}`);
    revalidatePath(INVENTORIES);
    revalidatePath(ASSETS);
  }, "Inventário concluído");


// ---- Transferência entre locais --------------------------------------------

/** Só cria o pedido: o bem continua no local de origem até o destino aceitar. */
export const transferAsset = async (assetId: string, input: TransferInput) =>
  runAction(async () => {
    const body = transferSchema.parse(input);
    await apiRequest(endpoints.transferAsset(assetId), { method: "POST", body });
    revalidatePath(ASSETS);
    revalidatePath(TRANSFERS);
  }, "Transferência enviada — aguardando aceite do destino");

export const acceptTransfer = async (id: string) =>
  runAction(async () => {
    await apiRequest(endpoints.transferAction(id, "aceitar"), { method: "POST", body: {} });
    revalidatePath(ASSETS);
    revalidatePath(TRANSFERS);
    revalidatePath(LOCATIONS);
  }, "Transferência aceita — o bem mudou de local");

export const refuseTransfer = async (id: string) =>
  runAction(async () => {
    await apiRequest(endpoints.transferAction(id, "recusar"), { method: "POST", body: {} });
    revalidatePath(TRANSFERS);
  }, "Transferência recusada — o bem fica onde está");

// ---- Baixa formal ----------------------------------------------------------

/** O bem sai do ativo e continua no histórico com o motivo. Não tem estorno. */
export const writeOffAsset = async (assetId: string, input: WriteOffInput) =>
  runAction(async () => {
    const dados = writeOffSchema.parse(input);
    await apiRequest(endpoints.writeOffAsset(assetId), {
      method: "POST",
      body: { motivo: dados.motivo, observacao: blankToUndefined(dados.observacao) },
    });
    revalidatePath(ASSETS);
    revalidatePath(LOCATIONS);
  }, "Baixa registrada");
