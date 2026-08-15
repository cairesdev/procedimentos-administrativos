import { z } from "zod";

export const loginSchema = z.object({
  identificador: z.string().min(3), // e-mail ou nome de usuário
  senha: z.string().min(1),
});

export const criarLicitacaoSchema = z.object({
  numero: z.string().min(1).max(40),
  resumo: z.string().max(300).optional(),
  objeto: z.string().min(1),
  modalidade: z.enum([
    "PREGAO_ELETRONICO", "PREGAO_PRESENCIAL", "CONCORRENCIA", "DISPENSA",
    "INEXIGIBILIDADE", "CHAMADA_PUBLICA", "LEILAO", "DIALOGO_COMPETITIVO",
  ]),
  dataAssinatura: z.string().date(),
  valorTotal: z.number().positive(),
  unidadesDestinadas: z.array(z.string().uuid()).min(1),
});

const itemContratoSchema = z.object({
  produto: z.string().min(1).max(150),
  descricao: z.string().optional(),
  unidadeMedida: z.string().min(1).max(20),
  marca: z.string().max(100).optional(),
  quantidadeTotal: z.number().positive(),
  modoMedicao: z.enum(["UNIDADE", "PERCENTUAL", "VALOR"]),
  valorUnitario: z.number().nonnegative(),
  valorTotal: z.number().positive(),
});

export const criarContratoSchema = z.object({
  numero: z.string().min(1).max(40),
  fornecedorId: z.string().uuid(),
  licitacaoId: z.string().uuid().optional(),
  ataId: z.string().uuid().optional(),
  dataInicio: z.string().date(),
  dataFim: z.string().date().optional(),
  valorTotal: z.number().positive(),
  fiscalNomeMatricula: z.string().max(200).optional(),
  unidadesDestinadas: z.array(z.string().uuid()).min(1),
  itens: z.array(itemContratoSchema).min(1),
});

export const rascunhoSolicitacaoSchema = z.object({
  unidadeSolicitanteId: z.string().uuid(),
  itens: z.array(z.object({
    itemId: z.string().uuid(),
    quantidadeSolicitada: z.number().positive(),
  })).min(1),
});

export const enviarSolicitacaoSchema = z.object({
  setorDestinoId: z.string().uuid().optional(),
});

export const cancelarSolicitacaoSchema = z.object({
  motivo: z.string().max(300).optional(),
});

export const editarLicitacaoSchema = z.object({
  numero: z.string().min(1).max(40).optional(),
  resumo: z.string().max(300).nullable().optional(),
  objeto: z.string().min(1).optional(),
  modalidade: z.enum([
    "PREGAO_ELETRONICO", "PREGAO_PRESENCIAL", "CONCORRENCIA", "DISPENSA",
    "INEXIGIBILIDADE", "CHAMADA_PUBLICA", "LEILAO", "DIALOGO_COMPETITIVO",
  ]).optional(),
  dataAssinatura: z.string().date().optional(),
  valorTotal: z.number().positive().optional(),
  unidadesDestinadas: z.array(z.string().uuid()).min(1).optional(),
});

export const editarContratoSchema = z.object({
  dataInicio: z.string().date().optional(),
  dataFim: z.string().date().nullable().optional(),
  fiscalNomeMatricula: z.string().max(200).nullable().optional(),
  unidadesDestinadas: z.array(z.string().uuid()).min(1).optional(),
});
