"use client";

import { useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useController } from "react-hook-form";
import { FieldWrapper } from "./form-field";
import { amountToMasked, digitsToAmount, maskWhileTyping } from "./money";
import styles from "./form-field.module.css";

type CurrencyFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  hint?: string;
  wide?: boolean;
};

// Guarda número em reais no formulário e mostra 1.234,56 para o usuário.
export const CurrencyField = <T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  wide,
}: CurrencyFieldProps<T>) => {
  const { field, fieldState } = useController({ control, name });
  const [display, setDisplay] = useState(() => amountToMasked(field.value as number));

  return (
    <FieldWrapper
      name={name}
      label={label}
      required={required}
      hint={hint}
      wide={wide}
      error={fieldState.error?.message}
    >
      <div className={styles.prefixed}>
        <span className={styles.prefix} aria-hidden="true">
          R$
        </span>
        <input
          id={name}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0,00"
          className={`${styles.control} ${styles.control_prefixed} ${
            fieldState.error ? styles.control_invalid : ""
          }`}
          value={display}
          onChange={(event) => {
            setDisplay(maskWhileTyping(event.target.value));
            field.onChange(digitsToAmount(event.target.value));
          }}
          onBlur={() => {
            setDisplay(amountToMasked(field.value as number));
            field.onBlur();
          }}
        />
      </div>
    </FieldWrapper>
  );
};
