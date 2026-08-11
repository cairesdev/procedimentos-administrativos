import { humanize, toDateTime } from "@/shared/ui/labels";
import type { Dispatch } from "../types";
import styles from "./ProcessTimeline.module.css";

const toneByType: Record<Dispatch["tipo"], string> = {
  ANALISE: styles.dot_neutral,
  ENCAMINHAMENTO: styles.dot_accent,
  PARECER: styles.dot_success,
  ORDEM_FORNECIMENTO: styles.dot_accent,
  CANCELAMENTO: styles.dot_danger,
};

export const ProcessTimeline = ({ dispatches }: { dispatches: Dispatch[] }) => {
  if (dispatches.length === 0) {
    return <p className={styles.empty}>Nenhum despacho ainda — o processo acabou de chegar.</p>;
  }

  return (
    <ol className={styles.timeline}>
      {dispatches.map((dispatch) => (
        <li key={dispatch.id} className={styles.entry}>
          <span className={`${styles.dot} ${toneByType[dispatch.tipo]}`} aria-hidden="true" />
          <div>
            <p className={styles.title}>
              {humanize(dispatch.tipo)}
              <span className={styles.author}> · {dispatch.usuarioNome}</span>
            </p>
            {dispatch.texto ? <p className={styles.text}>{dispatch.texto}</p> : null}
            <p className={styles.time}>{toDateTime(dispatch.data)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
};
