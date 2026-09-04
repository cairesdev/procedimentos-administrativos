import type { ReactNode } from "react";
import { Button, LinkButton } from "./button";
import styles from "./FilterBar.module.css";

/**
 * A barra de filtro das listagens, num lugar só.
 *
 * Quinze telas montavam a sua à mão, e o resultado era um sistema com dois
 * sotaques: o formulário tinha rótulo acima do campo, borda e altura; o filtro
 * tinha `aria-label` e o `<select>` cru do navegador. Na mesma tela.
 *
 * `method="get"` de propósito: o recorte vira query string, e o endereço passa
 * a descrever a lista. Recarregar, favoritar, mandar para o colega — tudo
 * continua funcionando, e a tela é server component como o resto. Filtro que
 * aplica sozinho no `onChange` exigiria JavaScript e devolveria um endereço que
 * não leva a lugar nenhum.
 */
export const FilterBar = ({
  children,
  ativo,
  base,
  acao = "Filtrar",
}: {
  /** Os campos, normalmente `FilterField`. */
  children: ReactNode;
  /**
   * Há filtro aplicado? É o que decide mostrar "Limpar".
   *
   * Um "Limpar" sempre visível é um botão que na maior parte do tempo não faz
   * nada — e some justamente quando a pessoa não entende por que a lista está
   * vazia.
   */
  ativo?: boolean;
  /** Para onde o "Limpar" leva: a mesma tela, sem query. */
  base: string;
  /** "Filtrar" é a palavra que o sistema já usava; "Ver saldo" onde o verbo muda. */
  acao?: string;
}) => (
  <form method="get" className={styles.barra}>
    {children}
    <div className={styles.acoes}>
      <Button type="submit" variant="secondary">{acao}</Button>
      {ativo ? <LinkButton href={base} variant="ghost">Limpar</LinkButton> : null}
    </div>
  </form>
);

/**
 * Um campo da barra, com rótulo visível.
 *
 * O `aria-label` que as telas usavam serve ao leitor de tela e não serve a
 * quem enxerga: diante de três `<select>` lado a lado, sem rótulo, a pessoa
 * abre um a um para descobrir qual é qual.
 */
export const FilterField = ({
  label,
  htmlFor,
  largo,
  children,
}: {
  label: string;
  /** O `name`/`id` do campo — liga o rótulo ao controle. */
  htmlFor: string;
  /** Campo de texto livre, que merece mais espaço que um seletor. */
  largo?: boolean;
  children: ReactNode;
}) => (
  <div className={`${styles.campo} ${largo ? styles.campo_largo : ""}`}>
    <label className={styles.rotulo} htmlFor={htmlFor}>{label}</label>
    {children}
  </div>
);
