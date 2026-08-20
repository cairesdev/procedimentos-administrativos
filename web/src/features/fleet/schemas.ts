import { z } from "zod";

// A API espera datetime com fuso; o <input type="datetime-local"> devolve
// "2026-08-20T14:30" sem fuso. A conversão fica nas actions.
const dataHoraLocal = z.string().min(1, "Informe data e hora");

export const vehicleSchema = z.object({
  placa: z
    .string()
    .min(7, "Placa incompleta")
    .max(10)
    .regex(/^[A-Za-z]{3}-?\d[A-Za-z0-9]\d{2}$/, "Use o formato ABC1D23 ou ABC-1234"),
  modelo: z.string().min(1, "Informe o modelo").max(100),
  ano: z.string().optional(),
  tipo: z.string().max(40).optional(),
  unidadeId: z.string().optional(),
});

export const driverSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  cnh: z.string().min(5, "CNH incompleta").max(20),
  categoriaCnh: z.string().min(1, "Escolha a categoria").max(5),
  validadeCnh: z.string().min(1, "Informe a validade"),
  usuarioId: z.string().optional(),
});

export const tripSchema = z.object({
  unidadeSolicitanteId: z.uuid("Escolha a unidade"),
  veiculoId: z.uuid("Escolha o veículo"),
  motoristaId: z.uuid("Escolha o motorista"),
  dataHoraDesejada: dataHoraLocal,
  motivo: z.string().min(1, "Descreva o motivo").max(2000),
  responsavel: z.string().min(1, "Informe o responsável").max(150),
});

export const refuseSchema = z.object({
  motivo: z.string().min(1, "Diga por que está recusando").max(2000),
});

export const rescheduleSchema = z.object({
  dataHora: dataHoraLocal,
});

export const pickupSchema = z.object({
  dataHora: dataHoraLocal,
  kmInicial: z.coerce.number<number>().nonnegative("Km não pode ser negativo"),
  motoristaId: z.uuid("Confirme o motorista"),
  notaCombustivelTipo: z.string().optional(),
  notaCombustivelQuantidade: z.string().optional(),
});

export const finishSchema = z.object({
  dataHora: dataHoraLocal,
  kmFinal: z.coerce.number<number>().nonnegative("Km não pode ser negativo"),
  sinistro: z.string().max(4000).optional(),
});

// Litros ou valor: ao menos um. A API repete a checagem.
export const refuelSchema = z
  .object({
    data: dataHoraLocal,
    litros: z.string().optional(),
    valor: z.string().optional(),
  })
  .refine((dados) => Boolean(dados.litros?.trim()) || Boolean(dados.valor?.trim()), {
    message: "Informe os litros ou o valor",
    path: ["litros"],
  });

export const maintenanceSchema = z.object({
  veiculoId: z.uuid("Escolha o veículo"),
  tipo: z.enum(["PREVENTIVA", "CORRETIVA"]),
  dataInicio: z.string().min(1, "Informe a data de início"),
  descricao: z.string().max(4000).optional(),
  oficina: z.string().max(150).optional(),
  custo: z.coerce.number<number>().nonnegative().optional(),
});

export const closeMaintenanceSchema = z.object({
  dataFim: z.string().min(1, "Informe a data de encerramento"),
  custo: z.coerce.number<number>().nonnegative().optional(),
  descricao: z.string().max(4000).optional(),
});

export type VehicleInput = z.input<typeof vehicleSchema>;
export type DriverInput = z.input<typeof driverSchema>;
export type TripInput = z.input<typeof tripSchema>;
export type RefuseInput = z.input<typeof refuseSchema>;
export type RescheduleInput = z.input<typeof rescheduleSchema>;
export type PickupInput = z.input<typeof pickupSchema>;
export type FinishInput = z.input<typeof finishSchema>;
export type RefuelInput = z.input<typeof refuelSchema>;
export type MaintenanceInput = z.input<typeof maintenanceSchema>;
export type CloseMaintenanceInput = z.input<typeof closeMaintenanceSchema>;
