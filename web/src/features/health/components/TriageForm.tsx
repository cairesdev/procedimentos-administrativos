"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { triageSchema, type TriageInput } from "../schemas";
import { registerTriage } from "../actions";

/**
 * A triagem de enfermagem — o quadro de sinais vitais do papel.
 *
 * **Assina ao salvar.** Não há rascunho: o enfermeiro mede, escreve e fecha no
 * mesmo ato, e a partir daí o registro não muda. Um rascunho editável de
 * triagem seria sinal vital que troca de valor entre a medição e a assinatura.
 *
 * Os avisos que voltam da API aparecem e **não impedem nada**. Saturação 71% e
 * temperatura 41 °C existem, são graves, e são exatamente o paciente que
 * precisa ser registrado depressa — um formulário que recusasse esses números
 * obrigaria o enfermeiro a escrever um valor falso para conseguir salvar.
 */
export const TriageForm = ({ visitaId }: { visitaId: string }) => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [valores, setValores] = useState<TriageInput>({
    glicemia: "", paSistolica: "", paDiastolica: "", pulso: "",
    saturacao: "", temperatura: "", queixa: "", conduta: "", prioridade: false,
  });

  const campo = (chave: keyof TriageInput) => ({
    name: chave,
    value: String(valores[chave] ?? ""),
    onChange: (evento: { target: { value: string } }) =>
      setValores((atual) => ({ ...atual, [chave]: evento.target.value })),
  });

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const conferido = triageSchema.safeParse(valores);
    if (!conferido.success) {
      setErro(conferido.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setOcupado(true);
    setErro(null);
    const resultado = await registerTriage(visitaId, conferido.data);
    setOcupado(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Triagem registrada");
    router.refresh();
  };

  return (
    <form onSubmit={(evento) => void enviar(evento)}>
      {erro ? <Alert tone="error">{erro}</Alert> : null}

      <FieldGrid>
        <InputField label="Glicemia capilar (mg/dL)" inputMode="numeric" {...campo("glicemia")} />
        <InputField label="PA sistólica (mmHg)" inputMode="numeric" {...campo("paSistolica")} />
        <InputField label="PA diastólica (mmHg)" inputMode="numeric" {...campo("paDiastolica")} />
        <InputField label="Pulso (bpm)" inputMode="numeric" {...campo("pulso")} />
        <InputField label="Saturação SpO₂ (%)" inputMode="numeric" {...campo("saturacao")} />
        <InputField label="Temperatura (°C)" inputMode="decimal" {...campo("temperatura")} />

        <TextareaField label="Queixa clínica" wide rows={4} {...campo("queixa")} />

        <SelectField
          label="Conduta"
          options={[
            { value: "", label: "Não definida" },
            { value: "URGENCIA", label: "Atendimento de urgência" },
            { value: "ENCAMINHADO_UBS", label: "Encaminhado para UBS" },
            { value: "ENCAMINHADO_INTERNACAO", label: "Encaminhado para internação" },
          ]}
          {...campo("conduta")}
        />
      </FieldGrid>

      <label style={{ display: "block", margin: "0 0 16px" }}>
        <input
          type="checkbox"
          checked={valores.prioridade}
          onChange={(evento) =>
            setValores((atual) => ({ ...atual, prioridade: evento.target.checked }))}
          style={{ marginRight: "8px" }}
        />
        <strong>Prioridade de atendimento</strong>
      </label>

      <Alert tone="info">
        Ao salvar, a triagem é assinada com o seu nome e o seu COREN, e não pode
        mais ser alterada. Se houver erro depois, registre uma retificação.
      </Alert>

      <Button type="submit" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Assinar e salvar a triagem"}
      </Button>
    </form>
  );
};
