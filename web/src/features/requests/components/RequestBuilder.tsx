"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { SelectField } from "@/shared/ui/form-field";
import { Alert, Badge, Card, Stack, SummaryGrid } from "@/shared/ui/layout";
import { toCurrency, toDate } from "@/shared/ui/labels";
import type { ContractForRequest, ContractItem } from "@/features/contracts/types";
import type { Unit } from "@/features/units/types";
import { createAndSendRequest, saveDraft } from "../actions";
import { ItemPicker } from "./ItemPicker";
import styles from "./RequestBuilder.module.css";

export type ChosenItem = { itemId: string; quantidade: number };

/** Item escolhido guarda o contrato de origem: o resumo precisa dele. */
type Escolha = { quantidade: number; contratoNumero: string; item: ContractItem };

const vigencia = (contrato: ContractForRequest) =>
  `${toDate(contrato.dataInicio)} a ${contrato.dataFim ? toDate(contrato.dataFim) : "sem termo"}`;

/**
 * Montagem da solicitação em dois passos: escolhe a unidade, vê os contratos
 * dela, e só então abre os itens do contrato que interessa.
 *
 * A tela antiga despejava todos os contratos com todos os itens de uma vez.
 * Numa prefeitura com dezenas de contratos isso vira uma parede de produtos
 * onde é fácil pedir do contrato errado — e o erro só aparecia no envio.
 */
export const RequestBuilder = ({
  units,
  unidadeFixa,
}: {
  units: Unit[];
  /** Preenchido quando a lotação do usuário é de unidade: não há o que escolher. */
  unidadeFixa?: string;
}) => {
  const router = useRouter();
  const [unitId, setUnitId] = useState(unidadeFixa ?? units[0]?.id ?? "");
  // Guarda a unidade junto com a lista: assim a tela nunca mostra contrato de
  // uma unidade enquanto outra já está selecionada, e "carregando" é derivado
  // em vez de ser mais um estado para manter em sincronia.
  const [carregado, setCarregado] = useState<
    { unidade: string; contratos: ContractForRequest[] } | null
  >(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [itensPorContrato, setItensPorContrato] = useState<Record<string, ContractItem[]>>({});
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [busy, setBusy] = useState(false);

  // O token não vai ao navegador: as buscas passam pela ponte autenticada.
  const buscar = useCallback(async <T,>(caminho: string): Promise<T> => {
    const resposta = await fetch(`/api/proxy${caminho}`, { cache: "no-store" });
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => null);
      throw new Error(dados?.message ?? "Falha ao consultar a API");
    }
    return resposta.json() as Promise<T>;
  }, []);

  useEffect(() => {
    if (!unitId) return;
    let cancelado = false;

    buscar<ContractForRequest[]>(`/contratos/para-solicitacao?unidade=${unitId}`)
      .then((lista) => {
        if (!cancelado) setCarregado({ unidade: unitId, contratos: lista });
      })
      .catch((erro: Error) => {
        if (!cancelado) toast.error(erro.message);
      });

    return () => {
      cancelado = true;
    };
  }, [unitId, buscar]);

  const contratos = carregado?.unidade === unitId ? carregado.contratos : [];
  const carregandoContratos = unitId !== "" && carregado?.unidade !== unitId;

  const trocarUnidade = (novaUnidade: string) => {
    setUnitId(novaUnidade);
    setAberto(null);
    // Trocar de unidade zera o pedido: os itens escolhidos eram de contratos
    // que talvez nem sirvam à unidade nova.
    setEscolhas({});
  };

  const abrirContrato = async (contrato: ContractForRequest) => {
    if (aberto === contrato.id) {
      setAberto(null);
      return;
    }
    setAberto(contrato.id);
    if (itensPorContrato[contrato.id]) return;

    try {
      const itens = await buscar<ContractItem[]>(`/contratos/${contrato.id}/itens`);
      setItensPorContrato((atual) => ({ ...atual, [contrato.id]: itens }));
    } catch (erro) {
      toast.error((erro as Error).message);
      setAberto(null);
    }
  };

  const definirQuantidade = (contrato: ContractForRequest, item: ContractItem, quantidade: number) =>
    setEscolhas((atual) => {
      const proximo = { ...atual };
      if (quantidade > 0) {
        proximo[item.id] = { quantidade, contratoNumero: contrato.numero, item };
      } else {
        delete proximo[item.id];
      }
      return proximo;
    });

  const escolhidos = Object.entries(escolhas);

  const total = useMemo(
    () =>
      escolhidos.reduce((soma, [, escolha]) => {
        const { modoMedicao, valorUnitario, valorTotal } = escolha.item;
        if (modoMedicao === "PERCENTUAL") return soma + (escolha.quantidade / 100) * valorTotal;
        if (modoMedicao === "VALOR") return soma + escolha.quantidade;
        return soma + escolha.quantidade * valorUnitario;
      }, 0),
    [escolhidos],
  );

  const contratosEnvolvidos = new Set(escolhidos.map(([, escolha]) => escolha.contratoNumero));

  const enviar = async (modo: "draft" | "send") => {
    if (!unitId) {
      toast.error("Escolha a unidade solicitante");
      return;
    }
    if (escolhidos.length === 0) {
      toast.error("Escolha ao menos um item");
      return;
    }

    setBusy(true);
    const payload = {
      unidadeSolicitanteId: unitId,
      itens: escolhidos.map(([itemId, escolha]) => ({
        itemId,
        quantidadeSolicitada: escolha.quantidade,
      })),
    };
    const resultado = modo === "send"
      ? await createAndSendRequest(payload)
      : await saveDraft(payload);
    setBusy(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Solicitação registrada");
    setEscolhas({});
    router.push(modo === "send" ? "/processos/fila" : "/processos/solicitacoes");
    router.refresh();
  };

  return (
    <Stack>
      <Card title="Unidade solicitante">
        {unidadeFixa ? (
          <Alert tone="info">
            Você está lotado em <strong>{units.find((u) => u.id === unidadeFixa)?.nome}</strong> e
            solicita em nome dela. Para pedir por outra unidade, é preciso lotação nela.
          </Alert>
        ) : (
          <SelectField
            name="unidadeSolicitanteId"
            label="Em nome de qual unidade"
            required
            emptyOption="Selecione"
            options={units.map((unit) => ({ value: unit.id, label: unit.nome }))}
            value={unitId}
            onChange={(evento) => trocarUnidade(evento.target.value)}
            hint="Só aparecem contratos destinados à unidade escolhida."
          />
        )}
      </Card>

      <Card
        title={
          contratos.length > 0
            ? `Contratos disponíveis (${contratos.length})`
            : "Contratos disponíveis"
        }
        padded={false}
      >
        {carregandoContratos ? (
          <p className={styles.aviso}>Carregando contratos…</p>
        ) : !unitId ? (
          <p className={styles.aviso}>Escolha a unidade para ver os contratos.</p>
        ) : contratos.length === 0 ? (
          <div style={{ padding: "14px 16px" }}>
            <Alert tone="info">
              Nenhum contrato vigente com saldo destinado a esta unidade. Contratos são vinculados
              às unidades no cadastro do contrato.
            </Alert>
          </div>
        ) : (
          <>
            <p className={styles.aviso}>
              Escolha o contrato pelo objeto. Os itens dele aparecem logo abaixo, e só os dele.
            </p>
            <ul className={styles.contratos}>
              {contratos.map((contrato) => {
              const expandido = aberto === contrato.id;
              const itens = itensPorContrato[contrato.id];
              const escolhidosAqui = escolhidos.filter(
                ([, escolha]) => escolha.contratoNumero === contrato.numero,
              ).length;

              return (
                <li key={contrato.id}>
                  <button
                    type="button"
                    className={styles.contrato}
                    onClick={() => void abrirContrato(contrato)}
                    aria-expanded={expandido}
                  >
                    <span className={styles.chevron}>
                      {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span className={styles.contrato_dados}>
                      <strong>Contrato {contrato.numero}</strong>
                      <span className={styles.objeto}>
                        {contrato.objeto || "Sem objeto registrado na origem"}
                      </span>
                      <small>
                        {contrato.fornecedorRazaoSocial} · {vigencia(contrato)}
                        {contrato.origemNumero
                          ? ` · ${contrato.origem === "ATA" ? "Ata" : "Licitação"} ${contrato.origemNumero}`
                          : ""}
                      </small>
                    </span>
                    <span className={styles.contrato_tags}>
                      <span className={styles.valor}>{toCurrency(contrato.valorTotal)}</span>
                      <span className={styles.saldo}>
                        {toCurrency(contrato.saldoDisponivel)} de saldo
                      </span>
                      {escolhidosAqui > 0 ? (
                        <Badge tone="accent">
                          {escolhidosAqui} {escolhidosAqui === 1 ? "item" : "itens"}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">
                          {contrato.itensDisponiveis}{" "}
                          {contrato.itensDisponiveis === 1 ? "item" : "itens"}
                        </Badge>
                      )}
                    </span>
                  </button>

                  {expandido ? (
                    itens ? (
                      <ItemPicker
                        itens={itens}
                        escolhas={Object.fromEntries(
                          escolhidos.map(([id, escolha]) => [id, escolha.quantidade]),
                        )}
                        onChange={(item, quantidade) =>
                          definirQuantidade(contrato, item, quantidade)
                        }
                      />
                    ) : (
                      <p className={styles.aviso}>Carregando itens…</p>
                    )
                  ) : null}
                </li>
              );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card title="Resumo do pedido">
        <Stack>
          <SummaryGrid
            items={[
              { label: "Itens escolhidos", value: `${escolhidos.length}` },
              { label: "Contratos envolvidos", value: `${contratosEnvolvidos.size}` },
              { label: "Valor estimado", value: toCurrency(total) },
            ]}
          />

          <Alert tone="info">
            Ao enviar, o sistema gera protocolo e processo administrativo e reserva o saldo dos
            itens. O saldo só volta se a solicitação for cancelada ou receber parecer desfavorável.
          </Alert>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void enviar("draft")}>
              Salvar rascunho
            </Button>
            <Button type="button" disabled={busy} onClick={() => void enviar("send")}>
              <Send size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {busy ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </div>
        </Stack>
      </Card>
    </Stack>
  );
};
