"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { FieldGrid } from "@/shared/ui/layout";
import { saveProgram, saveTherapy } from "../actions";
import { CONSELHOS, type CouncilType, type Program, type Therapy } from "../types";

/**
 * O programa — TEA, saúde mental, gestante de risco.
 *
 * Genérico de propósito. O primeiro é o TEA porque foi ele que a requisição do
 * Ministério Público cobrou, mas nada no modelo fala de autismo: a próxima
 * pergunta vai ser sobre outra política, e ela não deve exigir tabela nova.
 */
export const ProgramForm = ({ programa }: { programa?: Program }) => {
  const router = useRouter();
  const [nome, setNome] = useState(programa?.nome ?? "");
  const [sigla, setSigla] = useState(programa?.sigla ?? "");
  const [descricao, setDescricao] = useState(programa?.descricao ?? "");
  const [ativo, setAtivo] = useState(programa?.ativo ?? true);
  const [ocupado, setOcupado] = useState(false);

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setOcupado(true);
    const resultado = await saveProgram({ nome, sigla, descricao, ativo }, programa?.id);
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Programa salvo");
    router.refresh();
  };

  return (
    <form onSubmit={(evento) => void salvar(evento)}>
      <FieldGrid>
        <InputField
          name="nome-do-programa"
          label="Nome do programa"
          wide
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <InputField
          name="sigla"
          label="Sigla"
          value={sigla}
          onChange={(evento) => setSigla(evento.target.value)}
        />
        {programa ? (
          <SelectField
            name="ativo"
            label="Situação"
            options={[
              { value: "sim", label: "Ativo" },
              { value: "nao", label: "Encerrado" },
            ]}
            value={ativo ? "sim" : "nao"}
            onChange={(evento) => setAtivo(evento.target.value === "sim")}
          />
        ) : null}
        <TextareaField
          name="descricao"
          label="Descrição"
          wide
          rows={3}
          value={descricao}
          onChange={(evento) => setDescricao(evento.target.value)}
        />
      </FieldGrid>

      <Button type="submit" disabled={ocupado || !nome.trim()}>
        {ocupado ? "Salvando…" : programa ? "Salvar programa" : "Criar programa"}
      </Button>
    </form>
  );
};

/**
 * A terapia — fonoaudiologia, terapia ocupacional, psicologia.
 *
 * O conselho fica aqui porque a fila é por terapia: é ele que diz qual
 * profissional pode atendê-la, e é por terapia que o ofício pergunta o tempo de
 * espera.
 */
export const TherapyForm = ({
  programaId, terapia,
}: {
  programaId: string;
  terapia?: Therapy;
}) => {
  const router = useRouter();
  const [nome, setNome] = useState(terapia?.nome ?? "");
  const [conselho, setConselho] = useState<CouncilType | "">(terapia?.conselho ?? "");
  const [ativo, setAtivo] = useState(terapia?.ativo ?? true);
  const [ocupado, setOcupado] = useState(false);

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setOcupado(true);
    const resultado = await saveTherapy(programaId, { nome, conselho, ativo }, terapia?.id);
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Terapia salva");
    router.refresh();
  };

  return (
    <form onSubmit={(evento) => void salvar(evento)}>
      <FieldGrid>
        <InputField
          name="nome-da-terapia"
          label="Nome da terapia"
          wide
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <SelectField
          name="conselho"
          label="Conselho profissional"
          hint="Quem pode atender esta terapia."
          options={[
            { value: "", label: "Não se aplica" },
            ...CONSELHOS.map((sigla) => ({ value: sigla, label: sigla })),
          ]}
          value={conselho}
          onChange={(evento) => setConselho(evento.target.value as CouncilType | "")}
        />
        {terapia ? (
          <SelectField
            name="terapia-ativa"
            label="Situação"
            options={[
              { value: "sim", label: "Ativa" },
              { value: "nao", label: "Desativada" },
            ]}
            value={ativo ? "sim" : "nao"}
            onChange={(evento) => setAtivo(evento.target.value === "sim")}
          />
        ) : null}
      </FieldGrid>

      <Button type="submit" disabled={ocupado || !nome.trim()}>
        {ocupado ? "Salvando…" : terapia ? "Salvar terapia" : "Criar terapia"}
      </Button>
    </form>
  );
};
