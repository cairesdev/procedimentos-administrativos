"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  closeMaintenanceSchema, driverSchema, finishSchema, maintenanceSchema, pickupSchema,
  refuelSchema, refuseSchema, rescheduleSchema, tripSchema, vehicleSchema,
  type CloseMaintenanceInput, type DriverInput, type FinishInput, type MaintenanceInput,
  type PickupInput, type RefuelInput, type RefuseInput, type RescheduleInput, type TripInput,
  type VehicleInput,
} from "./schemas";
import type { Trip } from "./types";

const VEHICLES = "/frotas/veiculos";
const DRIVERS = "/frotas/motoristas";
const TRIPS = "/frotas/viagens";
const MAINTENANCES = "/frotas/manutencoes";

const vazio = (valor?: string) => valor?.trim() || undefined;

/**
 * O <input type="datetime-local"> devolve "2026-08-20T14:30", sem fuso. Enviar
 * assim faz a API recusar (exige offset) e, pior, o servidor interpretaria a
 * hora no fuso dele. `new Date(...)` lê no fuso do navegador — mas isto roda no
 * servidor, então o fuso é o do container (TZ=America/Sao_Paulo no compose).
 */
const comFuso = (dataHoraLocal: string): string => new Date(dataHoraLocal).toISOString();

// ---- Veículos --------------------------------------------------------------

export const createVehicle = async (input: VehicleInput) =>
  runAction(async () => {
    const { ano, tipo, unidadeId, placa, modelo } = vehicleSchema.parse(input);
    await apiRequest(endpoints.vehicles, {
      method: "POST",
      body: {
        placa: placa.toUpperCase().replace("-", ""),
        modelo,
        ano: ano ? Number(ano) : undefined,
        tipo: vazio(tipo),
        unidadeId: vazio(unidadeId),
      },
    });
    revalidatePath(VEHICLES);
  }, "Veículo cadastrado");

export const updateVehicle = async (id: string, input: VehicleInput) =>
  runAction(async () => {
    // A placa identifica o veículo em multa e documento: não muda por aqui.
    const { ano, tipo, unidadeId, modelo } = vehicleSchema.parse(input);
    await apiRequest(`${endpoints.vehicles}/${id}`, {
      method: "PATCH",
      body: {
        modelo,
        ano: ano ? Number(ano) : null,
        tipo: vazio(tipo) ?? null,
        unidadeId: vazio(unidadeId) ?? null,
      },
    });
    revalidatePath(VEHICLES);
  }, "Veículo atualizado");

export const setVehicleActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await apiRequest(`${endpoints.vehicles}/${id}`, { method: "PATCH", body: { ativo: active } });
    revalidatePath(VEHICLES);
  }, active ? "Veículo reativado" : "Veículo inativado");

export const deleteVehicle = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.vehicles}/${id}`, { method: "DELETE" });
    revalidatePath(VEHICLES);
  }, "Veículo excluído");

// ---- Motoristas ------------------------------------------------------------

export const createDriver = async (input: DriverInput) =>
  runAction(async () => {
    const { usuarioId, ...body } = driverSchema.parse(input);
    await apiRequest(endpoints.drivers, {
      method: "POST",
      body: { ...body, usuarioId: vazio(usuarioId) },
    });
    revalidatePath(DRIVERS);
  }, "Motorista cadastrado");

export const updateDriver = async (id: string, input: DriverInput) =>
  runAction(async () => {
    const { usuarioId, ...body } = driverSchema.parse(input);
    await apiRequest(`${endpoints.drivers}/${id}`, {
      method: "PATCH",
      body: { ...body, usuarioId: vazio(usuarioId) ?? null },
    });
    revalidatePath(DRIVERS);
  }, "Motorista atualizado");

export const setDriverActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await apiRequest(`${endpoints.drivers}/${id}`, { method: "PATCH", body: { ativo: active } });
    revalidatePath(DRIVERS);
  }, active ? "Motorista reativado" : "Motorista inativado");

export const deleteDriver = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.drivers}/${id}`, { method: "DELETE" });
    revalidatePath(DRIVERS);
  }, "Motorista excluído");

// ---- Viagens ---------------------------------------------------------------

/** A API devolve os conflitos de agenda: aviso, não bloqueio. */
export const requestTrip = async (input: TripInput) => {
  let created: { id: string; conflitos: Trip[] } | undefined;

  const result = await runAction(async () => {
    const dados = tripSchema.parse(input);
    created = await apiRequest<{ id: string; conflitos: Trip[] }>(endpoints.trips, {
      method: "POST",
      body: { ...dados, dataHoraDesejada: comFuso(dados.dataHoraDesejada) },
    });
    revalidatePath(TRIPS);
  }, "Viagem solicitada");

  if (!created) return result;
  return {
    ...result,
    id: created.id,
    success:
      created.conflitos.length > 0
        ? `Viagem solicitada — atenção: o veículo já tem ${created.conflitos.length} viagem(ns) por perto`
        : "Viagem solicitada",
  };
};

export const approveTrip = async (id: string) =>
  runAction(async () => {
    await apiRequest(endpoints.tripAction(id, "aprovar"), { method: "POST", body: {} });
    revalidatePath(TRIPS);
    revalidatePath(`${TRIPS}/${id}`);
  }, "Viagem aprovada");

export const refuseTrip = async (id: string, input: RefuseInput) =>
  runAction(async () => {
    const body = refuseSchema.parse(input);
    await apiRequest(endpoints.tripAction(id, "recusar"), { method: "POST", body });
    revalidatePath(TRIPS);
    revalidatePath(`${TRIPS}/${id}`);
  }, "Viagem recusada");

export const rescheduleTrip = async (id: string, input: RescheduleInput) => {
  let resultado: { conflitos: Trip[] } | undefined;

  const result = await runAction(async () => {
    const { dataHora } = rescheduleSchema.parse(input);
    resultado = await apiRequest<{ conflitos: Trip[] }>(endpoints.tripAction(id, "remarcar"), {
      method: "POST",
      body: { dataHora: comFuso(dataHora) },
    });
    revalidatePath(TRIPS);
    revalidatePath(`${TRIPS}/${id}`);
  }, "Nova data proposta");

  if (resultado && resultado.conflitos.length > 0) {
    return {
      ...result,
      success: `Nova data proposta — atenção: ainda há ${resultado.conflitos.length} viagem(ns) por perto`,
    };
  }
  return result;
};

export const cancelTrip = async (id: string) =>
  runAction(async () => {
    await apiRequest(endpoints.tripAction(id, "cancelar"), { method: "POST", body: {} });
    revalidatePath(TRIPS);
    revalidatePath(`${TRIPS}/${id}`);
  }, "Viagem cancelada");

export const registerPickup = async (id: string, input: PickupInput) =>
  runAction(async () => {
    const dados = pickupSchema.parse(input);
    const tipo = vazio(dados.notaCombustivelTipo);
    const quantidade = vazio(dados.notaCombustivelQuantidade);

    await apiRequest(endpoints.tripAction(id, "retirada"), {
      method: "POST",
      body: {
        kmInicial: dados.kmInicial,
        dataHora: comFuso(dados.dataHora),
        motoristaId: dados.motoristaId,
        notaCombustivelTipo: tipo,
        // Só faz sentido enviar a quantidade se o tipo veio junto.
        notaCombustivelQuantidade: tipo && quantidade ? Number(quantidade) : undefined,
      },
    });
    revalidatePath(TRIPS);
    revalidatePath(`${TRIPS}/${id}`);
  }, "Retirada registrada");

export const finishTrip = async (id: string, input: FinishInput) =>
  runAction(async () => {
    const dados = finishSchema.parse(input);
    await apiRequest(endpoints.tripAction(id, "finalizar"), {
      method: "POST",
      body: {
        dataHora: comFuso(dados.dataHora),
        kmFinal: dados.kmFinal,
        sinistro: vazio(dados.sinistro),
      },
    });
    revalidatePath(TRIPS);
    revalidatePath(`${TRIPS}/${id}`);
    revalidatePath(VEHICLES);
  }, "Viagem finalizada");

// ---- Abastecimento ---------------------------------------------------------

export const registerRefuel = async (tripId: string, input: RefuelInput) =>
  runAction(async () => {
    const dados = refuelSchema.parse(input);
    const litros = vazio(dados.litros);
    const valor = vazio(dados.valor);

    await apiRequest(endpoints.refuels(tripId), {
      method: "POST",
      body: {
        data: comFuso(dados.data),
        litros: litros ? Number(litros) : undefined,
        valor: valor ? Number(valor) : undefined,
      },
    });
    revalidatePath(`${TRIPS}/${tripId}`);
  }, "Abastecimento registrado");

export const deleteRefuel = async (id: string, tripId: string) =>
  runAction(async () => {
    await apiRequest(endpoints.refuel(id), { method: "DELETE" });
    revalidatePath(`${TRIPS}/${tripId}`);
  }, "Abastecimento excluído");

// ---- Manutenção ------------------------------------------------------------

export const openMaintenance = async (input: MaintenanceInput) =>
  runAction(async () => {
    const dados = maintenanceSchema.parse(input);
    await apiRequest(endpoints.maintenances, {
      method: "POST",
      body: {
        ...dados,
        descricao: vazio(dados.descricao),
        oficina: vazio(dados.oficina),
        custo: dados.custo || undefined,
      },
    });
    revalidatePath(MAINTENANCES);
    revalidatePath(VEHICLES);
  }, "Manutenção aberta");

export const closeMaintenance = async (id: string, input: CloseMaintenanceInput) =>
  runAction(async () => {
    const dados = closeMaintenanceSchema.parse(input);
    await apiRequest(endpoints.closeMaintenance(id), {
      method: "POST",
      body: {
        dataFim: dados.dataFim,
        custo: dados.custo || undefined,
        descricao: vazio(dados.descricao),
      },
    });
    revalidatePath(MAINTENANCES);
    revalidatePath(VEHICLES);
  }, "Manutenção encerrada");

export const deleteMaintenance = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.maintenances}/${id}`, { method: "DELETE" });
    revalidatePath(MAINTENANCES);
    revalidatePath(VEHICLES);
  }, "Manutenção excluída");
