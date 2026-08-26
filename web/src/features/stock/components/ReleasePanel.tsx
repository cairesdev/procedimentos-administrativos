"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { TextareaField } from "@/shared/ui/form-field";
import { Alert, Badge, Card, Stack, SummaryGrid, numericCell } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { refuseStockRequest, releaseStockRequest } from "../actions";
import { EXPIRY_LABEL, EXPIRY_TONE, type ReleasePlan } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/** Soma sem acumular resíduo de ponto flutuante, como no domínio da API. */
const somar = (valores: number[]) =>
  Math.round(valores.reduce((total, valor) => total + valor, 0) * 1000) / 1000;

/**
 * Liberação: de quais lotes sai cada item.
 *
 * A distribuição FEFO vem calculada da API e entra como valor inicial. O
 * almoxarife ajusta porque o lote que vence antes pode estar no fundo do
 * depósito — obrigá-lo a seguir a ordem faria ele burlar o sistema em vez de
 * usá-lo. Lote vencido aparece marcado, não escondido.
 */
export const ReleasePanel = ({ plano }: { plano: ReleasePlan }) => {
  const router = useRouter();

  const [quantidades, setQuantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      plano.itens.flatMap((item) =>
        item.lotes.map((lote) => [`${item.id}:${lote.id}`, lote.sugerido]),
      ),
    ),
  );
  const [liberando, setLiberando] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [dialogo, setDialogo] = useState(false);

  const totalPorItem = useMemo(
    () =>
      Object.fromEntries(
        plano.itens.map((item) => [
          item.id,
          somar(item.lotes.map((lote) => quantidades[`${item.id}:${lote.id}`] ?? 0)),
        ]),
      ),
    [plano.itens, quantidades],
  );

  const retiradas = plano.itens.flatMap((item) =>
    item.lotes
      .map((lote) => ({
        solicitacaoItemId: item.id,
        loteId: lote.id,
        quantidade: quantidades[`${item.id}:${lote.id}`] ?? 0,
      }))
      .filter((retirada) => retirada.quantidade > 0),
  );

  const excedidos = plano.itens.filter(
    (item) => (totalPorItem[item.id] ?? 0) > item.quantidadeSolicitada,
  );
  const semSaldo = plano.itens.flatMap((item) =>
    item.lotes.filter(
      (lote) => (quantidades[`${item.id}:${lote.id}`] ?? 0) > lote.saldo,
    ),
  );

  const liberar = async () => {
    setLiberando(true);
    const resultado = await releaseStockRequest(plano.solicitacao.id, { retiradas });
    setLiberando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Material liberado");
    router.refresh();
  };

  const recusar = async () => {
    setRecusando(true);
    const resultado = await refuseStockRequest(plano.solicitacao.id, { motivo });
    setRecusando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    setDialogo(false);
    toast.success(resultado.success ?? "Pedido recusado");
    router.refresh();
  };

  const impedido = excedidos.length > 0 || semSaldo.length > 0 || retiradas.length === 0;

  return (
    <Stack>
      {plano.itens.map((item) => {
        const total = totalPorItem[item.id] ?? 0;
        const completo = total >= item.quantidadeSolicitada;

        return (
          <Card
            key={item.id}
            title={`${item.produtoNome} · ${formatar(item.quantidadeSolicitada)} ${item.unidadeMedida}`}
            padded={false}
          >
            <div style={{ padding: "12px 16px" }}>
              <SummaryGrid
                items={[
                  { label: "Pedido", value: `${formatar(item.quantidadeSolicitada)} ${item.unidadeMedida}` },
                  {
                    label: "A liberar",
                    value: (
                      <>
                        {formatar(total)}{" "}
                        <Badge tone={completo ? "success" : "warning"}>
                          {completo ? "completo" : "parcial"}
                        </Badge>
                      </>
                    ),
                  },
                  {
                    label: "Falta em estoque",
                    value: item.faltando > 0 ? `${formatar(item.faltando)} ${item.unidadeMedida}` : "—",
                  },
                ]}
              />
            </div>

            {item.lotes.length === 0 ? (
              <div style={{ padding: "0 16px 14px" }}>
                <Alert tone="info">
                  Sem lote com saldo para este produto. Dá para liberar os outros itens e recusar
                  depois, ou dar entrada antes de liberar.
                </Alert>
              </div>
            ) : (
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "9px 16px", color: "var(--texto_suave)", fontWeight: 400 }}>
                      Lote
                    </th>
                    <th style={{ textAlign: "left", padding: "9px 14px", color: "var(--texto_suave)", fontWeight: 400 }}>
                      Validade
                    </th>
                    <th style={{ textAlign: "right", padding: "9px 14px", color: "var(--texto_suave)", fontWeight: 400 }}>
                      Saldo
                    </th>
                    <th style={{ textAlign: "right", padding: "9px 16px", color: "var(--texto_suave)", fontWeight: 400 }}>
                      Retirar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {item.lotes.map((lote) => {
                    const chave = `${item.id}:${lote.id}`;
                    const valor = quantidades[chave] ?? 0;
                    const acima = valor > lote.saldo;

                    return (
                      <tr key={lote.id} style={{ borderTop: "1px solid #f0f2f4" }}>
                        <td style={{ padding: "10px 16px" }}>
                          <strong>{lote.remessaCodigo}</strong>
                          <br />
                          <small>{lote.almoxarifadoNome}</small>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {lote.dataValidade ? toDate(lote.dataValidade) : "—"}{" "}
                          <Badge tone={EXPIRY_TONE[lote.validade]}>
                            {EXPIRY_LABEL[lote.validade]}
                          </Badge>
                        </td>
                        <td className={numericCell} style={{ padding: "10px 14px" }}>
                          {formatar(lote.saldo)}
                        </td>
                        <td style={{ padding: "8px 16px", width: "150px" }}>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max={lote.saldo}
                            value={valor || ""}
                            onChange={(evento) =>
                              setQuantidades((atuais) => ({
                                ...atuais,
                                [chave]: Number(evento.target.value) || 0,
                              }))
                            }
                            aria-label={`Retirar do lote ${lote.remessaCodigo}`}
                            aria-invalid={acima}
                            style={{
                              width: "100%",
                              textAlign: "right",
                              borderColor: acima ? "var(--perigo)" : undefined,
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        );
      })}

      <Card title="Confirmar">
        <Stack>
          {excedidos.length > 0 ? (
            <Alert tone="error">
              {excedidos.map((item) => item.produtoNome).join(", ")}: a soma dos lotes passa do que
              foi pedido.
            </Alert>
          ) : null}

          {semSaldo.length > 0 ? (
            <Alert tone="error">
              {semSaldo.length === 1 ? "Um lote" : `${semSaldo.length} lotes`} sem o saldo escolhido.
              Alguém pode ter liberado enquanto esta tela estava aberta.
            </Alert>
          ) : null}

          {excedidos.length === 0 && semSaldo.length === 0 ? (
            <Alert tone="info">
              A distribuição sugerida segue a validade: sai primeiro o que vence primeiro. Ajuste à
              vontade — validade nunca impede a saída, só avisa.
            </Alert>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
            <Button type="button" variant="secondary" onClick={() => setDialogo(true)}>
              Recusar pedido
            </Button>
            <Button type="button" onClick={() => void liberar()} disabled={liberando || impedido}>
              <PackageCheck size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {liberando ? "Liberando…" : `Liberar ${retiradas.length} lote(s)`}
            </Button>
          </div>
        </Stack>
      </Card>

      <Modal
        open={dialogo}
        onClose={() => setDialogo(false)}
        title="Recusar pedido"
        description="A reserva é devolvida e a unidade vê o motivo."
      >
        <div style={{ display: "grid", gap: "14px" }}>
          <TextareaField
            label="Motivo"
            name="motivo"
            required
            rows={3}
            placeholder="Sem estoque previsto para este mês; pedido acima da cota da unidade…"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              onClick={() => void recusar()}
              disabled={recusando || motivo.trim().length < 3}
            >
              {recusando ? "Recusando…" : "Confirmar recusa"}
            </Button>
          </div>
        </div>
      </Modal>
    </Stack>
  );
};
