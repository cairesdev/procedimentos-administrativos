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

export type Peso = "OBRIGATORIA" | "ESSENCIAL" | "RECOMENDADA" | "SEM_PESO";

/**
 * Quanto falta, por peso — espelhado do domínio da API.
 *
 * "Faltam 3 obrigatórias e 1 essencial" diz onde correr; "faltam 4" só diz que
 * há trabalho. A tela precisa da primeira, e o TCE cobra a obrigatória.
 */
export const pendenciasPorPeso = (itens: ChecklistItem[]): Record<Peso, number> & {
  total: number;
} => {
  const contagem = {
    OBRIGATORIA: 0, ESSENCIAL: 0, RECOMENDADA: 0, SEM_PESO: 0, total: 0,
  };

  for (const item of itens) {
    if (!emAberto(situacaoDoItem(item))) continue;
    contagem[(item.classificacao ?? "SEM_PESO") as Peso] += 1;
    contagem.total += 1;
  }
  return contagem;
};

/** A frase, com a concordância certa: "1 obrigatória" e "3 obrigatórias". */
export const resumoDePendencias = (
  contagem: Record<Peso, number> & { total: number },
): string => {
  if (contagem.total === 0) return "sem pendências";

  const partes: string[] = [];
  const dizer = (quantas: number, singular: string, plural: string) => {
    if (quantas > 0) partes.push(`${quantas} ${quantas === 1 ? singular : plural}`);
  };

  dizer(contagem.OBRIGATORIA, "obrigatória", "obrigatórias");
  dizer(contagem.ESSENCIAL, "essencial", "essenciais");
  dizer(contagem.RECOMENDADA, "recomendada", "recomendadas");
  dizer(contagem.SEM_PESO, "item", "itens");

  if (partes.length === 1) return partes[0]!;
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
};

/**
 * Os itens agrupados pela seção, na ordem em que aparecem.
 *
 * `Map` preserva a ordem de inserção, e a ordem dos itens é a do PNTP — que
 * não é alfabética nem numérica: as dimensões vêm na sequência do Tribunal.
 */
export const porSecao = (itens: ChecklistItem[]): [string, ChecklistItem[]][] => {
  const grupos = new Map<string, ChecklistItem[]>();
  for (const item of itens) {
    const chave = item.secao?.trim() || "";
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  return [...grupos.entries()];
};
