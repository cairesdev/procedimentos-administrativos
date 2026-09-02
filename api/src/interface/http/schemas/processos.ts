import { z } from "zod";
import { IDS_DE_MODALIDADE } from "../../../domain/licitacao/Modalidades";

export const loginSchema = z.object({
  identificador: z.string().min(3), // e-mail ou nome de usuário
  senha: z.string().min(1),
});

export const criarLicitacaoSchema = z.object({
  numero: z.string().min(1).max(40),
  resumo: z.string().max(300).optional(),
  objeto: z.string().min(1),
  modalidade: z.enum(IDS_DE_MODALIDADE),
  dataAssinatura: z.string().date(),
  valorTotal: z.number().positive(),
  unidadesDestinadas: z.array(z.string().uuid()).min(1),
});

const itemContratoSchema = z.object({
  // Sem teto de tabela: a coluna é TEXT desde a 0042. O limite aqui é o da
  // fronteira com o mundo — generoso para uma especificação de edital,
  // apertado para um abuso.
  produto: z.string().min(1).max(2000),
  descricao: z.string().optional(),
  // Agrupador dentro do contrato — "Saúde", "Educação". Opcional: a maior parte
  // dos contratos tem uma frente só.
  categoria: z.string().max(60).nullable().optional(),
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
  modalidade: z.enum(IDS_DE_MODALIDADE).optional(),
  dataAssinatura: z.string().date().optional(),
  valorTotal: z.number().positive().optional(),
  unidadesDestinadas: z.array(z.string().uuid()).min(1).optional(),
});

export const editarContratoSchema = z.object({
  dataInicio: z.string().date().optional(),
  dataFim: z.string().date().nullable().optional(),
  fiscalNomeMatricula: z.string().max(200).nullable().optional(),
  unidadesDestinadas: z.array(z.string().uuid()).min(1).optional(),
  // O valor assinado, que o teto da licitação mede.
  valorTotal: z.number().positive().optional(),
});

/**
 * Corrigir um item já gravado.
 *
 * Mesmos campos da criação: a planilha entra por colagem, e o erro pode estar
 * em qualquer um deles. `null` em descrição e marca apaga o que estava lá —
 * `undefined` não distinguiria "não mexi" de "quero em branco".
 */
export const editarItemContratoSchema = z.object({
  // Sem teto de tabela: a coluna é TEXT desde a 0042. O limite aqui é o da
  // fronteira com o mundo — generoso para uma especificação de edital,
  // apertado para um abuso.
  produto: z.string().min(1).max(2000),
  descricao: z.string().nullable().optional(),
  categoria: z.string().max(60).nullable().optional(),
  unidadeMedida: z.string().min(1).max(20),
  marca: z.string().max(100).nullable().optional(),
  quantidadeTotal: z.number().positive(),
  modoMedicao: z.enum(["UNIDADE", "PERCENTUAL", "VALOR"]),
  valorUnitario: z.number().nonnegative(),
  valorTotal: z.number().positive(),
});
