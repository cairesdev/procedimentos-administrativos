import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import styles from "./form-field.module.css";

type FieldWrapperProps = {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
};

export const FieldWrapper = ({
  name,
  label,
  required,
  hint,
  error,
  wide,
  children,
}: FieldWrapperProps) => (
  <div className={`${styles.field} ${wide ? styles.wide : ""}`}>
    <label className={styles.label} htmlFor={name}>
      {label}
      {required ? <span className={styles.required}> *</span> : null}
    </label>
    {children}
    {error ? <span className={styles.error}>{error}</span> : null}
    {hint && !error ? <span className={styles.hint}>{hint}</span> : null}
  </div>
);

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  wide?: boolean;
  ref?: Ref<HTMLInputElement>;
};

export const InputField = ({ label, hint, error, wide, ref, ...input }: InputProps) => (
  <FieldWrapper
    name={input.name}
    label={label}
    required={input.required}
    hint={hint}
    error={error}
    wide={wide}
  >
    <input
      {...input}
      ref={ref}
      id={input.name}
      className={`${styles.control} ${error ? styles.control_invalid : ""}`}
    />
  </FieldWrapper>
);

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  wide?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
};

export const TextareaField = ({ label, hint, error, wide, ref, ...textarea }: TextareaProps) => (
  <FieldWrapper
    name={textarea.name}
    label={label}
    required={textarea.required}
    hint={hint}
    error={error}
    wide={wide}
  >
    <textarea
      {...textarea}
      ref={ref}
      id={textarea.name}
      className={`${styles.control} ${styles.textarea} ${error ? styles.control_invalid : ""}`}
    />
  </FieldWrapper>
);

export type Option = { value: string; label: string };

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  name: string;
  label: string;
  options: Option[];
  emptyOption?: string;
  hint?: string;
  error?: string;
  wide?: boolean;
  ref?: Ref<HTMLSelectElement>;
};

export const SelectField = ({
  label,
  options,
  emptyOption,
  hint,
  error,
  wide,
  ref,
  ...select
}: SelectProps) => (
  <FieldWrapper
    name={select.name}
    label={label}
    required={select.required}
    hint={hint}
    error={error}
    wide={wide}
  >
    <select
      {...select}
      ref={ref}
      id={select.name}
      size={select.multiple ? Math.min(options.length || 1, 5) : undefined}
      className={`${styles.control} ${select.multiple ? styles.control_multiple : ""} ${
        error ? styles.control_invalid : ""
      }`}
    >
      {emptyOption && !select.multiple ? <option value="">{emptyOption}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </FieldWrapper>
);
