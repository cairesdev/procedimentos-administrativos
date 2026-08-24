import type { Process } from "./types";

export type DeadlineState = "sem-prazo" | "no-prazo" | "vencendo" | "atrasado";

export type Deadline = {
  state: DeadlineState;
  label: string;
  tone: "neutral" | "success" | "warning";
};

/**
 * Traduz `diasParaVencer` (negativo = atrasado) no que a fila mostra. A conta
 * vem do banco, com `now()` do servidor — o relógio do navegador não entra.
 *
 * O limiar chega junto da fila (`limiarAlertaDias`): a API é quem conta os
 * processos em alerta, e uma segunda cópia do número aqui acabaria divergindo.
 */
export const deadlineOf = (process: Process, limiarAlertaDias: number): Deadline => {
  const dias = process.diasParaVencer;

  if (dias === null) {
    return { state: "sem-prazo", label: "sem prazo", tone: "neutral" };
  }
  if (dias < 0) {
    const atraso = Math.abs(dias);
    return {
      state: "atrasado",
      label: atraso === 1 ? "1 dia de atraso" : `${atraso} dias de atraso`,
      tone: "warning",
    };
  }
  if (dias <= limiarAlertaDias) {
    return {
      state: "vencendo",
      label: dias === 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`,
      tone: "warning",
    };
  }
  return { state: "no-prazo", label: `${dias} dias`, tone: "success" };
};
