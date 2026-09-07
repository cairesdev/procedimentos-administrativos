"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, Card, FieldGrid } from "@/shared/ui/layout";
import { ROUTE_LABELS } from "../types";
import { registerPrescription } from "../actions";

/** As oito vias do CHECK da tabela. Lista fechada aqui e no schema. */
type Via =
  | "ORAL" | "IV" | "IM" | "SC" | "TOPICA" | "INALATORIA" | "RETAL" | "OUTRA";

type Item = {
  medicamento: string; dose: string; via: Via; frequencia: string; observacao: string;
};

const VAZIO: Item = {
  medicamento: "", dose: "", via: "ORAL", frequencia: "", observacao: "",
};

/**
 * A prescrição em itens, e não em texto corrido.
 *
 * É o que torna possível a coluna de horários da enfermagem carimbar item por
 * item, e o que abre a porta da farmácia ligada ao estoque. Texto livre seria
 * mais rápido de digitar e fecharia as duas.
 *
 * O alerta de alergia volta da API e **não bloqueia**: a comparação é textual,
 * e travar com uma checagem grosseira ensinaria o médico a contornar —
 * inclusive no dia em que o alerta estivesse certo.
 */
export const PrescriptionForm = ({
  visitaId, alergias,
}: { visitaId: string; alergias: string[] }) => {
  const router = useRouter();
  const [itens, setItens] = useState<Item[]>([{ ...VAZIO }]);
  const [orientacoes, setOrientacoes] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);

  const mudar = (indice: number, chave: keyof Item, valor: string) =>
    setItens((atual) => atual.map((item, i) => (
      i === indice ? { ...item, [chave]: valor as Via & string } : item
    )));

  const preenchidos = itens.filter((item) => item.medicamento.trim());

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (preenchidos.length === 0 && !orientacoes.trim()) {
      setErro("Informe ao menos um medicamento ou uma orientação.");
      return;
    }

    setOcupado(true);
    setErro(null);
    const resultado = await registerPrescription(visitaId, {
      orientacoes,
      itens: preenchidos,
    });
    setOcupado(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Prescrição registrada");
    setItens([{ ...VAZIO }]);
    setOrientacoes("");
    setAlertas([]);
    router.refresh();
  };

  return (
    <form onSubmit={(evento) => void enviar(evento)}>
      {erro ? <Alert tone="error">{erro}</Alert> : null}

      {/*
        A alergia aparece antes de o médico digitar, e não depois de salvar:
        é agora que ela muda o que vai ser prescrito.
      */}
      {alergias.length > 0 ? (
        <Alert tone="error">
          <strong>Alergias registradas deste paciente:</strong> {alergias.join("; ")}
        </Alert>
      ) : null}

      {alertas.map((alerta) => (
        <Alert key={alerta} tone="info">{alerta}</Alert>
      ))}

      {itens.map((item, indice) => (
        <Card key={indice}>
          <FieldGrid>
            <InputField
          name="medicamento"
              label="Medicamento"
              wide
              value={item.medicamento}
              onChange={(evento) => mudar(indice, "medicamento", evento.target.value)}
            />
            <InputField
          name="dose"
              label="Dose"
              value={item.dose}
              onChange={(evento) => mudar(indice, "dose", evento.target.value)}
            />
            <SelectField
          name="via"
              label="Via"
              options={Object.entries(ROUTE_LABELS).map(([value, label]) => ({ value, label }))}
              value={item.via}
              onChange={(evento) => mudar(indice, "via", evento.target.value)}
            />
            <InputField
          name="frequencia"
              label="Frequência"
              hint="Ex.: 6/6h, dose única."
              value={item.frequencia}
              onChange={(evento) => mudar(indice, "frequencia", evento.target.value)}
            />
            <InputField
          name="observacao"
              label="Observação"
              wide
              value={item.observacao}
              onChange={(evento) => mudar(indice, "observacao", evento.target.value)}
            />
          </FieldGrid>
          {itens.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setItens((atual) => atual.filter((_, i) => i !== indice))}
            >
              Remover este item
            </Button>
          ) : null}
        </Card>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setItens((atual) => [...atual, { ...VAZIO }])}
      >
        Adicionar medicamento
      </Button>

      <TextareaField
          name="orientacoes-gerais"
        label="Orientações gerais"
        hint="Dieta, repouso, cuidados — o que não cabe em dose e via."
        wide
        rows={3}
        value={orientacoes}
        onChange={(evento) => setOrientacoes(evento.target.value)}
      />

      <Alert tone="info">
        Ao salvar, a prescrição é assinada com o seu nome e o seu CRM. Os
        horários de cada administração são carimbados depois, pela enfermagem.
      </Alert>

      <Button type="submit" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Assinar e salvar a prescrição"}
      </Button>
    </form>
  );
};
