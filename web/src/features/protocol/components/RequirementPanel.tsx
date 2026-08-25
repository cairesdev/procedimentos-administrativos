"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, TextareaField } from "@/shared/ui/form-field";
import { Alert, Badge, Stack } from "@/shared/ui/layout";
import { toDate, toDateTime } from "@/shared/ui/labels";
import { cancelRequirement, createRequirement } from "../actions";
import type { Requirement } from "../types";

const vencida = (exigencia: Requirement) =>
  exigencia.status === "PENDENTE"
  && exigencia.prazoLimite !== null
  && new Date(`${exigencia.prazoLimite}T23:59:59`) < new Date();

/**
 * Exigências do processo. Enquanto há uma pendente, quem está devendo é o
 * requerente — e a tela diz isso, para o processo parado não parecer atraso
 * do setor.
 */
export const RequirementPanel = ({
  processoId,
  exigencias,
  podeExigir,
}: {
  processoId: string;
  exigencias: Requirement[];
  podeExigir: boolean;
}) => {
  const [abrindo, setAbrindo] = useState(false);
  const [texto, setTexto] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, iniciar] = useTransition();

  const pendente = exigencias.find((exigencia) => exigencia.status === "PENDENTE");

  const registrar = () => {
    iniciar(async () => {
      const resultado = await createRequirement(processoId, {
        texto,
        prazoDias: prazo ? Number(prazo) : undefined,
      });
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.success);
      setAbrindo(false);
      setTexto("");
      setPrazo("");
    });
  };

  const cancelar = (exigenciaId: string) => {
    const motivo = window.prompt("Por que esta exigência está sendo cancelada?");
    if (!motivo) return;

    iniciar(async () => {
      const resultado = await cancelRequirement(processoId, exigenciaId, { motivo });
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.success);
    });
  };

  return (
    <Stack>
      {pendente ? (
        <Alert tone={vencida(pendente) ? "error" : "info"}>
          {vencida(pendente)
            ? `O prazo da exigência venceu em ${toDate(pendente.prazoLimite!)} e o requerente não respondeu.`
            : "Este processo está aguardando resposta do requerente."}
        </Alert>
      ) : null}

      {exigencias.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--texto_suave)" }}>
          Nenhuma exigência registrada neste processo.
        </p>
      ) : (
        <ul style={{ display: "grid", gap: "12px", listStyle: "none", padding: 0, margin: 0 }}>
          {exigencias.map((exigencia) => (
            <li
              key={exigencia.id}
              style={{
                border: "1px solid var(--borda)",
                borderRadius: "var(--raio)",
                padding: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                <small style={{ color: "var(--texto_suave)" }}>
                  {toDateTime(exigencia.criadaEm)} · {exigencia.criadaPorNome}
                </small>
                {exigencia.status === "PENDENTE" ? (
                  <Badge tone={vencida(exigencia) ? "warning" : "accent"}>
                    {vencida(exigencia) ? "prazo vencido" : "aguardando resposta"}
                  </Badge>
                ) : exigencia.status === "RESPONDIDA" ? (
                  <Badge tone="success">respondida</Badge>
                ) : (
                  <Badge tone="neutral">cancelada</Badge>
                )}
              </div>

              <p style={{ fontSize: "13px", margin: "6px 0" }}>{exigencia.texto}</p>

              {exigencia.prazoLimite ? (
                <small style={{ color: "var(--texto_suave)" }}>
                  Prazo até {toDate(exigencia.prazoLimite)}
                </small>
              ) : null}

              {exigencia.respostaTexto ? (
                <div
                  style={{
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px dashed var(--borda)",
                  }}
                >
                  <small style={{ color: "var(--texto_suave)" }}>
                    Resposta do requerente em {toDateTime(exigencia.respondidaEm!)}
                    {exigencia.anexos > 0
                      ? ` · ${exigencia.anexos} documento(s) juntado(s)`
                      : ""}
                  </small>
                  <p style={{ fontSize: "13px", marginTop: "4px" }}>{exigencia.respostaTexto}</p>
                </div>
              ) : null}

              {exigencia.canceladaMotivo ? (
                <small style={{ color: "var(--texto_suave)", display: "block", marginTop: "6px" }}>
                  Cancelada: {exigencia.canceladaMotivo}
                </small>
              ) : null}

              {exigencia.status === "PENDENTE" && podeExigir ? (
                <div style={{ marginTop: "10px" }}>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={salvando}
                    onClick={() => cancelar(exigencia.id)}
                  >
                    Cancelar exigência
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {podeExigir && !pendente ? (
        abrindo ? (
          <Stack>
            <TextareaField
              name="texto"
              label="O que falta"
              required
              rows={4}
              placeholder="Explique ao requerente, em linguagem simples, o que ele precisa apresentar."
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
            />
            <InputField
              name="prazoDias"
              label="Prazo para resposta (dias)"
              type="number"
              min={1}
              hint="Opcional. O prazo é congelado agora e aparece para o requerente."
              value={prazo}
              onChange={(evento) => setPrazo(evento.target.value)}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <Button type="button" onClick={registrar} disabled={salvando}>
                {salvando ? "Registrando…" : "Registrar exigência"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAbrindo(false)}>
                Cancelar
              </Button>
            </div>
          </Stack>
        ) : (
          <div>
            <Button type="button" variant="secondary" onClick={() => setAbrindo(true)}>
              Exigir documento do requerente
            </Button>
          </div>
        )
      ) : null}
    </Stack>
  );
};
