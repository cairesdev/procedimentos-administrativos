import { z } from "zod";

/**
 * O que a ficha aceita receber.
 *
 * Quase tudo é opcional, e isso é o desenho: o pronto atendimento preenche na
 * ordem em que as coisas acontecem, não na ordem em que o formulário pede.
 * Campo obrigatório aqui vira, no balcão, um valor inventado para conseguir
 * salvar a tela.
 */

const texto = (max: number) => z.string().trim().min(1).max(max);
const opcional = (max: number) => z.string().trim().max(max).nullish();

export const pacienteSchema = z.object({
  nome: texto(200),
  nomeMae: opcional(200),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  sexo: z.enum(["M", "F", "I"]).nullish(),
  // Os cinco documentos chegam como o usuário digitou — com ponto, traço e
  // espaço. Quem limpa e confere o dígito é o domínio, não o schema: a regra
  // de "o que é um CNS válido" não pertence à camada HTTP.
  cns: opcional(20),
  cpf: opcional(20),
  nis: opcional(20),
  cnh: opcional(20),
  rg: opcional(20),
  endereco: opcional(200),
  cidade: opcional(100),
  uf: z.string().trim().length(2).nullish(),
  telefone: opcional(20),
  email: z.string().trim().email().max(150).nullish().or(z.literal("")),
});

export const condicaoSchema = z.object({
  tipo: z.enum(["HAS", "DM", "ALERGIA", "OUTRO"]),
  descricao: opcional(300),
});

export const abrirAtendimentoSchema = z.object({
  unidadeSaudeId: z.string().uuid(),
  // Nulo é o inconsciente sem documento. A ficha abre, o socorro começa.
  pacienteId: z.string().uuid().nullish(),
});

export const identificarSchema = z.object({
  pacienteId: z.string().uuid(),
});

/**
 * Os sinais vitais entram como número ou nada.
 *
 * As faixas ficam no domínio (`SinaisVitais.ts`), e não aqui, porque a
 * diferença entre "impossível" e "improvável" é regra clínica: 368 °C é dedo
 * no teclado e o schema poderia recusar, mas 41,5 °C é febre grave e precisa
 * passar com aviso. Zod só sabe recusar.
 */
const sinal = z.number().nullish();

export const triagemSchema = z.object({
  glicemia: sinal,
  paSistolica: sinal,
  paDiastolica: sinal,
  pulso: sinal,
  saturacao: sinal,
  temperatura: sinal,
  queixa: opcional(4000),
  conduta: z.enum(["URGENCIA", "ENCAMINHADO_UBS", "ENCAMINHADO_INTERNACAO"]).nullish(),
  prioridade: z.boolean().default(false),
});

export const avaliacaoSchema = z.object({
  queixaClinica: texto(8000),
});

export const exameSchema = z.object({
  descricao: texto(300),
});

export const resultadoSchema = z.object({
  resultado: texto(8000),
});

export const prescricaoSchema = z.object({
  orientacoes: opcional(4000),
  itens: z.array(z.object({
    medicamento: texto(200),
    dose: texto(60),
    via: z.enum([
      "ORAL", "IV", "IM", "SC", "TOPICA", "INALATORIA", "RETAL", "OUTRA",
    ]),
    frequencia: texto(60),
    observacao: opcional(300),
  })).max(50).default([]),
});

export const administracaoSchema = z.object({
  // O horário é o do relógio de quem deu o remédio, não o do servidor: a
  // enfermagem registra depois de atender o paciente.
  horario: z.coerce.date(),
  observacao: opcional(300),
});

export const evolucaoSchema = z.object({
  tipo: z.enum(["ENFERMAGEM", "MEDICA"]),
  texto: texto(8000),
});

export const procedimentoSchema = z.object({
  tipo: z.enum([
    "URGENCIA_SEM_OBSERVACAO", "URGENCIA_COM_OBSERVACAO", "SUTURA",
    "CURATIVO", "NEBULIZACAO", "CIRURGIA_AMBULATORIAL", "OUTRO",
  ]),
  descricao: opcional(300),
});

export const desfechoSchema = z.object({
  tipo: z.enum(["ALTA", "ENCAMINHAMENTO", "OBITO"]),
  destino: opcional(200),
  horario: z.coerce.date(),
});

export const retificacaoSchema = z.object({
  tabelaOrigem: z.enum([
    "triagem", "avaliacao_medica", "exame", "prescricao", "evolucao",
    "procedimento", "desfecho",
  ]),
  registroId: z.string().uuid(),
  texto: texto(4000),
});

export const unidadeSaudeSchema = z.object({
  nome: texto(150),
  codigoCnes: z.string().trim().regex(/^\d{7}$/).nullish().or(z.literal("")),
  tipoUnidade: z.number().int().nullish(),
  endereco: opcional(200),
  telefone: opcional(20),
  unidadeId: z.string().uuid().nullish(),
});
