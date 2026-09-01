"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { transferBetweenWarehouses } from "../actions";
import type { Batch, Warehouse } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Move lote entre almoxarifados.
 *
 * A escolha começa pelo almoxarifado de origem, não pelo lote: o lote pertence
 * a uma remessa, e listar todos os lotes da prefeitura de uma vez seria uma
 * parede de caixas sem contexto.
 */
export const TransferForm = ({ almoxarifados }: { almoxarifados: Warehouse[] }) => {
  const router = useRouter();
  const closeModal = useModalClose();
  const ativos = almoxarifados.filter((item) => item.ativo);

  const [origemId, setOrigemId] = useState(ativos[0]?.id ?? "");
  const [destinoId, setDestinoId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [motivo, setMotivo] = useState("");
  // Guarda a origem junto com a lista: a tela nunca mostra lote de um
  // almoxarifado enquanto outro já está escolhido, e "carregando" é derivado
  // em vez de ser mais um estado para manter em sincronia.
  const [carregado, setCarregado] = useState<{ origem: string; lotes: Batch[] } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!origemId) return;
    let cancelado = false;

    // Uma chamada só. Antes eram as remessas mais o detalhe de cada uma —
    // uma dúzia de idas ao servidor para montar um `<select>`.
    fetch(`/api/proxy/almoxarifado/almoxarifados/${origemId}/lotes`, { cache: "no-store" })
      .then((resposta) => {
        if (!resposta.ok) throw new Error("Falha ao carregar os lotes do almoxarifado");
        return resposta.json() as Promise<Batch[]>;
      })
      .then((recebidos) => {
        if (!cancelado) setCarregado({ origem: origemId, lotes: recebidos });
      })
      .catch((erro: Error) => {
        if (!cancelado) toast.error(erro.message);
      });

    return () => {
      cancelado = true;
    };
  }, [origemId]);

  const lotes = carregado?.origem === origemId ? carregado.lotes : [];
  const carregando = Boolean(origemId) && carregado?.origem !== origemId;
  const lote = lotes.find((item) => item.id === loteId);
  const excede = lote ? quantidade > lote.saldo : false;

  const enviar = async () => {
    setEnviando(true);
    const resultado = await transferBetweenWarehouses({
      loteId,
      almoxarifadoDestinoId: destinoId,
      quantidade,
      motivo: motivo || undefined,
    });
    setEnviando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Transferência registrada");
    closeModal();
    router.refresh();
  };

  if (ativos.length < 2) {
    return (
      <Alert tone="info">
        Transferência exige ao menos dois almoxarifados ativos. Hoje há {ativos.length}.
      </Alert>
    );
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        O material chega ao destino como uma entrada, com a validade preservada e o rastro de onde
        veio. O destino vê na tela de entradas, com o mesmo FEFO.
      </Alert>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <SelectField
          label="De qual almoxarifado"
          name="origemId"
          required
          value={origemId}
          onChange={(evento) => {
            setOrigemId(evento.target.value);
            setLoteId("");
          }}
          options={ativos.map((item) => ({ value: item.id, label: item.nome }))}
        />
        <SelectField
          label="Para qual"
          name="destinoId"
          required
          emptyOption="Selecione"
          value={destinoId}
          onChange={(evento) => setDestinoId(evento.target.value)}
          options={ativos
            .filter((item) => item.id !== origemId)
            .map((item) => ({ value: item.id, label: item.nome }))}
        />
      </div>

      <SelectField
        label="Lote"
        name="loteId"
        required
        emptyOption={carregando ? "Carregando…" : "Selecione"}
        value={loteId}
        onChange={(evento) => setLoteId(evento.target.value)}
        options={lotes.map((item) => ({
          value: item.id,
          label: `${item.produtoNome} · ${formatar(item.saldo)} ${item.unidadeMedida}`
            + (item.dataValidade ? ` · vence ${toDate(item.dataValidade)}` : ""),
        }))}
      />

      <InputField
        label="Quantidade"
        name="quantidade"
        type="number"
        step="0.001"
        min="0"
        required
        value={quantidade || ""}
        onChange={(evento) => setQuantidade(Number(evento.target.value) || 0)}
        error={excede && lote ? `Este lote tem ${formatar(lote.saldo)}` : undefined}
      />

      <TextareaField
        label="Motivo"
        name="motivo"
        rows={2}
        placeholder="Remanejamento entre secretarias; excesso em um depósito…"
        value={motivo}
        onChange={(evento) => setMotivo(evento.target.value)}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="button"
          onClick={() => void enviar()}
          disabled={enviando || !loteId || !destinoId || quantidade <= 0 || excede}
        >
          <ArrowRightLeft size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          {enviando ? "Transferindo…" : "Transferir"}
        </Button>
      </div>
    </div>
  );
};
