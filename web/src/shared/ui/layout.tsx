import type { ReactNode } from "react";
import styles from "./layout.module.css";

export const PageHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <header className={styles.page_header}>
    <div>
      <h1 className={styles.page_title}>{title}</h1>
      {subtitle ? <p className={styles.page_subtitle}>{subtitle}</p> : null}
    </div>
    {action}
  </header>
);

export const Card = ({
  title,
  padded = true,
  children,
}: {
  title?: string;
  padded?: boolean;
  children: ReactNode;
}) => (
  <section className={styles.card}>
    {title ? <h2 className={styles.card_title}>{title}</h2> : null}
    {padded ? <div className={styles.card_body}>{children}</div> : children}
  </section>
);

export const Columns = ({ children }: { children: ReactNode }) => (
  <div className={styles.columns}>{children}</div>
);

export const Stack = ({ children }: { children: ReactNode }) => (
  <div className={styles.stack}>{children}</div>
);

export const FieldGrid = ({ children }: { children: ReactNode }) => (
  <div className={styles.grid}>{children}</div>
);

export const Table = ({
  columns,
  isEmpty,
  emptyMessage,
  children,
}: {
  columns: string[];
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) => {
  if (isEmpty) return <p className={styles.empty}>{emptyMessage}</p>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
};

export const Badge = ({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "accent";
  children: ReactNode;
}) => {
  const toneClass = {
    neutral: styles.badge_neutral,
    success: styles.badge_success,
    warning: styles.badge_warning,
    accent: styles.badge_accent,
  }[tone];
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
};

export const Alert = ({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) => {
  const toneClass = {
    error: styles.alert_error,
    success: styles.alert_success,
    info: styles.alert_info,
  }[tone];
  return (
    <p className={`${styles.alert} ${toneClass}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
};

export const numericCell = styles.numeric;
