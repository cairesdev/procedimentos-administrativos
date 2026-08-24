/**
 * Paginação das listas que crescem sem teto (processos, bens, viagens…).
 * Cadastro pequeno — unidade, setor, categoria, veículo — continua devolvendo
 * array puro: paginar o que cabe numa tela só atrapalha quem consome.
 */
export type Paginacao = {
  pagina: number;
  porPagina: number;
};

export type Pagina<T> = Paginacao & {
  itens: T[];
  total: number;
};

export const POR_PAGINA_PADRAO = 25;
export const POR_PAGINA_MAXIMO = 100;

/** OFFSET a partir da página, que na interface começa em 1. */
export const deslocamentoDe = ({ pagina, porPagina }: Paginacao): number =>
  (pagina - 1) * porPagina;

/** Coluna que as queries paginadas trazem com `COUNT(*) OVER() AS "_total"`. */
type ComTotal = { _total: string | number };

/**
 * Separa o total da janela das colunas de dados. Contar na mesma query evita
 * um segundo SELECT e garante que total e página vêm do mesmo instante — dois
 * roundtrips poderiam discordar sob escrita concorrente.
 *
 * Página além do fim devolve zero linhas e, com isso, total zero: quem exibe
 * precisa continuar oferecendo o caminho de volta em vez de confiar no total.
 */
export const montarPagina = <T>(linhas: (T & ComTotal)[], paginacao: Paginacao): Pagina<T> => ({
  itens: linhas.map(({ _total, ...resto }) => resto as unknown as T),
  total: linhas.length > 0 ? Number(linhas[0]!._total) : 0,
  pagina: paginacao.pagina,
  porPagina: paginacao.porPagina,
});

/** Trecho fixo das queries paginadas — mantém o alias igual em todo lugar. */
export const TOTAL_DA_JANELA = `COUNT(*) OVER() AS "_total"`;
