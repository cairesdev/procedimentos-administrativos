import { z } from "zod";
import { ADJUSTMENT_REASONS, CONSUMPTION_FORMS, LOSS_REASONS } from "./types";

/** Três casas, como a coluna `NUMERIC(14,3)` do banco. */
const quantidade = z
  .number({ message: "Informe a quantidade" })
  .positive("A quantidade precisa ser maior que zero")
  .max(99_999_999);

export const warehouseSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  ativo: z.boolean(),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;

export const stockTypeSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  ativo: z.boolean(),
});

export type StockTypeInput = z.infer<typeof stockTypeSchema>;

export const stockSettingsSchema = z.object({
  reservaAtiva: z.boolean(),
  reservaPrazoHoras: z
    .number({ message: "Informe o prazo" })
    .int()
    .positive("O prazo precisa ser maior que zero")
    .max(8760, "Use no máximo um ano"),
  alertaValidadeDias: z
    .number({ message: "Informe os dias" })
    .int()
    .positive("Informe ao menos um dia")
    .max(3650),
});

export type StockSettingsInput = z.infer<typeof stockSettingsSchema>;

/**
 * Dados de entrega e prestação de contas do local. O CNPJ é opcional porque
 * município pequeno usa o da própria prefeitura para todas as escolas.
 */
export const stockLocationSchema = z.object({
  almoxarifadoId: z.string().uuid("Escolha o almoxarifado").nullable(),
  cnpj: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ""))
    .refine((valor) => valor === "" || valor.length === 14, "O CNPJ precisa ter 14 dígitos")
    .optional(),
  endereco: z.string().max(200).optional(),
  bairro: z.string().max(100).optional(),
  municipio: z.string().max(100).optional(),
  uf: z.string().max(2).optional(),
  cep: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ""))
    .refine((valor) => valor === "" || valor.length === 8, "O CEP precisa ter 8 dígitos")
    .optional(),
  telefone: z.string().max(20).optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]).optional(),
  responsavel: z.string().max(150).optional(),
});

export type StockLocationInput = z.infer<typeof stockLocationSchema>;

export const intakeLineSchema = z.object({
  nome: z.string().min(1, "Informe o produto").max(150),
  unidade: z.string().min(1, "Informe a unidade").max(20),
  quantidade,
  dataValidade: z.string().nullable().optional(),
});

export type IntakeLineInput = z.infer<typeof intakeLineSchema>;

export const intakeSchema = z.object({
  almoxarifadoId: z.string().uuid("Escolha o almoxarifado"),
  codigo: z.string().min(1, "Informe o código").max(30),
  titulo: z.string().min(1, "Informe o título").max(200),
  data: z.string().min(1, "Informe a data"),
  tipoEstoqueId: z.string().uuid("Escolha o tipo de estoque"),
  localArmazenado: z.string().max(150).optional(),
  notaFiscal: z.string().max(40).optional(),
  fornecedorId: z.string().uuid().optional(),
  linhas: z.array(intakeLineSchema).min(1, "A remessa precisa de ao menos um item"),
});

export type IntakeInput = z.infer<typeof intakeSchema>;

export const stockRequestSchema = z.object({
  localSolicitanteId: z.string().uuid("Escolha o local"),
  tipoEstoqueId: z.string().uuid().optional(),
  itens: z
    .array(z.object({ produtoId: z.string().uuid(), quantidadeSolicitada: quantidade }))
    .min(1, "Escolha ao menos um item"),
});

export type StockRequestInput = z.infer<typeof stockRequestSchema>;

export const releaseSchema = z.object({
  retiradas: z.array(z.object({
    solicitacaoItemId: z.string().uuid(),
    loteId: z.string().uuid(),
    quantidade: z.number().nonnegative().max(99_999_999),
  })).min(1),
});

export type ReleaseInput = z.infer<typeof releaseSchema>;

export const receiptSchema = z.object({
  confirmacoes: z.array(z.object({
    liberacaoId: z.string().uuid(),
    quantidadeConfirmada: z.number().nonnegative().max(99_999_999),
    motivoPerda: z.enum(LOSS_REASONS.map((item) => item.value) as [string, ...string[]]).optional(),
    observacaoPerda: z.string().max(500).optional(),
  })).min(1),
});

export type ReceiptInput = z.infer<typeof receiptSchema>;

export const refuseSchema = z.object({
  motivo: z.string().min(3, "Explique o motivo").max(500),
});

export type RefuseInput = z.infer<typeof refuseSchema>;

const valores = <T extends readonly { value: string }[]>(lista: T) =>
  lista.map((item) => item.value) as [string, ...string[]];

export const consumptionSchema = z.object({
  localId: z.string().uuid("Escolha o local"),
  produtoId: z.string().uuid("Escolha o produto"),
  quantidade,
  forma: z.enum(valores(CONSUMPTION_FORMS)),
  periodoInicio: z.string().optional(),
  periodoFim: z.string().optional(),
  observacao: z.string().max(500).optional(),
});

export type ConsumptionInput = z.infer<typeof consumptionSchema>;

export const returnSchema = z.object({
  estoqueLocalId: z.string().uuid("Escolha o lote"),
  quantidade,
  motivo: z.string().min(3, "Explique por que o material está voltando").max(500),
});

export type ReturnInput = z.infer<typeof returnSchema>;

export const transferSchema = z.object({
  loteId: z.string().uuid("Escolha o lote"),
  almoxarifadoDestinoId: z.string().uuid("Escolha o destino"),
  quantidade,
  motivo: z.string().max(500).optional(),
});

export type TransferInput = z.infer<typeof transferSchema>;

export const adjustmentSchema = z.object({
  loteId: z.string().uuid().optional(),
  estoqueLocalId: z.string().uuid().optional(),
  // Zero é válido: a contagem pode achar que não sobrou nada.
  saldoCorrigido: z.number({ message: "Informe o saldo contado" }).nonnegative().max(99_999_999),
  motivo: z.enum(valores(ADJUSTMENT_REASONS)),
  observacao: z.string().max(500).optional(),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
