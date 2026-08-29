"use client";

import { useEffect, useState } from "react";
import { Check, Wand2 } from "lucide-react";
import { Button } from "./button";
import { Alert } from "./layout";
import { espiarColunas, type ColumnChoice } from "../lib/column-mapping";
import styles from "./ColumnMapper.module.css";

/**
 * O usuário diz o que está colando, e em que ordem.
 *
 * Antes o sistema adivinhava: procurava cabeçalho conhecido e, sem achar,
 * assumia uma ordem fixa. As planilhas variam demais — cada prefeitura tem uma
 * coluna a mais de "item nº", outra de observação no meio. Quando o palpite
 * errava, os dados entravam trocados **em silêncio**, e o erro só aparecia no
 * documento impresso.
 *
 * A detecção continua, rebaixada a sugestão: quando reconhece o cabeçalho,
 * oferece a sequência num botão. Aceitar é ato do usuário.
 */
export const ColumnMapper = <Campo extends string>({
  texto,
  campos,
  sequencia,
  onChange,
  sugestao,
}: {
  texto: string;
  campos: { campo: Campo; rotulo: string }[];
  sequencia: ColumnChoice<Campo>[];
  onChange: (sequencia: ColumnChoice<Campo>[]) => void;
  /** Sequência lida do cabeçalho, quando houver. */
  sugestao?: ColumnChoice<Campo>[] | null;
}) => {
  const amostra = espiarColunas(texto, 4);
  const colunas = amostra[0]?.length ?? 0;
  const [sugestaoAplicada, setSugestaoAplicada] = useState(false);

  /**
   * A planilha colada define quantas colunas existem. Trocar de planilha no
   * meio deixaria a sequência com tamanho errado — sobrando escolhas para
   * colunas que já não existem.
   */
  useEffect(() => {
    if (colunas > 0 && sequencia.length !== colunas) {
      onChange(Array.from({ length: colunas }, (_, indice) => sequencia[indice] ?? null));
    }
    // `onChange` e `sequencia` mudam a cada render do pai; o que importa aqui
    // é o número de colunas da planilha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colunas]);

  if (colunas === 0) {
    return (
      <Alert tone="info">
        Cole a planilha acima para escolher o que é cada coluna.
      </Alert>
    );
  }

  const trocar = (indice: number, valor: string) => {
    const proxima = [...sequencia];
    proxima[indice] = valor === "" ? null : (valor as Campo);
    onChange(proxima);
  };

  const aplicarSugestao = () => {
    if (!sugestao) return;
    onChange(Array.from({ length: colunas }, (_, indice) => sugestao[indice] ?? null));
    setSugestaoAplicada(true);
  };

  const usados = sequencia.filter((campo): campo is Campo => campo !== null);
  const repetidos = usados.filter((campo, indice) => usados.indexOf(campo) !== indice);

  return (
    <div className={styles.mapeador}>
      <div className={styles.topo}>
        <p className={styles.instrucao}>
          Diga o que é cada coluna da planilha que você colou. O que não
          interessar, deixe como <strong>ignorar</strong>.
        </p>

        {sugestao && !sugestaoAplicada ? (
          <Button type="button" variant="secondary" onClick={aplicarSugestao}>
            <Wand2 size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            Usar o cabeçalho da planilha
          </Button>
        ) : null}

        {sugestaoAplicada ? (
          <span className={styles.aplicada}>
            <Check size={14} aria-hidden="true" />
            Sequência do cabeçalho aplicada — confira abaixo
          </span>
        ) : null}
      </div>

      {repetidos.length > 0 ? (
        <Alert tone="error">
          O mesmo campo está marcado em mais de uma coluna. Só a primeira será
          usada — corrija para não importar o dado errado.
        </Alert>
      ) : null}

      <div className={styles.rolagem}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              {Array.from({ length: colunas }, (_, indice) => (
                <th key={indice}>
                  <select
                    value={sequencia[indice] ?? ""}
                    onChange={(evento) => trocar(indice, evento.target.value)}
                    aria-label={`Coluna ${indice + 1}`}
                    className={sequencia[indice] ? styles.escolhido : styles.ignorado}
                  >
                    <option value="">— ignorar —</option>
                    {campos.map((item) => (
                      <option key={item.campo} value={item.campo}>
                        {item.rotulo}
                      </option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* As primeiras linhas como vieram: é conferindo o conteúdo sob o
                rótulo que se percebe a coluna trocada. */}
            {amostra.map((linha, indiceLinha) => (
              <tr key={indiceLinha}>
                {Array.from({ length: colunas }, (_, indiceCelula) => (
                  <td key={indiceCelula}>{linha[indiceCelula] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
