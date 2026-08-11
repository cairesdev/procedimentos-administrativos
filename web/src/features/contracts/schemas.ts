import { z } from "zod";
import { MEASUREMENT_MODES } from "./types";

const itemSchema = z.object({
  produto: z.string().min(1, "Informe o produto").max(150),
  descricao: z.string().optional(),
  unidadeMedida: z.string().min(1, "Informe a unidade").max(20),
  marca: z.string().max(100).optional(),
  quantidadeTotal: z.coerce.number<number>().positive("Quantidade deve ser maior que zero"),
  modoMedicao: z.enum(MEASUREMENT_MODES),
  valorUnitario: z.coerce.number<number>().nonnegative(),
  valorTotal: z.coerce.number<number>().positive("Valor deve ser maior que zero"),
});

// Origem obrigatória: licitação ou ata (a ata entra quando a tela existir).
export const contractSchema = z.object({
  numero: z.string().min(1, "Informe o número").max(40),
  fornecedorId: z.uuid("Selecione o fornecedor"),
  licitacaoId: z.uuid("Selecione a licitação de origem"),
  dataInicio: z.string().min(1, "Informe a data de início"),
  dataFim: z.string().min(1, "Informe a data de fim"),
  valorTotal: z.coerce.number<number>().positive("Valor deve ser maior que zero"),
  fiscalNomeMatricula: z.string().max(200).optional(),
  unidadesDestinadas: z.array(z.uuid()).min(1, "Selecione ao menos uma unidade"),
  itens: z.array(itemSchema).min(1, "Adicione ao menos um item"),
});

export type ContractInput = z.input<typeof contractSchema>;
export type ContractItemInput = z.input<typeof itemSchema>;
