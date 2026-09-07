"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, Badge, FieldGrid } from "@/shared/ui/layout";
import { CONDITION_LABELS } from "../types";
import type { PatientCondition } from "../types";
import { addPatientCondition, removePatientCondition } from "../actions";

/**
 * "Portador: HAS / DM / Alergia / Outros" — do papel, mas do paciente.
 *
 * No formulário impresso essa linha é reescrita a cada visita e some quando
 * alguém esquece. Aqui ela persiste no cadastro, e é o que faz o alerta
 * aparecer antes da prescrição da próxima vez.
 */
export const ConditionsPanel = ({
  pacienteId, condicoes, podeEditar,
}: {
  pacienteId: string;
  condicoes: PatientCondition[];
  podeEditar: boolean;
}) => {
  const router = useRouter();
  const [tipo, setTipo] = useState("ALERGIA");
  const [descricao, setDescricao] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const agir = async (acao: () => Promise<{ error?: string; success?: string }>) => {
    setOcupado(true);
    const resultado = await acao();
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Registrado");
    setDescricao("");
    router.refresh();
  };

  return (
    <>
      {condicoes.length === 0 ? (
        <p style={{ color: "var(--texto_suave)" }}>Nada registrado.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
          {condicoes.map((condicao) => (
            <li key={condicao.id} style={{ margin: "0 0 8px" }}>
              <Badge tone={condicao.tipo === "ALERGIA" ? "warning" : "accent"}>
                {CONDITION_LABELS[condicao.tipo] ?? condicao.tipo}
              </Badge>{" "}
              {condicao.descricao}
              {podeEditar ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={ocupado}
                  onClick={() => void agir(
                    () => removePatientCondition(pacienteId, condicao.id),
                  )}
                >
                  Remover
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {podeEditar ? (
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void agir(() => addPatientCondition(pacienteId, {
              tipo: tipo as PatientCondition["tipo"],
              descricao,
            }));
          }}
        >
          <FieldGrid>
            <SelectField
          name="registrar"
              label="Registrar"
              options={Object.entries(CONDITION_LABELS).map(([value, label]) => ({
                value, label,
              }))}
              value={tipo}
              onChange={(evento) => setTipo(evento.target.value)}
            />
            <InputField
          name="campo"
              label={tipo === "ALERGIA" ? "A que (obrigatório)" : "Descrição"}
              wide
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
            />
          </FieldGrid>
          {tipo === "ALERGIA" ? (
            <Alert tone="info">
              Alergia sem dizer a quê não ajuda ninguém na hora de prescrever —
              é por isso que o campo é obrigatório aqui.
            </Alert>
          ) : null}
          <Button type="submit" disabled={ocupado}>
            {ocupado ? "Salvando…" : "Registrar"}
          </Button>
        </form>
      ) : null}
    </>
  );
};
