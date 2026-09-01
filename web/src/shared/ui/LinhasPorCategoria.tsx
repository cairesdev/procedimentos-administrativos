import { Fragment, type ReactNode } from "react";
import { agruparPorCategoria } from "@/shared/lib/categorias";
import styles from "./LinhasPorCategoria.module.css";

/**
 * As linhas de uma `Table`, separadas por categoria.
 *
 * Faixas dentro da mesma tabela, e não tabelas empilhadas: as colunas seguem
 * alinhadas de ponta a ponta, e quem compara saldo entre duas frentes não mede
 * duas grades diferentes com o olho.
 *
 * Quando o contrato não usa categorias — a maioria —, nenhuma faixa aparece.
 * Uma linha escrita "Sem categoria" acima de tudo seria ruído sobre um recurso
 * que aquele contrato não usa.
 */
export const LinhasPorCategoria = <T extends { categoria?: string | null }>({
  itens,
  colunas,
  children,
}: {
  itens: T[];
  /** Quantas colunas a faixa precisa atravessar. */
  colunas: number;
  children: (item: T) => ReactNode;
}) => {
  const grupos = agruparPorCategoria(itens);
  const comFaixa = grupos.length > 1 || grupos[0]?.categoria != null;

  return (
    <>
      {grupos.map((grupo) => (
        <Fragment key={grupo.categoria ?? "__sem_categoria__"}>
          {comFaixa ? (
            <tr>
              <th scope="rowgroup" colSpan={colunas} className={styles.faixa}>
                {grupo.categoria ?? "Sem categoria"}
              </th>
            </tr>
          ) : null}
          {grupo.itens.map((item) => children(item))}
        </Fragment>
      ))}
    </>
  );
};
