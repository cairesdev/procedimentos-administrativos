import { Badge, Table } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";
import { EVENT_LABELS, type AuditRecord } from "../types";
import styles from "./AuditTable.module.css";

/** Chaves que não ajudam quem lê: são id para o sistema, ruído para o gestor. */
const OCULTAR = new Set([
  "despachoId", "lotacaoId", "setorOrigemId", "setorDestinoId", "departamentoDestinoId",
  "anexoId", "transferenciaId", "localId",
]);

const rotularChave = (chave: string): string =>
  chave
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letra) => letra.toUpperCase())
    .trim();

const formatarValor = (valor: unknown): string => {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (Array.isArray(valor)) {
    // Listas longas (tombamentos de uma remessa) viram resumo.
    return valor.length > 5
      ? `${valor.slice(0, 5).join(", ")} … (+${valor.length - 5})`
      : valor.join(", ");
  }
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
};

const Detalhes = ({ detalhes }: { detalhes: Record<string, unknown> | null }) => {
  if (!detalhes) return <span className={styles.vazio}>—</span>;

  const entradas = Object.entries(detalhes).filter(([chave]) => !OCULTAR.has(chave));
  if (entradas.length === 0) return <span className={styles.vazio}>—</span>;

  return (
    <dl className={styles.detalhes}>
      {entradas.map(([chave, valor]) => (
        <div key={chave} className={styles.par}>
          <dt>{rotularChave(chave)}</dt>
          <dd>{formatarValor(valor)}</dd>
        </div>
      ))}
    </dl>
  );
};

export const AuditTable = ({ records }: { records: AuditRecord[] }) => (
  <Table
    columns={["Quando", "Evento", "Quem", "Detalhes"]}
    isEmpty={records.length === 0}
    emptyMessage="Nenhum registro no período e filtros escolhidos."
  >
    {records.map((record) => (
      <tr key={record.id}>
        <td className={styles.quando}>{toDateTime(record.data)}</td>
        <td>
          <Badge tone="accent">{EVENT_LABELS[record.tipoEvento] ?? record.tipoEvento}</Badge>
        </td>
        <td>
          {/* Sem usuário: ação do painel do produto — o autor está em detalhes. */}
          {record.usuarioNome ?? <span className={styles.vazio}>fornecedor</span>}
        </td>
        <td>
          <Detalhes detalhes={record.detalhes} />
        </td>
      </tr>
    ))}
  </Table>
);
