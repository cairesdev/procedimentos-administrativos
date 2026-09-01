import type { ChecklistItem } from "./types";

export type Situacao =
  | "PENDENTE" | "AGUARDANDO_CONFERENCIA" | "CUMPRIDO" | "VENCIDO" | "DISPENSADO";

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * A mesma regra da API, no web.
 *
 * Espelhada de propósito, e nunca herdada: o web não importa código da API.
 * As duas precisam concordar, e o teste de contrato confere — a tela pintando
 * de verde o que a API considera vencido seria pior que não pintar nada.
 */
export const situacaoDoItem = (item: ChecklistItem, dia = hoje()): Situacao => {
  if (item.dispensadoEm) return "DISPENSADO";

  const ciclo = item.ultimoCiclo;
  if (!ciclo) return "PENDENTE";
  if (ciclo.situacao === "AGUARDANDO") return "AGUARDANDO_CONFERENCIA";
  if (ciclo.situacao === "RECUSADO") return "PENDENTE";
  if (!ciclo.vigenciaAte) return "CUMPRIDO";

  // O dia da vigência ainda conta: "vale até 30/06" vale no dia 30.
  return ciclo.vigenciaAte.slice(0, 10) >= dia ? "CUMPRIDO" : "VENCIDO";
};

export const emAberto = (situacao: Situacao): boolean =>
  situacao === "PENDENTE" || situacao === "VENCIDO";

/** Atrasado é do prazo de entrega, não da vigência do que foi entregue. */
export const atrasado = (item: ChecklistItem, situacao: Situacao, dia = hoje()): boolean =>
  Boolean(item.prazoLimite) && emAberto(situacao) && item.prazoLimite!.slice(0, 10) < dia;

/**
 * Completo **hoje**.
 *
 * Item recorrente faz um checklist completo voltar a incompleto sozinho, sem
 * ninguém mexer nele — por isso a tela diz "completo hoje", e não "completo".
 */
export const completoHoje = (itens: ChecklistItem[]): boolean =>
  itens.length > 0 && itens.every((item) => {
    const situacao = situacaoDoItem(item);
    return !emAberto(situacao) && situacao !== "AGUARDANDO_CONFERENCIA";
  });
