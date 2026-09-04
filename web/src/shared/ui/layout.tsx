import { Children, cloneElement, isValidElement, type ReactNode } from "react";
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
  action,
  children,
}: {
  title?: string;
  padded?: boolean;
  /**
   * Botão no canto do título — "Novo checklist" dentro do processo.
   *
   * O `PageHeader` já tinha isto; o card não, e a ação acabava solta acima ou
   * abaixo dele, longe do que ela cria.
   */
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className={styles.card}>
    {title || action ? (
      <div className={styles.card_header}>
        {title ? <h2 className={styles.card_title}>{title}</h2> : <span />}
        {action}
      </div>
    ) : null}
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

/**
 * A tela vazia que ensina o próximo passo.
 *
 * "Nenhum registro" é verdade e não serve: prefeitura recém-instalada tem tudo
 * vazio, e quem abre a primeira tela precisa saber o que fazer, não que não há
 * nada. A frase diz o que aquela lista guarda; a ação, quando existe, é o
 * mesmo botão do cabeçalho — perto de onde a pessoa está olhando.
 *
 * `filtrado` troca a explicação: lista vazia por filtro não é lista sem
 * cadastro, e mandar "cadastre o primeiro" para quem tem duzentos registros e
 * filtrou errado é o conselho errado.
 */
export const EmptyState = ({
  titulo,
  descricao,
  acao,
  filtrado,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  filtrado?: boolean;
}) => (
  <div className={styles.empty_state}>
    <p className={styles.empty_titulo}>
      {filtrado ? "Nada encontrado com esses filtros" : titulo}
    </p>
    {filtrado ? (
      <p className={styles.empty_descricao}>
        Tente limpar os filtros ou procurar por outro termo.
      </p>
    ) : descricao ? (
      <p className={styles.empty_descricao}>{descricao}</p>
    ) : null}
    {!filtrado && acao ? <div className={styles.empty_acao}>{acao}</div> : null}
  </div>
);

export const Table = ({
  columns,
  isEmpty,
  emptyMessage,
  empty,
  children,
}: {
  columns: string[];
  isEmpty: boolean;
  /** A frase curta de sempre. Continua valendo onde ela basta. */
  emptyMessage: string;
  /** O estado vazio inteiro, quando a tela merece explicar e oferecer a ação. */
  empty?: ReactNode;
  children: ReactNode;
}) => {
  if (isEmpty) return <>{empty ?? <p className={styles.empty}>{emptyMessage}</p>}</>;

  /**
   * Cada célula leva o nome da sua coluna.
   *
   * No celular a tabela vira lista de cartões, e é o `data-coluna` que o CSS
   * imprime na frente do valor — sem ele, o cartão seria uma pilha de números
   * sem dizer o que é cada um. A alternativa era repetir o rótulo à mão em
   * quinze telas, e ela envelhece na primeira coluna que muda de nome.
   *
   * O que não for `<tr>` passa intacto: `LinhasPorCategoria` monta as próprias
   * linhas, e clonar às cegas quebraria o agrupador.
   */
  const linhas = Children.map(children, (linha) => {
    if (!isValidElement(linha) || linha.type !== "tr") return linha;

    const celulas = Children.map(
      (linha.props as { children?: ReactNode }).children,
      (celula, indice) => {
        if (!isValidElement(celula) || celula.type !== "td") return celula;
        const props = celula.props as Record<string, unknown>;
        if (props["data-coluna"] !== undefined) return celula;
        return cloneElement(celula, { "data-coluna": columns[indice] ?? "" } as never);
      },
    );

    return cloneElement(linha, undefined, celulas);
  });

  return (
    // O container de rolagem é o que impede a tabela de sete colunas de sair
    // do card e cobrir a coluna ao lado nas telas de detalhe.
    <div className={styles.table_scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{linhas}</tbody>
      </table>
    </div>
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

/** Para a célula que recebe a especificação do item: quebra em vez de esticar. */
export const celulaLonga = styles.celula_longa;

export const Toolbar = ({ children }: { children: ReactNode }) => (
  <div className={styles.toolbar}>{children}</div>
);

export const Steps = ({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) => (
  <ol className={styles.steps}>
    {steps.map((step, index) => (
      <li key={step} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          className={`${styles.step} ${
            index === current ? styles.step_active : index < current ? styles.step_done : ""
          }`}
          aria-current={index === current ? "step" : undefined}
        >
          <span className={styles.step_index}>{index < current ? "✓" : index + 1}</span>
          {step}
        </span>
        {index < steps.length - 1 ? <span className={styles.step_divider} aria-hidden="true" /> : null}
      </li>
    ))}
  </ol>
);

export const SummaryGrid = ({
  items,
}: {
  /** `wide` ocupa a linha inteira — objeto de contrato não cabe numa coluna. */
  items: { label: string; value: ReactNode; wide?: boolean }[];
}) => (
  <div className={styles.summary}>
    {items.map((item) => (
      <div
        key={item.label}
        className={`${styles.summary_item} ${item.wide ? styles.summary_wide : ""}`}
      >
        <p className={styles.summary_label}>{item.label}</p>
        <p className={styles.summary_value}>{item.value}</p>
      </div>
    ))}
  </div>
);
