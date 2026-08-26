import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { EXPIRY_LABEL, EXPIRY_TONE, type ExpiryState, type LocalStock } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

const situacao = (dataValidade: string | null, alertaDias: number): ExpiryState => {
  if (!dataValidade) return "SEM_VALIDADE";
  const dias = Math.round(
    (Date.parse(`${dataValidade.slice(0, 10)}T12:00:00Z`) - Date.now()) / 86_400_000,
  );
  if (dias < 0) return "VENCIDO";
  return dias <= alertaDias ? "PROXIMO" : "OK";
};

/**
 * Saldo da escola por lote, e não só o total do produto.
 *
 * É o dado que o sistema legado tinha e o nosso levantamento havia perdido:
 * saber que há 40 kg de arroz não ajuda quem precisa consumir primeiro o que
 * vence antes. Os lotes vêm ordenados por validade.
 */
export const LocalStockView = ({
  estoque,
  alertaValidadeDias,
}: {
  estoque: LocalStock[];
  alertaValidadeDias: number;
}) => (
  <Table
    columns={["Produto", "Saldo total", "Lotes no armário"]}
    isEmpty={estoque.length === 0}
    emptyMessage="Esta unidade ainda não recebeu material, ou já consumiu tudo."
  >
    {estoque.map((produto) => (
      <tr key={produto.produtoId}>
        <td>
          <strong>{produto.produtoNome}</strong>
          <br />
          <small>{produto.unidadeMedida}</small>
        </td>
        <td className={numericCell}>{formatar(produto.saldo)}</td>
        <td>
          <div style={{ display: "grid", gap: "4px" }}>
            {produto.lotes.map((lote) => {
              const estado = situacao(lote.dataValidade, alertaValidadeDias);
              return (
                <div key={lote.id} style={{ fontSize: "13px" }}>
                  {formatar(lote.saldo)} {produto.unidadeMedida} ·{" "}
                  {lote.dataValidade ? `vence ${toDate(lote.dataValidade)}` : "sem validade"}{" "}
                  <Badge tone={EXPIRY_TONE[estado]}>{EXPIRY_LABEL[estado]}</Badge>{" "}
                  <small style={{ color: "var(--texto_apagado)" }}>
                    entrou {toDate(lote.dataEntrada)}
                  </small>
                </div>
              );
            })}
          </div>
        </td>
      </tr>
    ))}
  </Table>
);
