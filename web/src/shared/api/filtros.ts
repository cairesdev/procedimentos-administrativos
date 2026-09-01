/**
 * Monta a querystring, omitindo o que está vazio.
 *
 * Vazio fica **fora** da URL: `?local=` chega à API como string vazia, e a
 * cadeia inteira já quebrou uma vez assim — o `""` seguia até o SQL como
 * `$n::uuid` e quatro telas respondiam "Erro interno". A API se defende com
 * `filtroDaQuery`; aqui o cuidado é o outro lado da mesma moeda.
 *
 * Nasceu dentro das consultas do estoque e saiu de lá quando ganhou o segundo
 * usuário: duas cópias já são o começo de dois comportamentos.
 */
export const comFiltros = (
  base: string,
  filtros: Record<string, string | undefined>,
): string => {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) query.set(chave, valor);
  }
  return `${base}${query.size > 0 ? `?${query}` : ""}`;
};
