"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";
import styles from "./Checklist.module.css";
import { Button } from "@/shared/ui/button";
import { FileField, TextareaField } from "@/shared/ui/form-field";
import { Alert, Badge } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { SITUACOES } from "../types";
import type { PublicChecklistItem } from "../public-types";

const rotulo = (situacao: string) =>
  SITUACOES.find((item) => item.value === situacao)
  ?? { label: situacao.toLowerCase(), tone: "neutral" as const };

/**
 * A lista do fornecedor, sem login.
 *
 * Fala direto com `/publico/checklist/<token>` — não passa por server action,
 * porque não há sessão para carregar. O token já está na URL desta página.
 */
export const PublicChecklistForm = ({
  token,
  itens,
}: {
  token: string;
  itens: PublicChecklistItem[];
}) => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const arquivos = useRef<Record<string, HTMLInputElement | null>>({});

  const base = `/api/publico/checklist/${encodeURIComponent(token)}`;

  /**
   * Entregar tem duas partes: abrir a entrega e subir o arquivo.
   *
   * O anexo pende da entrega, então ela precisa existir antes. Se o upload
   * falhar, a entrega fica registrada sem documento — e quem confere recusa
   * pedindo o arquivo, que é melhor que um botão que não fez nada.
   */
  const entregar = async (item: PublicChecklistItem) => {
    const arquivo = arquivos.current[item.id]?.files?.[0];

    if (item.exigeAnexo && !arquivo) {
      toast.error("Este item exige um documento anexado.");
      return;
    }

    setOcupado(item.id);
    const criado = await fetch(`${base}/itens/${item.id}/cumprir`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ observacao: observacoes[item.id] ?? "" }),
    });

    if (!criado.ok) {
      setOcupado(null);
      const corpo = await criado.json().catch(() => null);
      toast.error(corpo?.message ?? "Não foi possível registrar a entrega.");
      return;
    }

    const { id: cumprimentoId } = await criado.json();

    if (arquivo) {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const envio = await fetch(`${base}/cumprimentos/${cumprimentoId}/anexos`, {
        method: "POST",
        body: corpo,
      });
      if (!envio.ok) {
        setOcupado(null);
        toast.error("A entrega foi registrada, mas o arquivo não subiu. Tente anexar de novo.");
        router.refresh();
        return;
      }
    }

    setOcupado(null);
    toast.success("Entrega registrada. A prefeitura vai conferir.");
    setObservacoes((atuais) => ({ ...atuais, [item.id]: "" }));
    router.refresh();
  };

  return (
    <div className={styles.lista}>
      {itens.map((item) => {
        const estado = rotulo(item.situacao);
        const podeEntregar = item.situacao === "PENDENTE" || item.situacao === "VENCIDO";

        return (
          <section
            key={item.id}
            className={styles.item}
          >
            <div className={styles.item_cabecalho}>
              <div>
                <strong>{item.titulo}</strong>
                {item.descricao ? (
                  <p className={styles.item_descricao}>
                    {item.descricao}
                  </p>
                ) : null}
              </div>
              <Badge tone={estado.tone}>{estado.label}</Badge>
            </div>

            {item.prazoLimite && podeEntregar ? (
              <small className={styles.suave}>
                Prazo: {toDate(item.prazoLimite)}
              </small>
            ) : null}

            {item.ultimaEntrega?.recusaMotivo ? (
              <Alert tone="error">
                A prefeitura recusou a entrega anterior: {item.ultimaEntrega.recusaMotivo}
              </Alert>
            ) : null}

            {item.situacao === "AGUARDANDO_CONFERENCIA" ? (
              <Alert tone="info">
                Enviado em {toDate(item.ultimaEntrega!.cumpridoEm)}. Aguardando conferência.
              </Alert>
            ) : null}

            {item.situacao === "CUMPRIDO" && item.ultimaEntrega?.vigenciaAte ? (
              <small className={styles.suave}>
                Aceito, e vale até {toDate(item.ultimaEntrega.vigenciaAte)} — depois disso será
                pedido de novo.
              </small>
            ) : null}

            {item.situacao === "VENCIDO" ? (
              <Alert tone="info">
                O documento entregue antes venceu. É preciso enviar um novo.
              </Alert>
            ) : null}

            {podeEntregar ? (
              <>
                <FileField
                  name={`arquivo-${item.id}`}
                  label={`Documento ${item.exigeAnexo ? "(obrigatório)" : "(opcional)"}`}
                  required={item.exigeAnexo}
                  ref={(elemento) => { arquivos.current[item.id] = elemento; }}
                />

                <TextareaField
                  label="Observação"
                  name={`observacao-${item.id}`}
                  rows={2}
                  placeholder="Alguma coisa que a prefeitura precise saber."
                  value={observacoes[item.id] ?? ""}
                  onChange={(evento) => setObservacoes((atuais) => ({
                    ...atuais, [item.id]: evento.target.value,
                  }))}
                />

                <div className={styles.rodape}>
                  <Button
                    type="button"
                    disabled={ocupado !== null}
                    onClick={() => void entregar(item)}
                  >
                    {ocupado === item.id ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
              </>
            ) : null}
          </section>
        );
      })}
    </div>
  );
};
