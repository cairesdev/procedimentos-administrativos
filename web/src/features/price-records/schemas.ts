import { z } from "zod";

const itemSchema = z.object({
  produto: z.string().min(1, "Informe o produto").max(2000),
  descricao: z.string().optional(),
  unidadeMedida: z.string().min(1, "Informe a unidade").max(20),
  marca: z.string().max(100).optional(),
  quantidade: z.coerce.number<number>().positive("Quantidade deve ser maior que zero"),
  valorUnitario: z.coerce.number<number>().nonnegative(),
  valorTotal: z.coerce.number<number>().positive("Valor deve ser maior que zero"),
});

export const priceRecordSchema = z
  .object({
    numero: z.string().min(1, "Informe o número").max(40),
    licitacaoId: z.string().optional(),
    objeto: z.string().min(1, "Informe o objeto"),
    dataAssinatura: z.string().min(1, "Informe a data de assinatura"),
    dataVigencia: z.string().min(1, "Informe a vigência"),
    valorTotal: z.coerce.number<number>().positive("Valor deve ser maior que zero"),
    itens: z.array(itemSchema).min(1, "Adicione ao menos um item"),
  })
  .refine((data) => new Date(data.dataVigencia) >= new Date(data.dataAssinatura), {
    message: "Vigência não pode ser anterior à assinatura",
    path: ["dataVigencia"],
  });

export type PriceRecordInput = z.input<typeof priceRecordSchema>;
