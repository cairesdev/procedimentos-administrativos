import { z } from "zod";
import { ALVOS } from "./types";

/**
 * Um item, nas duas formas.
 *
 * Diferem só no prazo: o modelo guarda **dias** e o checklist guarda a **data**
 * já calculada. No modelo, uma data fixa envelheceria junto com ele.
 */
const itemBase = {
  titulo: z.string().min(1, "Informe o que precisa ser cumprido").max(200),
  descricao: z.string().max(2000).optional(),
  exigeAnexo: z.boolean().default(false),
  recorrente: z.boolean().default(false),
  periodicidadeDias: z.coerce.number<number>().int().positive().nullable().optional(),
  responsavel: z.string().optional(),
};

export const templateItemSchema = z.object({
  ...itemBase,
  prazoDias: z.coerce.number<number>().int().positive().nullable().optional(),
});

export const checklistItemSchema = z.object({
  ...itemBase,
  prazoLimite: z.string().optional(),
});

export const templateSchema = z.object({
  nome: z.string().min(1, "Informe o nome do modelo").max(150),
  descricao: z.string().max(2000).optional(),
  ativo: z.boolean().default(true),
  itens: z.array(templateItemSchema).min(1, "O modelo precisa de ao menos um item"),
});

/**
 * O que o **formulário** controla — sem os itens.
 *
 * A lista de itens vive num `useState` próprio, porque cada linha tem campos
 * que aparecem e somem conforme as opções marcadas. Mandar o resolver validar
 * um campo que o formulário nunca preenche criava um beco sem saída: o schema
 * reprovava por "precisa de ao menos um item", a mensagem caía num campo que o
 * JSX não desenha, e o botão de salvar ficava mudo — clicava e não acontecia
 * nada, com os itens visivelmente preenchidos na tela.
 *
 * `templateSchema`, completo, continua valendo na server action: é lá que os
 * dois pedaços se juntam, e é lá que a regra precisa ser conferida.
 */
export const templateFormSchema = templateSchema.omit({ itens: true });

export const checklistSchema = z.object({
  titulo: z.string().max(200).optional(),
  descricao: z.string().max(2000).optional(),
  modeloId: z.string().optional(),
  alvoTipo: z.enum(ALVOS).optional(),
  alvoId: z.string().optional(),
  responsavel: z.string().optional(),
  itens: z.array(checklistItemSchema).optional(),
});

export const fulfillSchema = z.object({
  observacao: z.string().max(2000).optional(),
});

export const refuseSchema = z.object({
  recusaMotivo: z.string().min(3, "Diga o que precisa ser corrigido").max(500),
});

export const dismissSchema = z.object({
  motivo: z.string().min(3, "Explique por que o item deixou de ser exigível").max(500),
});

export type TemplateInput = z.input<typeof templateSchema>;
export type TemplateFormInput = z.input<typeof templateFormSchema>;
export type ChecklistInput = z.input<typeof checklistSchema>;
export type FulfillInput = z.input<typeof fulfillSchema>;
export type RefuseInput = z.input<typeof refuseSchema>;
export type DismissInput = z.input<typeof dismissSchema>;
