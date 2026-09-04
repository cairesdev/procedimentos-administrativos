import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import styles from "./button.module.css";

type Variante = "primary" | "secondary" | "ghost";

const classeDa = (variant: Variante) =>
  variant === "secondary" ? styles.secondary : variant === "ghost" ? styles.ghost : "";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variante;
};

export const Button = ({ variant = "primary", className, ...button }: ButtonProps) => (
  <button {...button} className={`${styles.button} ${classeDa(variant)} ${className ?? ""}`} />
);

/**
 * Um link com cara de botão.
 *
 * Onde a ação é ir para outro lugar — "Limpar" que volta à lista sem filtro,
 * "Ver todos", "Voltar" — o elemento certo é `<a>`: abre em nova aba com
 * ctrl+clique, aparece no histórico e funciona sem JavaScript. Um `<button>`
 * com `router.push` dentro parece a mesma coisa e perde as três.
 */
export const LinkButton = ({
  href,
  variant = "secondary",
  arquivo,
  children,
}: {
  href: string;
  variant?: Variante;
  /**
   * O destino é um arquivo, não uma página.
   *
   * `next/link` faz duas coisas que um download não quer: pré-carrega o
   * destino ao passar o mouse — e "passar o mouse" viraria montar o zip do
   * processo no servidor — e navega pelo roteador, que não sabe o que fazer
   * com uma resposta que não é página. O `<a>` cru entrega ao navegador, que
   * lê o `Content-Disposition` e salva.
   */
  arquivo?: boolean;
  children: ReactNode;
}) => {
  const className = `${styles.button} ${classeDa(variant)}`;
  return arquivo ? (
    <a href={href} className={className} download>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
};
