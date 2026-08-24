/**
 * Espelho do envelope que a API devolve nas listas que crescem sem teto.
 * Cadastro pequeno (unidade, setor, categoria, veículo) segue vindo como
 * array puro — se um dia paginar, é aqui que o tipo muda.
 */
export type Page<T> = {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
};

/** Página vazia, para quando a tela não pode nem chamar a API (sem permissão). */
export const emptyPage = <T>(porPagina = 25): Page<T> => ({
  itens: [],
  total: 0,
  pagina: 1,
  porPagina,
});

/**
 * Acrescenta `?pagina=` à query de uma listagem. Página 1 não vai na URL:
 * link limpo e um endereço só para a primeira página.
 */
export const withPage = (
  query: URLSearchParams,
  pagina?: string | number,
  porPagina?: number,
): URLSearchParams => {
  const numero = Number(pagina ?? 1);
  if (Number.isFinite(numero) && numero > 1) query.set("pagina", String(Math.floor(numero)));
  if (porPagina) query.set("porPagina", String(porPagina));
  return query;
};

/** Teto que a API aceita por página. Vale para o modo "carregar tudo". */
export const POR_PAGINA_MAXIMO = 100;

/**
 * Junta todas as páginas de uma listagem.
 *
 * Existe por causa dos formulários de seleção: um `<select>` de contratos que
 * mostra só os 25 primeiros esconde opção sem avisar, e o usuário conclui que
 * o contrato "sumiu". Tela de listagem NÃO deve usar isto — lá a página é o
 * ponto. O limite de voltas evita laço infinito se o total vier torto.
 */
export const allOf = async <T>(
  carregar: (pagina: number) => Promise<Page<T>>,
  maximoDeVoltas = 20,
): Promise<T[]> => {
  const primeira = await carregar(1);
  const itens = [...primeira.itens];

  const ultima = Math.ceil(primeira.total / primeira.porPagina);
  for (let pagina = 2; pagina <= Math.min(ultima, maximoDeVoltas); pagina += 1) {
    const seguinte = await carregar(pagina);
    if (seguinte.itens.length === 0) break;
    itens.push(...seguinte.itens);
  }
  return itens;
};
