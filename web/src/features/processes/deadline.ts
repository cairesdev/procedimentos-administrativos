import type { Process } from "./types";

export type DeadlineState = "sem-prazo" | "no-prazo" | "vencendo" | "atrasado";

export type Deadline = {
  state: DeadlineState;
  label: string;
  tone: "neutral" | "success" | "warning";
};

/** A partir de quantos dias restantes a etapa entra em alerta. */
const LIMIAR_ALERTA = 2;

/**
 * Traduz `diasParaVencer` (negativo = atrasado) no que a fila mostra. A conta
 * vem do banco, com `now()` do servidor — o relógio do navegador não entra.
 */
export const deadlineOf = (process: Process): Deadline => {
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
  if (dias <= LIMIAR_ALERTA) {
    return {
      state: "vencendo",
      label: dias === 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`,
      tone: "warning",
    };
  }
  return { state: "no-prazo", label: `${dias} dias`, tone: "success" };
};

export const countLate = (processes: Process[]): number =>
  processes.filter((process) => deadlineOf(process).state === "atrasado").length;

export const countDueSoon = (processes: Process[]): number =>
  processes.filter((process) => deadlineOf(process).state === "vencendo").length;
