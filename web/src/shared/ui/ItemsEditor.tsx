"use client";

import { useState, type ClipboardEvent } from "react";
import type { ArrayPath, Control, FieldArray, FieldValues, Path } from "react-hook-form";
import { useFieldArray, useWatch, type UseFormRegister } from "react-hook-form";
import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";
import { Alert } from "./layout";
import {
  CAMPOS_DO_ITEM, converterItensComSequencia, sugerirSequenciaDeItens,
  type PastedItem,
} from "@/shared/lib/spreadsheet-paste";
import type { ColumnChoice } from "@/shared/lib/column-mapping";
import { ColumnMapper } from "@/shared/ui/ColumnMapper";
import { toCurrency } from "./labels";
import styles from "./ItemsEditor.module.css";

export const emptyItem = {
  produto: "",
  descricao: "",
  unidadeMedida: "",
  marca: "",
  quantidade: 0,
  modoMedicao: "UNIDADE" as const,
  valorUnitario: 0,
  valorTotal: 0,
};

const MEASUREMENT_MODES = [
  { value: "UNIDADE", label: "Unidade" },
  { value: "PERCENTUAL", label: "Percentual" },
  { value: "VALOR", label: "Valor" },
];

type ItemsEditorProps<T extends FieldValues> = {
  control: Control<T>;
  register: UseFormRegister<T>;
  name: ArrayPath<T>;
  /** Mostrado quando a soma dos itens não bate com o valor informado. */
  expectedTotal?: number;
  /** Contrato define o modo de medição por item; ata não usa. */
  withMeasurementMode?: boolean;
  error?: string;
};

/**
 * Colagem do Excel/CSV em duas etapas: cola, diz o que é cada coluna, importa.
 *
 * A etapa do meio nasceu de importação que entrava trocada. O sistema
 * adivinhava a ordem quando não reconhecia o cabeçalho, e planilha com uma
 * coluna a mais no começo fazia quantidade virar valor — sem erro, sem aviso,
 * e o usuário só descobria no documento impresso.
 */
export const ItemsEditor = <T extends FieldValues>({
  control,
  register,
  name,
  expectedTotal,
  withMeasurementMode = false,
  error,
}: ItemsEditorProps<T>) => {
  const items = useFieldArray({ control, name });
  const [showPasteBox, setShowPasteBox] = useState(false);

  // O texto fica retido até o usuário confirmar o que é cada coluna.
  const [textoColado, setTextoColado] = useState("");
  const [sequencia, setSequencia] = useState<ColumnChoice<keyof PastedItem>[]>([]);

  const watched = useWatch({ control, name: name as unknown as Path<T> }) as
    | PastedItem[]
    | undefined;

  const total = (watched ?? []).reduce((sum, item) => sum + Number(item?.valorTotal ?? 0), 0);
  const divergence = expectedTotal ? Math.abs(expectedTotal - total) > 0.01 : false;

  /** Recebe o texto e abre o mapeamento — nada entra na tabela ainda. */
  const receber = (text: string) => {
    setTextoColado(text);
    setSequencia(sugerirSequenciaDeItens(text) ?? []);
    setShowPasteBox(true);
  };

  const importar = () => {
    if (!sequencia.some((campo) => campo === "produto")) {
      toast.error("Aponte qual coluna é o produto — sem ela não dá para importar.");
      return;
    }

    const result = converterItensComSequencia(textoColado, sequencia);
    if (result.items.length === 0) {
      toast.error("Nenhuma linha com produto. Confira o que você marcou como coluna de produto.");
      return;
    }

    const current = (watched ?? []).filter((item) => item?.produto?.trim());
    const incoming = result.items.map((item) => ({ ...emptyItem, ...item }));
    items.replace([...current, ...incoming] as FieldArray<T, ArrayPath<T>>[]);

    setShowPasteBox(false);
    setTextoColado("");
    setSequencia([]);

    toast.success(
      `${result.items.length} ${result.items.length === 1 ? "item importado" : "itens importados"}`
        + (result.hasHeader ? " · linha de cabeçalho descartada" : "")
        + (result.ignoredLines > 0 ? ` · ${result.ignoredLines} linha(s) sem produto` : ""),
    );
  };

  const onPaste = (event: ClipboardEvent) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n") && !text.includes(";")) return;
    event.preventDefault();
    receber(text);
  };

  return (
    <div className={styles.editor} onPaste={onPaste}>
      {showPasteBox ? (
        <div className={styles.paste_zone}>
          <p className={styles.paste_title}>
            <ClipboardPaste size={16} aria-hidden="true" />
            Cole aqui as linhas copiadas da planilha
          </p>
          <textarea
            autoFocus
            className={styles.paste_input}
            placeholder={"Produto\tUnidade\tQuantidade\tValor unitário\tValor total"}
            value={textoColado}
            onChange={(event) => receber(event.target.value)}
          />

          {textoColado ? (
            <>
              <ColumnMapper
                texto={textoColado}
                campos={CAMPOS_DO_ITEM}
                sequencia={sequencia}
                onChange={setSequencia}
                sugestao={sugerirSequenciaDeItens(textoColado)}
              />

              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <Button type="button" onClick={importar}>
                  Importar itens
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setTextoColado("");
                    setSequencia([]);
                    setShowPasteBox(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.paste_hint}>
              Números no formato brasileiro. Depois de colar, você diz o que é cada coluna —
              nada entra na tabela antes disso.
            </p>
          )}
        </div>
      ) : null}

      <div className={styles.table_wrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Descrição</th>
              <th>Unidade</th>
              <th>Marca</th>
              {withMeasurementMode ? <th>Medição</th> : null}
              <th>Quantidade</th>
              <th>Valor unitário</th>
              <th>Valor total</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {items.fields.map((field, index) => (
              <tr key={field.id}>
                <td>
                  <input
                    className={styles.cell_input}
                    placeholder="Copo descartável"
                    {...register(`${name}.${index}.produto` as Path<T>)}
                  />
                </td>
                <td>
                  <input
                    className={styles.cell_input}
                    {...register(`${name}.${index}.descricao` as Path<T>)}
                  />
                </td>
                <td>
                  <input
                    className={styles.cell_input}
                    placeholder="UN"
                    style={{ minWidth: "66px" }}
                    {...register(`${name}.${index}.unidadeMedida` as Path<T>)}
                  />
                </td>
                <td>
                  <input
                    className={styles.cell_input}
                    {...register(`${name}.${index}.marca` as Path<T>)}
                  />
                </td>
                {withMeasurementMode ? (
                  <td>
                    <select
                      className={styles.cell_input}
                      style={{ minWidth: "112px" }}
                      {...register(`${name}.${index}.modoMedicao` as Path<T>)}
                    >
                      {MEASUREMENT_MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : null}
                <td>
                  <input
                    type="number"
                    step="0.001"
                    className={`${styles.cell_input} ${styles.cell_number}`}
                    {...register(`${name}.${index}.quantidade` as Path<T>)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.0001"
                    className={`${styles.cell_input} ${styles.cell_number}`}
                    {...register(`${name}.${index}.valorUnitario` as Path<T>)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className={`${styles.cell_input} ${styles.cell_number}`}
                    {...register(`${name}.${index}.valorTotal` as Path<T>)}
                  />
                </td>
                <td>
                  {items.fields.length > 1 ? (
                    <button
                      type="button"
                      className={styles.row_remove}
                      onClick={() => items.remove(index)}
                      aria-label={`Remover item ${index + 1}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className={styles.footer}>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => items.append(emptyItem as FieldArray<T, ArrayPath<T>>)}
          >
            <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            Nova linha
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowPasteBox((open) => !open)}>
            <ClipboardPaste
              size={15}
              aria-hidden="true"
              style={{ verticalAlign: "-2px", marginRight: "6px" }}
            />
            Colar da planilha
          </Button>
        </div>

        <p className={`${styles.total} ${divergence ? styles.divergence : ""}`}>
          {items.fields.length} {items.fields.length === 1 ? "item" : "itens"} · soma{" "}
          <strong>{toCurrency(total)}</strong>
          {divergence ? " — diferente do valor informado" : ""}
        </p>
      </div>
    </div>
  );
};
