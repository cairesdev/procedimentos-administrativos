import { z } from "zod";
import { MEASUREMENT_MODES } from "./types";

const itemSchema = z.object({
  produto: z.string().min(1, "Informe o produto").max(150),
  descricao: z.string().optional(),
  unidadeMedida: z.string().min(1, "Informe a unidade").max(20),
  marca: z.string().optional(),
  quantidade: z.coerce.number<number>().positive("Quantidade deve ser maior que zero"),
  modoMedicao: z.enum(MEASUREMENT_MODES).default("UNIDADE"),
  valorUnitario: z.coerce.number<number>().nonnegative(),
  valorTotal: z.coerce.number<number>().positive("Valor deve ser maior que zero"),
});

// Origem obrigatória: licitação ou ata, nunca as duas nem nenhuma.
export const contractSchema = z
  .object({
    origem: z.enum(["LICITACAO", "ATA"]),
    numero: z.string().min(1, "Informe o número").max(40),
    fornecedorId: z.uuid("Selecione o fornecedor"),
    licitacaoId: z.string().optional(),
    ataId: z.string().optional(),
    dataInicio: z.string().min(1, "Informe a data de início"),
    dataFim: z.string().optional(),
    valorTotal: z.coerce.number<number>().positive("Informe o valor do contrato"),
    fiscalNomeMatricula: z.string().max(200).optional(),
    unidadesDestinadas: z.array(z.uuid()).min(1, "Selecione ao menos uma unidade"),
    itens: z.array(itemSchema).min(1, "Adicione ao menos um item"),
  })
  .refine((data) => (data.origem === "ATA" ? Boolean(data.ataId) : Boolean(data.licitacaoId)), {
    message: "Selecione a licitação ou a ata de origem",
    path: ["licitacaoId"],
  })
  .refine((data) => !data.dataFim || new Date(data.dataFim) >= new Date(data.dataInicio), {
    message: "Fim da vigência não pode ser anterior ao início",
    path: ["dataFim"],
  });

export type ContractInput = z.input<typeof contractSchema>;
export type ContractItemInput = z.input<typeof itemSchema>;

export const contractEditSchema = z
  .object({
    dataInicio: z.string().min(1, "Informe a data de início"),
    dataFim: z.string().optional(),
    fiscalNomeMatricula: z.string().max(200).optional(),
    unidadesDestinadas: z.array(z.uuid()).min(1, "Selecione ao menos uma unidade"),
  })
  .refine((data) => !data.dataFim || new Date(data.dataFim) >= new Date(data.dataInicio), {
    message: "Fim da vigência não pode ser anterior ao início",
    path: ["dataFim"],
  });

export type ContractEditInput = z.input<typeof contractEditSchema>;
