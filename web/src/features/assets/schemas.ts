import { z } from "zod";

export const assetLocationSchema = z.object({
  codigo: z.string().regex(/^\d{1,10}$/, "Só números, ex.: 001"),
  nome: z.string().min(1, "Informe o nome").max(150),
  unidadeId: z.string().optional(),
});

export const assetCategorySchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(100),
});

export const assetIntakeSchema = z.object({
  data: z.string().min(1, "Informe a data"),
  fornecedorId: z.string().optional(),
  notaFiscal: z.string().max(40).optional(),
  lotes: z
    .array(
      z.object({
        categoriaId: z.uuid("Escolha a categoria"),
        localDestinoId: z.uuid("Escolha o local"),
        nomeBem: z.string().min(1, "Informe o bem").max(150),
        quantidade: z.coerce.number<number>().int().positive("Quantidade deve ser maior que zero"),
      }),
    )
    .min(1, "Adicione ao menos um lote"),
});

// Lotes ficam de fora: os bens já foram tombados, só a nota admite correção.
export const assetIntakeEditSchema = z.object({
  data: z.string().min(1, "Informe a data"),
  fornecedorId: z.string().optional(),
  notaFiscal: z.string().max(40).optional(),
});

export const assetEditSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  categoriaId: z.uuid("Escolha a categoria"),
});

export const transferSchema = z.object({
  localDestinoId: z.uuid("Escolha o local de destino"),
});

export const writeOffSchema = z.object({
  motivo: z.enum(["QUEBRADO", "DOADO", "EXTRAVIADO", "LEILAO", "OUTRO"]),
  observacao: z.string().max(4000).optional(),
});

export const inventorySchema = z.object({
  localId: z.uuid("Escolha o local"),
  dataInicio: z.string().min(1, "Informe a data"),
});

export const inventoryCheckSchema = z.object({
  itens: z
    .array(
      z.object({
        bemId: z.uuid(),
        situacao: z.enum(["ENCONTRADO", "NAO_ENCONTRADO"]),
        estadoObservado: z.enum(["NOVO", "BOM", "DANIFICADO", "EM_CONSERTO"]).optional(),
        observacao: z.string().max(2000).optional(),
      }),
    )
    .min(1, "Confira ao menos um bem"),
});

export type AssetLocationInput = z.input<typeof assetLocationSchema>;
export type AssetCategoryInput = z.input<typeof assetCategorySchema>;
export type AssetIntakeInput = z.input<typeof assetIntakeSchema>;
export type AssetIntakeEditInput = z.input<typeof assetIntakeEditSchema>;
export type AssetEditInput = z.input<typeof assetEditSchema>;
export type TransferInput = z.input<typeof transferSchema>;
export type WriteOffInput = z.input<typeof writeOffSchema>;
export type InventoryInput = z.input<typeof inventorySchema>;
export type InventoryCheckInput = z.input<typeof inventoryCheckSchema>;
