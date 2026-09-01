import type { Page } from "./pagination";

/**
 * A fronteira entre a API e a tela.
 *
 * Uma resposta da API é dado externo. O TypeScript diz que `listReturns`
 * devolve `Page<StockReturn>` porque **nós** escrevemos isso no genérico — em
 * tempo de execução ali chega o que o servidor mandou, e o compilador não
 * confere nada. Enquanto o formato bate, ninguém percebe a diferença; no dia em
 * que não bate, o erro não aparece na consulta e sim no render, três camadas
 * adiante, como `Cannot read properties of null (reading 'id')` dentro de um
 * `.map`. Foi exatamente assim que a tela de devoluções quebrou: o mapa lia
 * `lote.id` de um furo na lista, e o navegador mostrava a tela em branco sem
 * nada no log do servidor.
 *
 * Estas duas funções são o filtro. Uma lista sempre vira array — e array denso,
 * sem buracos. Uma página sempre vira envelope com os quatro campos. Quando o
 * que chega não serve, a tela mostra "nenhum registro" em vez de morrer: o
 * usuário vê uma lista vazia, que é falso mas legível, em vez de uma página
 * branca, que não é nada.
 */
export const lista = <T>(valor: unknown): T[] =>
  (Array.isArray(valor) ? valor.filter((item) => item != null) : []) as T[];

export const pagina = <T>(valor: unknown): Page<T> => {
  const envelope = (valor ?? {}) as Partial<Page<T>>;
  const itens = lista<T>(envelope.itens);

  return {
    itens,
    // `total` fora da página atual: é a contagem do banco, não do array.
    total: Number.isFinite(envelope.total) ? Number(envelope.total) : itens.length,
    pagina: Number.isFinite(envelope.pagina) ? Number(envelope.pagina) : 1,
    porPagina: Number.isFinite(envelope.porPagina)
      ? Number(envelope.porPagina)
      : Math.max(itens.length, 1),
  };
};
