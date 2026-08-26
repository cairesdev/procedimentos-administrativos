"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { SelectField } from "@/shared/ui/form-field";
import { Alert, Badge, Card, Stack, SummaryGrid, Table, numericCell } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { createStockRequest } from "../actions";
import type { Availability, StockLocation, StockType } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/** Alerta de validade na lista de disponíveis — nunca impede o pedido. */
const proximaValidade = (data: string | null, alertaDias: number) => {
  if (!data) return null;
  const dias = Math.round(
    (Date.parse(`${data.slice(0, 10)}T12:00:00Z`) - Date.now()) / 86_400_000,
  );
  if (dias < 0) return { tone: "warning" as const, texto: "há vencido" };
  if (dias <= alertaDias) return { tone: "warning" as const, texto: `vence ${toDate(data)}` };
  return null;
};

/**
 * Montagem do pedido da unidade.
 *
 * Escolhe o local, vê o que o almoxarifado dele tem, e pede. O saldo mostrado
 * é o **disponível** — saldo dos lotes menos o que outros pedidos já
 * reservaram —, porque mostrar o total faria a unidade pedir o que já está
 * comprometido e descobrir a falta só na liberação.
 */
export const RequestBuilder = ({
  locais,
  tipos,
  alertaValidadeDias,
}: {
  locais: StockLocation[];
  tipos: StockType[];
  alertaValidadeDias: number;
}) => {
  const atendidos = locais.filter((local) => local.almoxarifadoId);
  const [localId, setLocalId] = useState(atendidos[0]?.id ?? "");
  const [tipoId, setTipoId] = useState("");
  const [carregado, setCarregado] = useState<
    { chave: string; produtos: Availability[] } | null
  >(null);
  const [escolhas, setEscolhas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);

  const local = atendidos.find((item) => item.id === localId);
  const chave = `${local?.almoxarifadoId ?? ""}:${tipoId}`;

  const buscar = useCallback(async (caminho: string) => {
    const resposta = await fetch(`/api/proxy${caminho}`, { cache: "no-store" });
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => null);
      throw new Error(dados?.message ?? "Falha ao consultar o almoxarifado");
    }
    return resposta.json() as Promise<Availability[]>;
  }, []);

  useEffect(() => {
    if (!local?.almoxarifadoId) return;
    let cancelado = false;

    buscar(`/almoxarifado/disponiveis/${local.almoxarifadoId}${tipoId ? `?tipo=${tipoId}` : ""}`)
      .then((produtos) => {
        if (!cancelado) setCarregado({ chave, produtos });
      })
      .catch((erro: Error) => {
        if (!cancelado) toast.error(erro.message);
      });

    return () => {
      cancelado = true;
    };
  }, [chave, local?.almoxarifadoId, tipoId, buscar]);

  // Guarda a chave junto com a lista: assim a tela nunca mostra produto de um
  // almoxarifado enquanto outro já está selecionado, e "carregando" é derivado.
  //
  // O `useMemo` não é otimização: sem ele o array literal nasceria novo a cada
  // render e derrubaria a memoização de `escolhidos` logo abaixo.
  const produtos = useMemo(
    () => (carregado?.chave === chave ? carregado.produtos : []),
    [carregado, chave],
  );
  const carregando = Boolean(local?.almoxarifadoId) && carregado?.chave !== chave;

  const trocarLocal = (novoLocal: string) => {
    setLocalId(novoLocal);
    // Trocar de local pode trocar de almoxarifado: o que foi escolhido talvez
    // nem exista no novo.
    setEscolhas({});
  };

  const escolhidos = useMemo(
    () =>
      Object.entries(escolhas)
        .filter(([, quantidade]) => quantidade > 0)
        .map(([produtoId, quantidade]) => ({
          produto: produtos.find((item) => item.produtoId === produtoId),
          quantidade,
        }))
        .filter((item) => item.produto),
    [escolhas, produtos],
  );

  const excedidos = escolhidos.filter((item) => item.quantidade > item.produto!.disponivel);

  const salvar = async () => {
    if (!localId) {
      toast.error("Escolha o local solicitante");
      return;
    }
    if (escolhidos.length === 0) {
      toast.error("Escolha ao menos um item");
      return;
    }

    setEnviando(true);
    // Sucesso redireciona para o rascunho; só o erro volta com resultado.
    const resultado = await createStockRequest({
      localSolicitanteId: localId,
      tipoEstoqueId: tipoId || undefined,
      itens: escolhidos.map((item) => ({
        produtoId: item.produto!.produtoId,
        quantidadeSolicitada: item.quantidade,
      })),
    });
    setEnviando(false);
    if (resultado?.error) toast.error(resultado.error);
  };

  if (atendidos.length === 0) {
    return (
      <Alert tone="info">
        Nenhum local seu está vinculado a um almoxarifado. O vínculo é feito em
        Cadastros › Locais atendidos.
      </Alert>
    );
  }

  return (
    <Stack>
      <Card title="Para onde">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          <SelectField
            label="Local solicitante"
            name="localSolicitanteId"
            required
            value={localId}
            onChange={(evento) => trocarLocal(evento.target.value)}
            options={atendidos.map((item) => ({
              value: item.id,
              label: `${item.nome} · ${item.almoxarifadoNome}`,
            }))}
            hint="Só aparecem locais vinculados a um almoxarifado."
          />
          <SelectField
            label="Tipo de estoque"
            name="tipoEstoqueId"
            value={tipoId}
            onChange={(evento) => setTipoId(evento.target.value)}
            emptyOption="Todos"
            options={tipos
              .filter((item) => item.ativo)
              .map((item) => ({ value: item.id, label: item.nome }))}
            hint="Filtra a lista; não muda o que pode ser pedido."
          />
        </div>
      </Card>

      <Card title={produtos.length > 0 ? `Disponíveis (${produtos.length})` : "Disponíveis"} padded={false}>
        {carregando ? (
          <p style={{ padding: "14px 16px", fontSize: "13px", color: "var(--texto_suave)" }}>
            Carregando o que o almoxarifado tem…
          </p>
        ) : produtos.length === 0 ? (
          <div style={{ padding: "14px 16px" }}>
            <Alert tone="info">
              Nada disponível neste almoxarifado com esse filtro. Saldo já reservado por outros
              pedidos não aparece aqui.
            </Alert>
          </div>
        ) : (
          <Table
            columns={["Produto", "Disponível", "Reservado", "Validade", "Quero"]}
            isEmpty={false}
            emptyMessage=""
          >
            {produtos.map((produto) => {
              const alerta = proximaValidade(produto.proximaValidade, alertaValidadeDias);
              const pedido = escolhas[produto.produtoId] ?? 0;
              const excede = pedido > produto.disponivel;

              return (
                <tr key={produto.produtoId}>
                  <td>
                    <strong>{produto.nome}</strong>
                    <br />
                    <small>{produto.unidadeMedida}</small>
                  </td>
                  <td className={numericCell}>{formatar(produto.disponivel)}</td>
                  <td className={numericCell}>
                    {produto.reservado > 0 ? formatar(produto.reservado) : "—"}
                  </td>
                  <td>
                    {produto.proximaValidade ? toDate(produto.proximaValidade) : "—"}{" "}
                    {alerta ? <Badge tone={alerta.tone}>{alerta.texto}</Badge> : null}
                  </td>
                  <td style={{ width: "140px" }}>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max={produto.disponivel}
                      value={pedido || ""}
                      onChange={(evento) =>
                        setEscolhas((atuais) => ({
                          ...atuais,
                          [produto.produtoId]: Number(evento.target.value) || 0,
                        }))
                      }
                      aria-label={`Quantidade de ${produto.nome}`}
                      aria-invalid={excede}
                      style={{
                        width: "100%",
                        textAlign: "right",
                        borderColor: excede ? "var(--perigo)" : undefined,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card title="Resumo">
        <Stack>
          <SummaryGrid
            items={[
              { label: "Itens escolhidos", value: `${escolhidos.length}` },
              { label: "Local", value: local?.nome ?? "—" },
              { label: "Almoxarifado", value: local?.almoxarifadoNome ?? "—" },
            ]}
          />

          {excedidos.length > 0 ? (
            <Alert tone="error">
              {excedidos.length === 1
                ? `Você pediu mais do que há disponível de "${excedidos[0]!.produto!.nome}".`
                : `${excedidos.length} itens estão acima do disponível.`}{" "}
              O envio será recusado.
            </Alert>
          ) : (
            <Alert tone="info">
              O rascunho não reserva nada. O saldo só fica preso quando você enviar o pedido — e é
              devolvido se ele for cancelado, recusado ou expirar.
            </Alert>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              onClick={() => void salvar()}
              disabled={enviando || escolhidos.length === 0}
            >
              <Send size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {enviando ? "Salvando…" : "Salvar rascunho"}
            </Button>
          </div>
        </Stack>
      </Card>
    </Stack>
  );
};
