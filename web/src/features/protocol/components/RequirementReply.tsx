"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, Card, Stack } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import type { Requirement } from "../types";

/**
 * Resposta do requerente, no acompanhamento público.
 *
 * Não há sessão: o par protocolo + documento acompanha cada chamada, o mesmo
 * que abriu a consulta. Guardar sessão para o cidadão traria expiração,
 * recuperação de acesso e suporte por causa de duas ou três interações.
 */
export const RequirementReply = ({
  protocolo,
  documento,
  exigencias,
}: {
  protocolo: string;
  documento: string;
  /** Já vêm com a página: a página do servidor tem a mesma credencial. */
  exigencias: Requirement[];
}) => {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const credencial = { protocolo, documento };
  const pendente = exigencias.find((exigencia) => exigencia.status === "PENDENTE");

  const responder = async () => {
    if (texto.trim().length < 5) {
      toast.error("Escreva sua resposta");
      return;
    }
    setEnviando(true);
    try {
      const resposta = await fetch("/api/publico/pedidos?acao=responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credencial, texto }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        toast.error(dados?.message ?? "Não foi possível enviar a resposta");
        return;
      }

      // O documento vai depois da resposta: se o envio do arquivo falhar, o
      // texto já está registrado e o cidadão não perde o que escreveu.
      if (arquivo && pendente) {
        const corpo = new FormData();
        corpo.append("arquivo", arquivo);
        corpo.append("protocolo", protocolo);
        corpo.append("documento", documento);
        corpo.append("exigenciaId", pendente.id);

        const envio = await fetch("/api/publico/pedidos?acao=anexos", {
          method: "POST",
          body: corpo,
        });
        if (!envio.ok) {
          const erro = await envio.json().catch(() => null);
          toast.error(
            erro?.message ?? "A resposta foi registrada, mas o documento não subiu. Tente anexar de novo.",
          );
          router.refresh();
          return;
        }
      }

      toast.success("Resposta enviada");
      setTexto("");
      setArquivo(null);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  };

  if (exigencias.length === 0) return null;

  return (
    <Card title="Pendências">
      <Stack>
        {pendente ? (
          <>
            <Alert tone="error">
              A prefeitura precisa de algo seu para continuar.
              {pendente.prazoLimite ? ` Prazo até ${toDate(pendente.prazoLimite)}.` : ""}
            </Alert>

            <p style={{ fontSize: "13px" }}>{pendente.texto}</p>

            <label htmlFor="resposta" style={{ fontSize: "13px", fontWeight: 500 }}>
              Sua resposta
            </label>
            <textarea
              id="resposta"
              rows={4}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Explique o que está enviando."
            />

            <FileField
              name="arquivo"
              label="Documento (opcional)"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              hint="PDF, PNG, JPEG ou WEBP, até 10 MB."
              onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)}
            />

            <div>
              <Button type="button" onClick={responder} disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar resposta"}
              </Button>
            </div>
          </>
        ) : (
          <Alert tone="success">
            Nenhuma pendência sua no momento. O pedido segue com a prefeitura.
          </Alert>
        )}

        {exigencias
          .filter((exigencia) => exigencia.status !== "PENDENTE")
          .map((exigencia) => (
            <div key={exigencia.id} style={{ fontSize: "12.5px", color: "var(--texto_suave)" }}>
              <strong>{exigencia.status === "RESPONDIDA" ? "Respondida" : "Cancelada"}:</strong>{" "}
              {exigencia.texto}
            </div>
          ))}
      </Stack>
    </Card>
  );
};
