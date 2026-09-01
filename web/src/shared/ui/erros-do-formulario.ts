/**
 * A primeira mensagem de erro, onde quer que ela esteja.
 *
 * O objeto de erros do react-hook-form é uma árvore que espelha o formato dos
 * dados: `itens.2.titulo` vira `{ itens: [ , , { titulo: { message } } ] }`, e
 * uma regra sobre o array inteiro vira `{ itens: { message } }`. Procurar em
 * profundidade é o que permite dizer *qual* item está errado, em vez de um
 * "formulário inválido" que não ajuda ninguém.
 *
 * Mora fora do `use-resource-form` — que é componente de cliente e arrasta
 * react-hook-form, sonner e o roteador do Next — para poder ser testado com
 * `node --test` puro. A regra é pequena e o teste é o que garante que o botão
 * nunca mais fique mudo.
 */
export const primeiraMensagem = (erros: unknown): string | undefined => {
  if (!erros || typeof erros !== "object") return undefined;

  const mensagem = (erros as { message?: unknown }).message;
  if (typeof mensagem === "string" && mensagem) return mensagem;

  for (const valor of Object.values(erros)) {
    const encontrada = primeiraMensagem(valor);
    if (encontrada) return encontrada;
  }
  return undefined;
};
