"use client";

import type { ReactNode } from "react";
import styles from "./ChoiceCards.module.css";

export type Escolha<T extends string> = {
  valor: T;
  titulo: string;
  dica?: string;
  icone?: ReactNode;
};

/**
 * Uma pergunta de caminho, em cartões.
 *
 * Existe porque a primeira decisão de um assistente não é um campo — é uma
 * bifurcação. Num `<select>` de duas opções o usuário lê dois rótulos curtos e
 * adivinha o resto; em cartões cabe a frase que explica o que cada caminho
 * significa, e a escolha fica visível enquanto ele preenche o resto.
 */
export const ChoiceCards = <T extends string>({
  escolhas,
  valor,
  onEscolher,
  legenda,
}: {
  escolhas: Escolha<T>[];
  valor: T | "";
  onEscolher: (valor: T) => void;
  /** Lido por leitor de tela no lugar de um rótulo visível. */
  legenda: string;
}) => (
  <div className={styles.cartoes} role="radiogroup" aria-label={legenda}>
    {escolhas.map((escolha) => {
      const ativo = valor === escolha.valor;

      return (
        <button
          key={escolha.valor}
          type="button"
          role="radio"
          aria-checked={ativo}
          className={`${styles.cartao} ${ativo ? styles.cartao_ativo : ""}`}
          onClick={() => onEscolher(escolha.valor)}
        >
          {escolha.icone}
          <span className={styles.cartao_titulo}>{escolha.titulo}</span>
          {escolha.dica ? <span className={styles.cartao_dica}>{escolha.dica}</span> : null}
        </button>
      );
    })}
  </div>
);
