import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Pagination.module.css";

export type PageInfo = {
  total: number;
  pagina: number;
  porPagina: number;
};

/**
 * Monta a URL da página mantendo os filtros que já estão na tela. Reconstruir
 * a query a partir do que veio permite trocar de página sem perder o filtro —
 * e sem precisar de JavaScript.
 */
const linkDaPagina = (
  base: string,
  filtros: Record<string, string | undefined>,
  pagina: number,
  param: string,
): string => {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) query.set(chave, valor);
  }
  if (pagina > 1) query.set(param, String(pagina));
  const busca = query.toString();
  return busca ? `${base}?${busca}` : base;
};

export const Pagination = ({
  info,
  base,
  filtros = {},
  param = "pagina",
}: {
  info: PageInfo;
  base: string;
  filtros?: Record<string, string | undefined>;
  /** Nome do parâmetro na URL — muda quando a tela tem duas listas. */
  param?: string;
}) => {
  const { total, pagina, porPagina } = info;
  const ultima = Math.max(1, Math.ceil(total / porPagina));

  // Uma página só não precisa de navegação — mas se alguém digitou uma página
  // além do fim, a lista vem vazia e o caminho de volta tem que aparecer.
  if (ultima <= 1 && pagina === 1) return null;

  const primeiroDaPagina = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimoDaPagina = Math.min(pagina * porPagina, total);

  return (
    <nav className={styles.paginacao} aria-label="Paginação">
      <p className={styles.contagem}>
        {total === 0
          ? "Nenhum registro nesta página"
          : `${primeiroDaPagina}–${ultimoDaPagina} de ${total}`}
      </p>

      <div className={styles.botoes}>
        {pagina > 1 ? (
          <Link
            className={styles.botao}
            href={linkDaPagina(base, filtros, pagina - 1, param)}
            rel="prev"
          >
            <ChevronLeft size={15} aria-hidden="true" />
            Anterior
          </Link>
        ) : (
          <span className={`${styles.botao} ${styles.botao_inerte}`} aria-disabled="true">
            <ChevronLeft size={15} aria-hidden="true" />
            Anterior
          </span>
        )}

        <span className={styles.posicao}>
          Página {pagina}
          {total > 0 ? ` de ${ultima}` : ""}
        </span>

        {pagina < ultima ? (
          <Link
            className={styles.botao}
            href={linkDaPagina(base, filtros, pagina + 1, param)}
            rel="next"
          >
            Próxima
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${styles.botao} ${styles.botao_inerte}`} aria-disabled="true">
            Próxima
            <ChevronRight size={15} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
};
