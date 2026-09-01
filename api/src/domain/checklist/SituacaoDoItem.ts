/**
 * Em que pé está um item do checklist.
 *
 * A situação **não** é uma coluna: ela é derivada do último ciclo de
 * cumprimento. Guardá-la exigiria alguém para expirá-la quando a vigência
 * vencesse, e uma coluna dizendo "cumprido" sobre uma certidão vencida mente —
 * é a mesma classe de problema da "configuração sem efeito" que este projeto
 * já encontrou quatro vezes.
 *
 * Regra pura, sem I/O: o repositório traz o último ciclo, a decisão mora aqui.
 */

export type Ciclo = {
  situacao: "AGUARDANDO" | "ACEITO" | "RECUSADO";
  /** `null` = não vence. Item que se cumpre uma vez não tem vigência. */
  vigenciaAte: string | null;
};

export type ItemParaSituacao = {
  /** Dispensado tem justificativa e sai da cobrança. */
  dispensadoEm: string | null;
  prazoLimite: string | null;
  /** O ciclo mais recente, se houver algum. */
  ultimoCiclo: Ciclo | null;
};

export type SituacaoDoItem =
  /** Ninguém entregou nada ainda, ou o que entregou foi recusado. */
  | "PENDENTE"
  /** Entregue, esperando quem confere. */
  | "AGUARDANDO_CONFERENCIA"
  /** Aceito e dentro da vigência. */
  | "CUMPRIDO"
  /** Foi cumprido, a vigência acabou, e o item voltou a ser devido. */
  | "VENCIDO"
  /** Deixou de ser exigível, com justificativa. */
  | "DISPENSADO";

/**
 * `hoje` entra como parâmetro em vez de `new Date()` lá dentro.
 *
 * Sem isso, o teste de "vence amanhã" passaria hoje e falharia amanhã, e a
 * função dependeria do relógio da máquina para dizer a verdade.
 */
export const situacaoDoItem = (
  item: ItemParaSituacao,
  hoje: string,
): SituacaoDoItem => {
  if (item.dispensadoEm) return "DISPENSADO";

  const ciclo = item.ultimoCiclo;
  if (!ciclo) return "PENDENTE";

  if (ciclo.situacao === "AGUARDANDO") return "AGUARDANDO_CONFERENCIA";

  // Recusado volta a pendente: a recusa é resposta ao que foi entregue, e não
  // o fim da linha — quem cumpre tenta de novo.
  if (ciclo.situacao === "RECUSADO") return "PENDENTE";

  // Sem vigência, o aceite vale para sempre: é o item que se cumpre uma vez.
  if (!ciclo.vigenciaAte) return "CUMPRIDO";

  /**
   * O dia da vigência ainda conta.
   *
   * Uma certidão que vale "até 30/06" vale **no** dia 30. Usar `<` faria o
   * item vencer um dia antes do documento, e a diferença aparece justamente
   * em quem entrega no último dia do prazo.
   */
  return ciclo.vigenciaAte >= hoje ? "CUMPRIDO" : "VENCIDO";
};

/** Falta cumprir? É o que a tela conta para dizer quanto o checklist andou. */
export const estaEmAberto = (situacao: SituacaoDoItem): boolean =>
  situacao === "PENDENTE" || situacao === "VENCIDO";

/**
 * O checklist está completo **hoje**.
 *
 * "Hoje" não é firula: item recorrente faz um checklist completo voltar a
 * incompleto sozinho, quando a vigência acaba. A tela precisa dizer "completo
 * hoje", e não "completo".
 */
export const checklistCompleto = (situacoes: SituacaoDoItem[]): boolean =>
  situacoes.length > 0 && !situacoes.some(estaEmAberto)
  // Item em conferência não conta como completo: alguém ainda precisa olhar.
  && !situacoes.includes("AGUARDANDO_CONFERENCIA");

/**
 * Atrasado é o que passou do prazo sem estar cumprido.
 *
 * Prazo é para **entregar**; vigência é do que foi entregue. Um item vencido
 * pode não estar atrasado — o prazo original foi cumprido no seu tempo.
 */
export const estaAtrasado = (
  item: ItemParaSituacao, situacao: SituacaoDoItem, hoje: string,
): boolean =>
  Boolean(item.prazoLimite) && estaEmAberto(situacao) && item.prazoLimite! < hoje;

/**
 * A data final de um cumprimento, calculada.
 *
 * `cumprido + periodicidade`. O item não recorrente não vence, e devolve
 * `null` — que aqui quer dizer "não vence", nunca "esqueceram de preencher",
 * porque quem preenche é o sistema.
 */
export const vigenciaAte = (
  cumpridoEm: string,
  periodicidadeDias: number | null,
): string | null => {
  if (!periodicidadeDias) return null;

  const data = new Date(`${cumpridoEm.slice(0, 10)}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + periodicidadeDias);
  return data.toISOString().slice(0, 10);
};
