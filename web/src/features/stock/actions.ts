"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  adjustmentSchema, consumptionSchema, intakeSchema, receiptSchema, refuseSchema,
  releaseSchema, returnSchema, stockLocationSchema, stockRequestSchema,
  stockSettingsSchema, stockTypeSchema, transferSchema, warehouseSchema,
  consumptionReportSchema, type ConsumptionReportInput,
  type AdjustmentInput, type ConsumptionInput, type IntakeInput, type ReceiptInput,
  type RefuseInput, type ReleaseInput, type ReturnInput, type StockLocationInput,
  type StockRequestInput, type StockSettingsInput, type StockTypeInput,
  type TransferInput, type WarehouseInput,
} from "./schemas";

const WAREHOUSES = "/almoxarifado/almoxarifados";
const TYPES = "/almoxarifado/tipos";
const LOCATIONS = "/almoxarifado/locais";
const INTAKES = "/almoxarifado/entradas";
const REQUESTS = "/almoxarifado/solicitacoes";
const REPORTS = "/almoxarifado/relatorios";

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

// ---------------------------------------------------------------------------
// Movimento

const CONSUMPTION = "/almoxarifado/consumo";
const RETURNS = "/almoxarifado/devolucoes";
const TRANSFERS = "/almoxarifado/transferencias";
const ADJUSTMENTS = "/almoxarifado/ajustes";
const LOCAL_STOCK = "/almoxarifado/estoque";

export const registerConsumption = async (input: ConsumptionInput) =>
  runAction(async () => {
    const dados = consumptionSchema.parse(input);
    await apiRequest(endpoints.consumption, {
      method: "POST",
      body: {
        ...dados,
        // Período em branco não é período: item a item o rejeita, e string
        // vazia passaria pelo `optional` do Zod.
        periodoInicio: semVazio(dados.periodoInicio),
        periodoFim: semVazio(dados.periodoFim),
        observacao: semVazio(dados.observacao),
      },
    });
    revalidatePath(CONSUMPTION);
    revalidatePath(LOCAL_STOCK);
  }, "Consumo registrado");

export const requestReturn = async (input: ReturnInput) =>
  runAction(async () => {
    await apiRequest(endpoints.returns, { method: "POST", body: returnSchema.parse(input) });
    revalidatePath(RETURNS);
    revalidatePath(LOCAL_STOCK);
  }, "Devolução enviada para aceite");

export const answerReturn = async (id: string, aceitar: boolean, motivoRecusa?: string) =>
  runAction(async () => {
    await apiRequest(endpoints.answerReturn(id), {
      method: "POST",
      body: { aceitar, motivoRecusa: semVazio(motivoRecusa) },
    });
    revalidatePath(RETURNS);
  }, aceitar ? "Devolução aceita" : "Devolução recusada");

export const transferBetweenWarehouses = async (input: TransferInput) =>
  runAction(async () => {
    const dados = transferSchema.parse(input);
    await apiRequest(endpoints.stockTransfers, {
      method: "POST",
      body: { ...dados, motivo: semVazio(dados.motivo) },
    });
    revalidatePath(TRANSFERS);
    revalidatePath(INTAKES);
  }, "Transferência registrada");

export const adjustStock = async (input: AdjustmentInput) =>
  runAction(async () => {
    const dados = adjustmentSchema.parse(input);
    await apiRequest(endpoints.adjustments, {
      method: "POST",
      body: { ...dados, observacao: semVazio(dados.observacao) },
    });
    revalidatePath(ADJUSTMENTS);
    revalidatePath(LOCAL_STOCK);
    revalidatePath(INTAKES);
  }, "Ajuste registrado");


// ---------------------------------------------------------------------------
// Relatório de consumo (PNAE)

export const createConsumptionReport = async (input: ConsumptionReportInput) => {
  let destino = "";

  const resultado = await runAction(async () => {
    const dados = consumptionReportSchema.parse(input);
    const { id } = await apiRequest<{ id: string }>(endpoints.consumptionReports, {
      method: "POST",
      body: { ...dados, tipoEstoqueId: semVazio(dados.tipoEstoqueId) },
    });
    revalidatePath(REPORTS);
    destino = `${REPORTS}/${id}`;
  }, "Relatório gerado");

  // Fora do runAction: `redirect` funciona lançando e seria lido como falha.
  if (destino) redirect(destino);
  return resultado;
};

export const deleteConsumptionReport = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.consumptionReports}/${id}`, { method: "DELETE" });
    revalidatePath(REPORTS);
  }, "Relatório excluído");
