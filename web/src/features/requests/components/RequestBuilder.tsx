"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
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
    { chave: string; contratos: ContractForRequest[] } | null
  >(null);
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<ContractForRequest | null>(null);
  const [itensPorContrato, setItensPorContrato] = useState<Record<string, ContractItem[]>>({});
  const [carregandoItens, setCarregandoItens] = useState(false);
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

  /**
   * A busca substituiu a lista de todos os contratos da unidade.
   *
   * Despejar tudo funcionava com dez contratos e virava rolagem com cem — e o
   * servidor sabe o número ou o fornecedor do contrato que procura, não a
   * posição dele numa lista. Dois caracteres é o piso: uma letra casaria com
   * metade da prefeitura.
   *
   * A busca também olha o nome do produto: quem vai pedir seringa pensa na
   * seringa, e não no número do contrato que a tem.
   */
  const termo = busca.trim();
  const chave = `${unitId}|${termo}`;
  const podeBuscar = Boolean(unitId) && termo.length >= 2;

  useEffect(() => {
    if (!podeBuscar) return;
    let cancelado = false;

    // Espera o usuário parar de digitar: sem isto cada tecla vira consulta, e a
    // resposta da penúltima chega depois da última.
    const relogio = setTimeout(() => {
      buscar<ContractForRequest[]>(
        `/contratos/para-solicitacao?unidade=${unitId}&busca=${encodeURIComponent(termo)}`,
      )
        .then((lista) => {
          if (!cancelado) setCarregado({ chave, contratos: lista });
        })
        .catch((erro: Error) => {
          if (!cancelado) toast.error(erro.message);
        });
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(relogio);
    };
  }, [chave, unitId, termo, podeBuscar, buscar]);

  const contratos = podeBuscar && carregado?.chave === chave ? carregado.contratos : [];
  const procurando = podeBuscar && carregado?.chave !== chave;

  const trocarUnidade = (novaUnidade: string) => {
    setUnitId(novaUnidade);
    setEscolhido(null);
    setBusca("");
    // Trocar de unidade zera o pedido: os itens escolhidos eram de contratos
    // que talvez nem sirvam à unidade nova.
    setEscolhas({});
  };

  const abrirContrato = async (contrato: ContractForRequest) => {
    setEscolhido(contrato);
    if (itensPorContrato[contrato.id]) return;

    setCarregandoItens(true);
    try {
      const itens = await buscar<ContractItem[]>(`/contratos/${contrato.id}/itens`);
      setItensPorContrato((atual) => ({ ...atual, [contrato.id]: itens }));
    } catch (erro) {
      toast.error((erro as Error).message);
      setEscolhido(null);
    } finally {
      setCarregandoItens(false);
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

      <Card title="Contrato" padded={false}>
        <div style={{ padding: "14px 16px 0" }}>
          <InputField
            label="Procurar contrato"
            name="buscaContrato"
            placeholder="Número, objeto, fornecedor ou produto"
            hint={
              !unitId
                ? "Escolha a unidade primeiro."
                : procurando
                  ? "Procurando…"
                  : "Dois caracteres, no mínimo. Só contratos vigentes, com saldo e destinados à unidade."
            }
            disabled={!unitId}
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>

        {/* Achou e escolheu: o contrato sai da lista e vira cabeçalho fixo, com
            os itens dele logo abaixo. Manter a lista aberta ao lado dos itens
            convidava a pedir do contrato errado — o erro que só aparecia no
            envio. */}
        {escolhido ? (
          <>
            <div className={styles.escolhido}>
              <span className={styles.contrato_dados}>
                <strong>Contrato {escolhido.numero}</strong>
                <span className={styles.objeto}>
                  {escolhido.objeto || "Sem objeto registrado na origem"}
                </span>
                <small>
                  {escolhido.fornecedorRazaoSocial} · {vigencia(escolhido)}
                  {escolhido.origemNumero
                    ? ` · ${escolhido.origem === "ATA" ? "Ata" : "Licitação"} ${escolhido.origemNumero}`
                    : ""}
                </small>
              </span>
              <span className={styles.contrato_tags}>
                <span className={styles.saldo}>
                  {toCurrency(escolhido.saldoDisponivel)} de saldo
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEscolhido(null);
                    setBusca("");
                  }}
                >
                  Trocar
                </Button>
              </span>
            </div>

            {carregandoItens ? (
              <p className={styles.aviso}>Carregando itens…</p>
            ) : (
              <ItemPicker
                itens={itensPorContrato[escolhido.id] ?? []}
                escolhas={Object.fromEntries(
                  escolhidos.map(([id, escolha]) => [id, escolha.quantidade]),
                )}
                onChange={(item, quantidade) => definirQuantidade(escolhido, item, quantidade)}
              />
            )}
          </>
        ) : procurando ? (
          <p className={styles.aviso}>Procurando…</p>
        ) : !podeBuscar ? (
          <p className={styles.aviso}>
            Digite parte do número, do objeto ou do nome do fornecedor.
          </p>
        ) : contratos.length === 0 ? (
          <div style={{ padding: "0 16px 14px" }}>
            <Alert tone="info">
              Nada encontrado com esse texto. Só entram contratos vigentes, com saldo e destinados
              à unidade escolhida — o vínculo com a unidade se define no cadastro do contrato.
            </Alert>
          </div>
        ) : (
          <ul className={styles.contratos}>
            {contratos.map((contrato) => {
              const escolhidosAqui = escolhidos.filter(
                ([, escolha]) => escolha.contratoNumero === contrato.numero,
              ).length;

              return (
                <li key={contrato.id}>
                  <button
                    type="button"
                    className={styles.contrato}
                    onClick={() => void abrirContrato(contrato)}
                  >
                    <span className={styles.chevron}>
                      <ChevronRight size={16} />
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
                </li>
              );
            })}
          </ul>
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
