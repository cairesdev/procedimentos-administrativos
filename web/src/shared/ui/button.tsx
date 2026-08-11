import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = ({ variant = "primary", className, ...button }: ButtonProps) => {
  const variantClass =
    variant === "secondary" ? styles.secondary : variant === "ghost" ? styles.ghost : "";
  return <button {...button} className={`${styles.button} ${variantClass} ${className ?? ""}`} />;
};
