"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { TextareaField } from "@/shared/ui/form-field";
import { Modal } from "@/shared/ui/Modal";
import { acceptItem, dismissItem, fulfillItem, refuseItem, reopenItem } from "../actions";
import { situacaoDoItem } from "../situacao";
import type { ChecklistItem } from "../types";

/**
 * O que dá para fazer com um item, e quem pode.
 *
 * Cumprir e conferir são botões diferentes para pessoas diferentes: ninguém
 * fecha o próprio item. A tela esconde o que a pessoa não pode fazer em vez de
 * mostrar e deixar a API recusar.
 */
export const ItemActions = ({
  checklistId,
  item,
  podeCumprir,
  podeConferir,
  podeDispensar,
}: {
  checklistId: string;
  item: ChecklistItem;
  podeCumprir: boolean;
  podeConferir: boolean;
  podeDispensar: boolean;
}) => {
  const router = useRouter();
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [ocupado, setOcupado] = useState(false);
  const [cumprindo, setCumprindo] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [dispensando, setDispensando] = useState(false);
  const [texto, setTexto] = useState("");

  const situacao = situacaoDoItem(item);
  const podeEntregar = situacao === "PENDENTE" || situacao === "VENCIDO";
  const aguardando = situacao === "AGUARDANDO_CONFERENCIA";

  const depois = (mensagem: string) => {
    toast.success(mensagem);
    setTexto("");
    setCumprindo(false);
    setRecusando(false);
    setDispensando(false);
    router.refresh();
  };

  /**
   * Entregar é um passo com duas partes: abrir o ciclo e subir o arquivo.
   *
   * O anexo pende do ciclo, então o ciclo precisa existir antes. Se o upload
   * falhar, a entrega fica registrada sem documento — e quem confere recusa
   * pedindo o arquivo, que é o caminho certo: melhor uma entrega incompleta
   * visível que um botão que não fez nada.
   */
  const entregar = async () => {
    setOcupado(true);
    const resultado = await fulfillItem(checklistId, item.id, { observacao: texto });

    if (resultado.error || !resultado.cumprimentoId) {
      setOcupado(false);
      toast.error(resultado.error ?? "Não foi possível registrar");
      return;
    }

    const arquivo = arquivoRef.current?.files?.[0];
    if (arquivo) {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      const envio = await fetch(
        // Pelo proxy: o token da sessão nunca chega ao navegador.
        `/api/proxy/checklists/${checklistId}/cumprimentos/${resultado.cumprimentoId}/anexos`,
        { method: "POST", body: corpo },
      );
      if (!envio.ok) {
        setOcupado(false);
        toast.error("A entrega foi registrada, mas o arquivo não subiu. Tente anexar de novo.");
        router.refresh();
        return;
      }
    }

    setOcupado(false);
    depois("Entrega registrada");
  };

  const executar = async (acao: () => Promise<{ error?: string; success?: string }>) => {
    setOcupado(true);
    const resultado = await acao();
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    depois(resultado.success ?? "Pronto");
  };

  return (
    <>
      <span style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
        {podeCumprir && podeEntregar ? (
          <Button type="button" disabled={ocupado} onClick={() => setCumprindo(true)}>
            Entregar
          </Button>
        ) : null}

        {podeConferir && aguardando ? (
          <>
            <Button
              type="button"
              disabled={ocupado}
              onClick={() => void executar(() => acceptItem(checklistId, item.id))}
            >
              <Check size={14} aria-hidden="true" style={{ marginRight: "4px" }} />
              Aceitar
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={ocupado}
              onClick={() => setRecusando(true)}
            >
              <X size={14} aria-hidden="true" style={{ marginRight: "4px" }} />
              Recusar
            </Button>
          </>
        ) : null}

        {podeDispensar && !item.dispensadoEm && podeEntregar ? (
          <Button
            type="button"
            variant="secondary"
            disabled={ocupado}
            onClick={() => setDispensando(true)}
          >
            Dispensar
          </Button>
        ) : null}

        {podeDispensar && item.dispensadoEm ? (
          <Button
            type="button"
            variant="secondary"
            disabled={ocupado}
            onClick={() => void executar(() => reopenItem(checklistId, item.id))}
          >
            Reabrir
          </Button>
        ) : null}
      </span>

      <Modal
        open={cumprindo}
        onClose={() => setCumprindo(false)}
        title={`Entregar · ${item.titulo}`}
        description="A entrega fica aguardando conferência de quem cobra."
      >
        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <label
              htmlFor={`arquivo-${item.id}`}
              style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}
            >
              <Paperclip size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} />{" "}
              Documento {item.exigeAnexo ? "(obrigatório)" : "(opcional)"}
            </label>
            <input id={`arquivo-${item.id}`} type="file" ref={arquivoRef} />
            {item.exigeAnexo ? (
              <small style={{ color: "var(--texto_suave)" }}>
                Este item exige documento — sem ele, a conferência será recusada.
              </small>
            ) : null}
          </div>

          <TextareaField
            label="Observação"
            name={`observacao-${item.id}`}
            rows={3}
            placeholder="Alguma coisa que quem confere precise saber."
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="button" disabled={ocupado} onClick={() => void entregar()}>
              {ocupado ? "Enviando…" : "Registrar entrega"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={recusando}
        onClose={() => setRecusando(false)}
        title="Recusar entrega"
        description="O item volta a pendente, e quem cumpriu vê o motivo."
      >
        <div style={{ display: "grid", gap: "14px" }}>
          <TextareaField
            label="O que precisa ser corrigido"
            name={`recusa-${item.id}`}
            required
            rows={3}
            placeholder="Certidão vencida; documento ilegível; falta a assinatura…"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              disabled={ocupado || texto.trim().length < 3}
              onClick={() => void executar(
                () => refuseItem(checklistId, item.id, { recusaMotivo: texto }),
              )}
            >
              Confirmar recusa
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={dispensando}
        onClose={() => setDispensando(false)}
        title="Dispensar item"
        description="O item deixa de ser exigível, e sai da cobrança."
      >
        <div style={{ display: "grid", gap: "14px" }}>
          <TextareaField
            label="Justificativa"
            name={`dispensa-${item.id}`}
            required
            rows={3}
            placeholder="Não se aplica a esta contratação; já atendido por outro documento…"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              disabled={ocupado || texto.trim().length < 3}
              onClick={() => void executar(
                () => dismissItem(checklistId, item.id, { motivo: texto }),
              )}
            >
              Dispensar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
