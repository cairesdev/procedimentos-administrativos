import { z } from "zod";
import { BID_MODALITY_IDS } from "./types";

export const bidSchema = z.object({
  numero: z.string().min(1, "Informe o número").max(40),
  resumo: z.string().max(300).optional(),
  objeto: z.string().min(1, "Informe o objeto"),
  modalidade: z.enum(BID_MODALITY_IDS),
  dataAssinatura: z.string().min(1, "Informe a data"),
  valorTotal: z.coerce.number<number>().positive("Valor deve ser maior que zero"),
  unidadesDestinadas: z.array(z.uuid()).min(1, "Selecione ao menos uma unidade"),
});

export type BidInput = z.input<typeof bidSchema>;
