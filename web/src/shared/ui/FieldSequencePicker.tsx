"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Alert } from "./layout";
import type { FieldSpec } from "../lib/pdf-paste";
import styles from "./FieldSequencePicker.module.css";

/**
 * Quais campos o texto traz, e em que ordem.
 *
 * Vem de colagem de PDF, onde não há coluna nenhuma para mapear: a tabela chega
 * como um parágrafo só. O usuário marca o que está presente — a ordem de
 * marcação vira a sequência — e reordena se precisar.
 *
 * A ordem que importa é a do **texto**, não a do cabeçalho. Num orçamento real
 * o título dizia `UND QTD` e o dado vinha `12 Mês`: invertido. É por isso que
 * ninguém adivinha nada aqui.
 */
export const FieldSequencePicker = <Campo extends string>({
  disponiveis,
  sequencia,
  onChange,
}: {
  disponiveis: FieldSpec<Campo>[];
  sequencia: FieldSpec<Campo>[];
  onChange: (sequencia: FieldSpec<Campo>[]) => void;
}) => {
  const marcado = (campo: Campo) => sequencia.some((item) => item.campo === campo);

  const alternar = (spec: FieldSpec<Campo>) => {
    onChange(
      marcado(spec.campo)
        ? sequencia.filter((item) => item.campo !== spec.campo)
        // Entra no fim: a ordem de marcação é a ordem do texto, que é como o
        // usuário lê o documento — da esquerda para a direita.
        : [...sequencia, spec],
    );
  };

  const mover = (indice: number, passo: -1 | 1) => {
    const destino = indice + passo;
    if (destino < 0 || destino >= sequencia.length) return;

    const proxima = [...sequencia];
    [proxima[indice], proxima[destino]] = [proxima[destino]!, proxima[indice]!];
    onChange(proxima);
  };

  const textosLivres = sequencia.filter((item) => item.tipo === "texto");

  return (
    <div className={styles.seletor}>
      <div>
        <p className={styles.titulo}>1. Marque os campos que o texto traz</p>
        <div className={styles.opcoes}>
          {disponiveis.map((spec) => (
            <label key={spec.campo} className={marcado(spec.campo) ? styles.marcada : styles.opcao}>
              <input
                type="checkbox"
                checked={marcado(spec.campo)}
                onChange={() => alternar(spec)}
              />
              {spec.rotulo}
            </label>
          ))}
        </div>
      </div>

      {textosLivres.length > 1 ? (
        <Alert tone="error">
          Só pode haver um campo de texto longo — {textosLivres.map((item) => item.rotulo).join(" e ")}.
          Com dois, não há como saber onde um termina e o outro começa.
        </Alert>
      ) : null}

      {sequencia.length > 0 ? (
        <div>
          <p className={styles.titulo}>
            2. Confira a ordem em que eles aparecem <strong>no texto</strong>
          </p>

          <ol className={styles.ordem}>
            {sequencia.map((spec, indice) => (
              <li key={spec.campo} className={styles.item}>
                <span className={styles.posicao}>{indice + 1}</span>
                <span className={styles.rotulo}>{spec.rotulo}</span>
                <span className={styles.tipo}>
                  {spec.tipo === "numero" ? "número" : spec.tipo === "texto" ? "texto longo" : "palavra"}
                </span>

                <span className={styles.setas}>
                  <button
                    type="button"
                    onClick={() => mover(indice, -1)}
                    disabled={indice === 0}
                    aria-label={`Mover ${spec.rotulo} para cima`}
                  >
                    <ArrowUp size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(indice, 1)}
                    disabled={indice === sequencia.length - 1}
                    aria-label={`Mover ${spec.rotulo} para baixo`}
                  >
                    <ArrowDown size={13} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
};
