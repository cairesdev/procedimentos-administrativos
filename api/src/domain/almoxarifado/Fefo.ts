import { ErroDeNegocio } from "../shared/ErroDeNegocio";

/**
 * FEFO — *first expired, first out*: sai primeiro o que vence primeiro.
 *
 * É sugestão, não imposição. O almoxarife vê a distribuição pronta e ajusta:
 * o lote que vence antes pode estar no fundo do depósito, e obrigar a seguir a
 * ordem faria ele burlar o sistema em vez de usá-lo.
 *
 * **Validade nunca bloqueia.** Lote vencido continua sendo oferecido, marcado
 * como vencido — quem decide se aquele leite ainda serve é a nutricionista com
 * a caixa na mão, não uma data no banco.
 */

export type LoteDisponivel = {
  id: string;
  saldo: number;
  /** Nula quando o produto não vence (material de expediente, por exemplo). */
  dataValidade: string | null;
};

export type RetiradaSugerida = {
  loteId: string;
  quantidade: number;
};

/**
 * Ordem de consumo: quem vence primeiro sai primeiro; sem validade vai por
 * último, porque não corre risco de perder.
 *
 * O desempate por `id` existe para a sugestão ser a mesma em duas chamadas
 * seguidas — dois lotes com a mesma validade alternariam de posição, e o
 * almoxarife veria a tela mudar sozinha ao recarregar.
 */
export const ordenarPorValidade = (lotes: LoteDisponivel[]): LoteDisponivel[] =>
  [...lotes].sort((a, b) => {
    if (a.dataValidade === b.dataValidade) return a.id.localeCompare(b.id);
    if (a.dataValidade === null) return 1;
    if (b.dataValidade === null) return -1;
    return a.dataValidade < b.dataValidade ? -1 : 1;
  });

/**
 * Distribui a quantidade pedida entre os lotes, do que vence primeiro ao que
 * vence por último.
 *
 * Devolve o que **consegue** cobrir e quanto ficou faltando. Não estoura: o
 * atendimento parcial é normal no almoxarifado, e recusar tudo porque falta um
 * quilo obrigaria o almoxarife a refazer o pedido inteiro por fora.
 */
export const sugerirRetiradas = (
  lotes: LoteDisponivel[],
  quantidadePedida: number,
): { retiradas: RetiradaSugerida[]; faltando: number } => {
  if (quantidadePedida <= 0) {
    throw new ErroDeNegocio("A quantidade pedida precisa ser maior que zero");
  }

  const retiradas: RetiradaSugerida[] = [];
  let restante = quantidadePedida;

  for (const lote of ordenarPorValidade(lotes)) {
    if (restante <= 0) break;
    if (lote.saldo <= 0) continue;

    const quantidade = Math.min(restante, lote.saldo);
    retiradas.push({ loteId: lote.id, quantidade: arredondar(quantidade) });
    restante -= quantidade;
  }

  return { retiradas, faltando: arredondar(Math.max(0, restante)) };
};

/**
 * Três casas, como a coluna `NUMERIC(14,3)`.
 *
 * Sem isto, somar 0.1 três vezes em ponto flutuante produz 0.30000000000000004
 * e o `CHECK (confirmada + perdida = quantidade)` recusa a gravação — o erro
 * apareceria no recebimento, longe de onde nasceu.
 */
export const arredondar = (valor: number): number => Math.round(valor * 1000) / 1000;

/** Soma quantidades sem acumular resíduo de ponto flutuante. */
export const somar = (valores: number[]): number =>
  arredondar(valores.reduce((total, valor) => total + valor, 0));
