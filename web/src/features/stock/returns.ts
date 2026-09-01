import type { LocalStock } from "./types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Mesma coisa que `toDate` de `shared/ui/labels`, repetida de propósito.
 *
 * Este módulo não importa nada da interface para poder ser testado com
 * `node --test` puro — o alias `@/` do Next não existe fora do bundler, e a
 * regra que quebrou a tela merece um teste que roda no CI sem navegador.
 * Duas linhas de fórmula de data é preço baixo por isso.
 */
const emData = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export type OpcaoDeLote = { id: string; rotulo: string; saldo: number };

/**
 * As opções do seletor de devolução, uma por lote.
 *
 * Fora do componente por dois motivos. O primeiro é que dá para testar sem
 * navegador — e é aqui que mora a regra que quebrou a tela. O segundo é que
 * este é o ponto onde dado externo vira interface: `LocalStock[]` é uma
 * promessa nossa sobre o que a API devolve, não uma garantia do compilador.
 *
 * A versão anterior fazia `produto.lotes.map((lote) => ({ id: lote.id }))`
 * confiando na promessa. Um furo na lista — um `null` entre os lotes — e o
 * `.map` lia `null.id` **durante o render**: o React aborta a árvore inteira,
 * o usuário vê tela branca e o servidor não registra nada, porque o erro
 * aconteceu no navegador. Aqui nada é assumido: lote sem id utilizável não
 * vira opção, e a tela mostra "sem saldo para devolver" em vez de morrer.
 */
export const opcoesDeLote = (estoque: LocalStock[]): OpcaoDeLote[] => {
  if (!Array.isArray(estoque)) return [];

  return estoque.flatMap((produto) => {
    const lotes = Array.isArray(produto?.lotes) ? produto.lotes : [];

    return lotes.flatMap((lote) => {
      if (!lote?.id) return [];
      const saldo = Number(lote.saldo) || 0;
      const unidade = produto.unidadeMedida ? ` ${produto.unidadeMedida}` : "";

      return [{
        id: lote.id,
        saldo,
        rotulo: `${produto.produtoNome ?? "produto"} · ${formatar(saldo)}${unidade}`
          + (lote.dataValidade ? ` · vence ${emData(lote.dataValidade)}` : " · sem validade"),
      }];
    });
  });
};
