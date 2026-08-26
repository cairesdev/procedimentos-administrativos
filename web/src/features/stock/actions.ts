"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  intakeSchema, receiptSchema, refuseSchema, releaseSchema, stockLocationSchema,
  stockRequestSchema, stockSettingsSchema, stockTypeSchema, warehouseSchema,
  type IntakeInput, type ReceiptInput, type RefuseInput, type ReleaseInput,
  type StockLocationInput, type StockRequestInput, type StockSettingsInput,
  type StockTypeInput, type WarehouseInput,
} from "./schemas";

const WAREHOUSES = "/almoxarifado/almoxarifados";
const TYPES = "/almoxarifado/tipos";
const LOCATIONS = "/almoxarifado/locais";
const INTAKES = "/almoxarifado/entradas";
const REQUESTS = "/almoxarifado/solicitacoes";

/** Campo em branco não é valor: vai como ausente, não como string vazia. */
const semVazio = (valor?: string) => valor?.trim() || undefined;

// ---------------------------------------------------------------------------
// Cadastros

export const createWarehouse = async (input: WarehouseInput) =>
  runAction(async () => {
    const { nome } = warehouseSchema.parse(input);
    await apiRequest(endpoints.warehouses, { method: "POST", body: { nome } });
    revalidatePath(WAREHOUSES);
  }, "Almoxarifado cadastrado");

export const updateWarehouse = async (id: string, input: WarehouseInput) =>
  runAction(async () => {
    await apiRequest(`${endpoints.warehouses}/${id}`, {
      method: "PUT",
      body: warehouseSchema.parse(input),
    });
    revalidatePath(WAREHOUSES);
  }, "Almoxarifado atualizado");

export const deleteWarehouse = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.warehouses}/${id}`, { method: "DELETE" });
    revalidatePath(WAREHOUSES);
  }, "Almoxarifado excluído");

export const createStockType = async (input: StockTypeInput) =>
  runAction(async () => {
    const { nome } = stockTypeSchema.parse(input);
    await apiRequest(endpoints.stockTypes, { method: "POST", body: { nome } });
    revalidatePath(TYPES);
  }, "Tipo cadastrado");

export const updateStockType = async (id: string, input: StockTypeInput) =>
  runAction(async () => {
    await apiRequest(`${endpoints.stockTypes}/${id}`, {
      method: "PUT",
      body: stockTypeSchema.parse(input),
    });
    revalidatePath(TYPES);
  }, "Tipo atualizado");

export const deleteStockType = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.stockTypes}/${id}`, { method: "DELETE" });
    revalidatePath(TYPES);
  }, "Tipo excluído");

export const saveStockSettings = async (input: StockSettingsInput) =>
  runAction(async () => {
    await apiRequest(endpoints.stockSettings, {
      method: "PUT",
      body: stockSettingsSchema.parse(input),
    });
    revalidatePath("/almoxarifado/configuracao");
  }, "Configuração salva");

export const saveStockLocation = async (id: string, input: StockLocationInput) =>
  runAction(async () => {
    const dados = stockLocationSchema.parse(input);
    await apiRequest(`${endpoints.stockLocations}/${id}`, {
      method: "PUT",
      body: {
        almoxarifadoId: dados.almoxarifadoId,
        cnpj: semVazio(dados.cnpj) ?? null,
        endereco: semVazio(dados.endereco) ?? null,
        bairro: semVazio(dados.bairro) ?? null,
        municipio: semVazio(dados.municipio) ?? null,
        uf: semVazio(dados.uf)?.toUpperCase() ?? null,
        cep: semVazio(dados.cep) ?? null,
        telefone: semVazio(dados.telefone) ?? null,
        email: semVazio(dados.email) ?? null,
        responsavel: semVazio(dados.responsavel) ?? null,
      },
    });
    revalidatePath(LOCATIONS);
  }, "Local atualizado");

// ---------------------------------------------------------------------------
// Entrada

export const registerIntake = async (input: IntakeInput) => {
  let destino = "";

  const resultado = await runAction(async () => {
    const dados = intakeSchema.parse(input);
    const { id } = await apiRequest<{ id: string; lotes: number }>(endpoints.intakes, {
      method: "POST",
      body: {
        ...dados,
        localArmazenado: semVazio(dados.localArmazenado),
        notaFiscal: semVazio(dados.notaFiscal),
        fornecedorId: semVazio(dados.fornecedorId),
        linhas: dados.linhas.map((linha) => ({
          ...linha,
          dataValidade: linha.dataValidade || null,
        })),
      },
    });
    revalidatePath(INTAKES);
    destino = `${INTAKES}/${id}`;
  }, "Entrada registrada");

  // Fora do runAction: `redirect` funciona lançando e seria lido como falha.
  if (destino) redirect(destino);
  return resultado;
};

export const deleteBatch = async (id: string) =>
  runAction(async () => {
    await apiRequest(endpoints.batch(id), { method: "DELETE" });
    revalidatePath(INTAKES);
  }, "Lote excluído");

// ---------------------------------------------------------------------------
// Ciclo do pedido

export const createStockRequest = async (input: StockRequestInput) => {
  let destino = "";

  const resultado = await runAction(async () => {
    const { id } = await apiRequest<{ id: string }>(endpoints.stockRequests, {
      method: "POST",
      body: stockRequestSchema.parse(input),
    });
    revalidatePath(REQUESTS);
    destino = `${REQUESTS}/${id}`;
  }, "Pedido salvo como rascunho");

  if (destino) redirect(destino);
  return resultado;
};

export const sendStockRequest = async (id: string) =>
  runAction(async () => {
    await apiRequest(endpoints.stockRequestAction(id, "enviar"), { method: "POST" });
    revalidatePath(REQUESTS);
    revalidatePath(`${REQUESTS}/${id}`);
  }, "Pedido enviado — o saldo ficou reservado");

export const cancelStockRequest = async (id: string) =>
  runAction(async () => {
    await apiRequest(endpoints.stockRequestAction(id, "cancelar"), { method: "POST" });
    revalidatePath(REQUESTS);
    revalidatePath(`${REQUESTS}/${id}`);
  }, "Pedido cancelado");

export const releaseStockRequest = async (id: string, input: ReleaseInput) =>
  runAction(async () => {
    await apiRequest(endpoints.stockRequestAction(id, "liberar"), {
      method: "POST",
      // Zero é filtrado na API: a tela manda a linha inteira, inclusive os
      // lotes que o almoxarife zerou.
      body: releaseSchema.parse(input),
    });
    revalidatePath(REQUESTS);
    revalidatePath(`${REQUESTS}/${id}`);
  }, "Material liberado");

export const refuseStockRequest = async (id: string, input: RefuseInput) =>
  runAction(async () => {
    await apiRequest(endpoints.stockRequestAction(id, "recusar"), {
      method: "POST",
      body: refuseSchema.parse(input),
    });
    revalidatePath(REQUESTS);
    revalidatePath(`${REQUESTS}/${id}`);
  }, "Pedido recusado");

export const confirmReceipt = async (id: string, input: ReceiptInput) =>
  runAction(async () => {
    await apiRequest(endpoints.stockRequestAction(id, "receber"), {
      method: "POST",
      body: receiptSchema.parse(input),
    });
    revalidatePath(REQUESTS);
    revalidatePath(`${REQUESTS}/${id}`);
  }, "Recebimento confirmado");
