/**
 * Um ano na tela, vinte anos no banco.
 *
 * O cliente pediu "manter o histórico do paciente por 1 ano". Prontuário tem
 * guarda mínima de vinte anos a contar do último registro, reafirmada pelo
 * Parecer CFM nº 19/2026 — que trata justamente do descarte. Apagar aos doze
 * meses poria a prefeitura em falta e sumiria com a prova de defesa do médico
 * em qualquer processo.
 *
 * O que ele queria era outra coisa, e é a que está implementada: a **série de
 * trabalho** limpa. A lista padrão, os relatórios e a busca rápida cortam em
 * doze meses; o histórico completo do paciente ignora o corte e mostra tudo.
 * Nada é apagado, nunca.
 *
 * **Por que isto é uma conta e não uma coluna `arquivado_em`.** Uma coluna
 * precisaria de alguém para preenchê-la — uma rotina noturna que, no dia em
 * que falhasse, deixaria a ficha de ontem "arquivada" ou a de 2019 "ativa",
 * sem ninguém perceber. Este projeto já ficou 22 horas com um worker morto e
 * uma tela dizendo que estava tudo bem. Data não precisa de vigia.
 */

export const MESES_NA_SERIE_DE_TRABALHO = 12;

/** O corte, calculado na hora da consulta. */
export const inicioDaSerieDeTrabalho = (agora: Date = new Date()): Date => {
  const corte = new Date(agora);
  corte.setMonth(corte.getMonth() - MESES_NA_SERIE_DE_TRABALHO);
  return corte;
};

/**
 * Se este atendimento está fora da série de trabalho.
 *
 * A tela usa para marcar a linha: o profissional precisa saber que está
 * olhando registro antigo, e não a visita de ontem.
 */
export const foraDaSerieDeTrabalho = (
  abertoEm: Date | string,
  agora: Date = new Date(),
): boolean => new Date(abertoEm) < inicioDaSerieDeTrabalho(agora);
