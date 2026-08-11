"use client";

import { useMemo, useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";
import { FieldWrapper, type Option } from "./form-field";
import styles from "./TagSelect.module.css";

type TagSelectProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: Option[];
  required?: boolean;
  hint?: string;
  searchPlaceholder?: string;
};

// Seleção múltipla em chips: escolhidos viram tags removíveis, o restante
// fica como sugestão filtrável — substitui o <select multiple>.
export const TagSelect = <T extends FieldValues>({
  control,
  name,
  label,
  options,
  required,
  hint,
  searchPlaceholder = "Buscar…",
}: TagSelectProps<T>) => {
  const { field, fieldState } = useController({ control, name });
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const selected = useMemo<string[]>(
    () => (Array.isArray(field.value) ? field.value : []),
    [field.value],
  );

  const available = useMemo(
    () =>
      options.filter(
        (option) =>
          !selected.includes(option.value) &&
          option.label.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [options, selected, search],
  );

  const add = (value: string) => {
    field.onChange([...selected, value]);
    setSearch("");
  };

  const remove = (value: string) =>
    field.onChange(selected.filter((item) => item !== value));

  return (
    <FieldWrapper
      name={name}
      label={label}
      required={required}
      hint={hint}
      wide
      error={fieldState.error?.message}
    >
      <div className={`${styles.box} ${focused ? styles.box_focused : ""}`}>
        <div className={styles.selected}>
          {selected.length === 0 ? (
            <span className={styles.placeholder}>Nenhuma selecionada</span>
          ) : (
            selected.map((value) => {
              const option = options.find((item) => item.value === value);
              return (
                <span key={value} className={styles.tag}>
                  {option?.label ?? value}
                  <button
                    type="button"
                    className={styles.tag_remove}
                    onClick={() => remove(value)}
                    aria-label={`Remover ${option?.label ?? value}`}
                  >
                    ×
                  </button>
                </span>
              );
            })
          )}
        </div>

        <input
          id={name}
          className={styles.search}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            field.onBlur();
          }}
        />

        <div className={styles.options}>
          {available.length === 0 ? (
            <span className={styles.empty}>
              {options.length === selected.length ? "Todas selecionadas" : "Nada encontrado"}
            </span>
          ) : (
            available.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.option}
                onClick={() => add(option.value)}
              >
                + {option.label}
              </button>
            ))
          )}
        </div>

        {options.length > 1 ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              onClick={() => field.onChange(options.map((option) => option.value))}
            >
              Selecionar todas
            </button>
            {selected.length > 0 ? (
              <button type="button" className={styles.action} onClick={() => field.onChange([])}>
                Limpar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </FieldWrapper>
  );
};
