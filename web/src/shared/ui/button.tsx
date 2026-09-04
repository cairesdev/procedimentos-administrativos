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
  children,
}: {
  href: string;
  variant?: Variante;
  children: ReactNode;
}) => (
  <Link href={href} className={`${styles.button} ${classeDa(variant)}`}>
    {children}
  </Link>
);
