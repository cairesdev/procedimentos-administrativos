"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Alert, Badge, Card, Stack, SummaryGrid, Table, numericCell } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { confirmReceipt } from "../actions";
import { LOSS_REASONS, type ReceiptPlan } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

const arredondar = (valor: number) => Math.round(valor * 1000) / 1000;

const somar = (valores: number[]) => arredondar(valores.reduce((total, v) => total + v, 0));

/**
 * Conferência da escola: o que chegou de cada lote.
 *
 * Começa com tudo conferido — a entrega que fecha é a rotina, e obrigar a
 * digitar item por item faria a conferência virar clique automático. Quem
 * mexe é quem encontrou diferença.
 *
 * A diferença **vira perda**, não volta ao almoxarifado: se saíram 100 kg e
 * chegaram 93, os 7 kg saem do estoque da prefeitura com motivo registrado.
 * Devolvê-los ao saldo fingiria que o material está lá.
 */
export const ReceiptPanel = ({ plano }: { plano: ReceiptPlan }) => {
  const router = useRouter();

  const [conferido, setConferido] = useState<Record<string, number>>(() =>
    Object.fromEntries(plano.liberacoes.map((linha) => [linha.id, linha.quantidade])),
  );
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const perdaDe = (liberacaoId: string, entregue: number) =>
    arredondar(entregue - (conferido[liberacaoId] ?? 0));

  const totais = useMemo(() => {
    const entregue = somar(plano.liberacoes.map((linha) => linha.quantidade));
    const recebido = somar(plano.liberacoes.map((linha) => conferido[linha.id] ?? 0));
    return { entregue, recebido, perdido: arredondar(entregue - recebido) };
  }, [plano.liberacoes, conferido]);

  /** Linha com falta e sem motivo: a API recusa, e a tela avisa antes. */
  const semMotivo = plano.liberacoes.filter(
    (linha) => perdaDe(linha.id, linha.quantidade) > 0 && !motivos[linha.id],
  );
  const acimaDoEntregue = plano.liberacoes.filter(
    (linha) => (conferido[linha.id] ?? 0) > linha.quantidade,
  );

  const confirmar = async () => {
    setEnviando(true);
    const resultado = await confirmReceipt(plano.solicitacao.id, {
      confirmacoes: plano.liberacoes.map((linha) => {
        const perda = perdaDe(linha.id, linha.quantidade);
        return {
          liberacaoId: linha.id,
          quantidadeConfirmada: conferido[linha.id] ?? 0,
          motivoPerda: perda > 0 ? motivos[linha.id] : undefined,
          observacaoPerda: perda > 0 ? observacoes[linha.id] : undefined,
        };
      }),
    });
    setEnviando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Recebimento confirmado");
    router.refresh();
  };

  const impedido = semMotivo.length > 0 || acimaDoEntregue.length > 0;

  return (
    <Stack>
      <Card title="O que chegou" padded={false}>
        <Table
          columns={["Produto", "Lote", "Validade", "Saiu", "Recebi", "Falta", "Motivo"]}
          isEmpty={plano.liberacoes.length === 0}
          emptyMessage="Nada foi liberado para esta solicitação."
        >
          {plano.liberacoes.map((linha) => {
            const perda = perdaDe(linha.id, linha.quantidade);
            const acima = (conferido[linha.id] ?? 0) > linha.quantidade;

            return (
              <tr key={linha.id}>
                <td>
                  <strong>{linha.produtoNome}</strong>
                  <br />
                  <small>{linha.unidadeMedida}</small>
                </td>
                <td>{linha.remessaCodigo}</td>
                <td>{linha.dataValidade ? toDate(linha.dataValidade) : "—"}</td>
                <td className={numericCell}>{formatar(linha.quantidade)}</td>
                <td style={{ width: "130px" }}>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={linha.quantidade}
                    value={conferido[linha.id] ?? 0}
                    onChange={(evento) =>
                      setConferido((atuais) => ({
                        ...atuais,
                        [linha.id]: Number(evento.target.value) || 0,
                      }))
                    }
                    aria-label={`Quantidade recebida de ${linha.produtoNome}`}
                    aria-invalid={acima}
                    style={{
                      width: "100%",
                      textAlign: "right",
                      borderColor: acima ? "var(--perigo)" : undefined,
                    }}
                  />
                </td>
                <td className={numericCell}>
                  {perda > 0 ? (
                    <Badge tone="warning">{formatar(perda)}</Badge>
                  ) : (
                    <span style={{ color: "var(--texto_apagado)" }}>—</span>
                  )}
                </td>
                <td style={{ width: "200px" }}>
                  {perda > 0 ? (
                    <div style={{ display: "grid", gap: "4px" }}>
                      <select
                        value={motivos[linha.id] ?? ""}
                        onChange={(evento) =>
                          setMotivos((atuais) => ({ ...atuais, [linha.id]: evento.target.value }))
                        }
                        aria-label={`Motivo da falta de ${linha.produtoNome}`}
                        style={{ width: "100%" }}
                      >
                        <option value="">Escolha o motivo</option>
                        {LOSS_REASONS.map((motivo) => (
                          <option key={motivo.value} value={motivo.value}>
                            {motivo.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={observacoes[linha.id] ?? ""}
                        onChange={(evento) =>
                          setObservacoes((atuais) => ({
                            ...atuais,
                            [linha.id]: evento.target.value,
                          }))
                        }
                        placeholder="Observação (opcional)"
                        aria-label={`Observação da falta de ${linha.produtoNome}`}
                        style={{ width: "100%", fontSize: "12px" }}
                      />
                    </div>
                  ) : (
                    <span style={{ color: "var(--texto_apagado)", fontSize: "12px" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="Confirmar recebimento">
        <Stack>
          <SummaryGrid
            items={[
              { label: "Saiu do almoxarifado", value: formatar(totais.entregue) },
              { label: "Recebido", value: formatar(totais.recebido) },
              {
                label: "Perda",
                value:
                  totais.perdido > 0 ? (
                    <Badge tone="warning">{formatar(totais.perdido)}</Badge>
                  ) : (
                    "nenhuma"
                  ),
              },
            ]}
          />

          {acimaDoEntregue.length > 0 ? (
            <Alert tone="error">
              Você marcou mais do que saiu em{" "}
              {acimaDoEntregue.map((linha) => linha.produtoNome).join(", ")}. Sobra de entrega se
              resolve por ajuste de estoque, não por confirmação a maior.
            </Alert>
          ) : semMotivo.length > 0 ? (
            <Alert tone="error">
              {semMotivo.length === 1
                ? `Falta informar o motivo da diferença em "${semMotivo[0]?.produtoNome}".`
                : `Falta informar o motivo da diferença em ${semMotivo.length} itens.`}
            </Alert>
          ) : totais.perdido > 0 ? (
            <Alert tone="info">
              A diferença de {formatar(totais.perdido)} sai do estoque como perda, com o motivo
              registrado — não volta ao almoxarifado.
            </Alert>
          ) : (
            <Alert tone="info">
              Ao confirmar, cada lote entra no estoque da unidade com a validade de origem. O
              consumo depois segue a validade: sai primeiro o que vence primeiro.
            </Alert>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="button" onClick={() => void confirmar()} disabled={enviando || impedido}>
              <ClipboardCheck size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {enviando ? "Confirmando…" : "Confirmar recebimento"}
            </Button>
          </div>
        </Stack>
      </Card>
    </Stack>
  );
};
