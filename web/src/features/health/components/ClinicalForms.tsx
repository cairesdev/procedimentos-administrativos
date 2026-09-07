"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { PROCEDURE_LABELS } from "../types";
import {
  registerAdministration, registerAssessment, registerEvolution, registerExamResult,
  registerOutcome, registerProcedure, requestExam,
} from "../actions";
import type { ActionResult } from "@/shared/ui/use-resource-form";

/**
 * Os blocos curtos da ficha, num arquivo só.
 *
 * Cada um é a mesma coisa — um campo, um botão, um `router.refresh()` — e
 * separá-los em sete arquivos daria sete cópias do mesmo `useState`. O que
 * muda entre eles é a ação e o rótulo, e é só isso que cada componente
 * carrega.
 */

/** Agora, no formato que `datetime-local` aceita. Fuso do navegador. */
export const agora = (): string => {
  const data = new Date();
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 16);
};

const useEnvio = () => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (acao: () => Promise<ActionResult>, aoConcluir?: () => void) => {
    setOcupado(true);
    setErro(null);
    const resultado = await acao();
    setOcupado(false);

    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Registrado");
    aoConcluir?.();
    router.refresh();
  };

  return { ocupado, erro, enviar };
};

const Erro = ({ mensagem }: { mensagem: string | null }) =>
  mensagem ? <Alert tone="error">{mensagem}</Alert> : null;

export const AssessmentForm = ({ visitaId }: { visitaId: string }) => {
  const { ocupado, erro, enviar } = useEnvio();
  const [texto, setTexto] = useState("");

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar(() => registerAssessment(visitaId, { queixaClinica: texto }));
      }}
    >
      <Erro mensagem={erro} />
      <TextareaField
          name="queixa-clinica-avaliacao-medica"
        label="Queixa clínica (avaliação médica)"
        wide
        rows={8}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
      />
      <Alert tone="info">
        Ao salvar, a avaliação é assinada com o seu nome e o seu CRM, e não pode
        mais ser alterada.
      </Alert>
      <Button type="submit" disabled={ocupado || !texto.trim()}>
        {ocupado ? "Salvando…" : "Assinar e salvar a avaliação"}
      </Button>
    </form>
  );
};

export const ExamRequestForm = ({ visitaId }: { visitaId: string }) => {
  const { ocupado, erro, enviar } = useEnvio();
  const [descricao, setDescricao] = useState("");

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar(() => requestExam(visitaId, { descricao }), () => setDescricao(""));
      }}
    >
      <Erro mensagem={erro} />
      <InputField
          name="exame-solicitado"
        label="Exame solicitado"
        wide
        value={descricao}
        onChange={(evento) => setDescricao(evento.target.value)}
      />
      <Button type="submit" disabled={ocupado || !descricao.trim()}>
        {ocupado ? "Salvando…" : "Solicitar exame"}
      </Button>
    </form>
  );
};

/**
 * O resultado chega depois — às vezes com o paciente já de alta.
 *
 * É o único registro do módulo que entra em atendimento encerrado, e o único
 * que o enfermeiro também transcreve: o laboratório devolve fora do plantão de
 * quem pediu, e travar no médico faria o resultado esperar o próximo plantão
 * dele.
 */
export const ExamResultForm = ({
  visitaId, exameId,
}: { visitaId: string; exameId: string }) => {
  const { ocupado, erro, enviar } = useEnvio();
  const [resultado, setResultado] = useState("");

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar(() => registerExamResult(visitaId, exameId, { resultado }));
      }}
    >
      <Erro mensagem={erro} />
      <TextareaField
          name="resultado"
        label="Resultado"
        wide
        rows={5}
        value={resultado}
        onChange={(evento) => setResultado(evento.target.value)}
      />
      <Button type="submit" disabled={ocupado || !resultado.trim()}>
        {ocupado ? "Salvando…" : "Registrar resultado"}
      </Button>
    </form>
  );
};

/**
 * O horário em que a medicação foi de fato dada.
 *
 * A tela sugere agora e deixa corrigir: a enfermagem registra depois de
 * atender o paciente, e "dei às 22h" não pode virar "registrei às 23h40".
 */
export const AdministrationForm = ({
  visitaId, itemId, medicamento,
}: { visitaId: string; itemId: string; medicamento: string }) => {
  const { ocupado, erro, enviar } = useEnvio();
  const [horario, setHorario] = useState(agora);
  const [observacao, setObservacao] = useState("");

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar(
          () => registerAdministration(visitaId, itemId, { horario, observacao }),
          () => setObservacao(""),
        );
      }}
    >
      <Erro mensagem={erro} />
      <p style={{ margin: "0 0 12px" }}><strong>{medicamento}</strong></p>
      <FieldGrid>
        <InputField
          name="horario-em-que-foi-administrado"
          label="Horário em que foi administrado"
          type="datetime-local"
          hint="O relógio da parede, não o do sistema."
          value={horario}
          onChange={(evento) => setHorario(evento.target.value)}
        />
        <InputField
          name="observacao"
          label="Observação"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />
      </FieldGrid>
      <Button type="submit" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Carimbar o horário"}
      </Button>
    </form>
  );
};

export const EvolutionForm = ({
  visitaId, tipo,
}: { visitaId: string; tipo: "ENFERMAGEM" | "MEDICA" }) => {
  const { ocupado, erro, enviar } = useEnvio();
  const [texto, setTexto] = useState("");

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar(() => registerEvolution(visitaId, { tipo, texto }), () => setTexto(""));
      }}
    >
      <Erro mensagem={erro} />
      <TextareaField
          name="campo"
        label={tipo === "ENFERMAGEM" ? "Evolução do paciente" : "Evolução médica"}
        wide
        rows={5}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
      />
      <Button type="submit" disabled={ocupado || !texto.trim()}>
        {ocupado ? "Salvando…" : "Registrar evolução"}
      </Button>
    </form>
  );
};

export const ProcedureForm = ({ visitaId }: { visitaId: string }) => {
  const { ocupado, erro, enviar } = useEnvio();
  const [tipo, setTipo] = useState("URGENCIA_SEM_OBSERVACAO");
  const [descricao, setDescricao] = useState("");

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar(
          () => registerProcedure(visitaId, {
            tipo: tipo as Parameters<typeof registerProcedure>[1]["tipo"],
            descricao,
          }),
          () => setDescricao(""),
        );
      }}
    >
      <Erro mensagem={erro} />
      <FieldGrid>
        <SelectField
          name="procedimento-realizado"
          label="Procedimento realizado"
          options={Object.entries(PROCEDURE_LABELS).map(([value, label]) => ({ value, label }))}
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value)}
        />
        <InputField
          name="campo"
          label={tipo === "OUTRO" ? "Qual procedimento (obrigatório)" : "Descrição"}
          wide
          value={descricao}
          onChange={(evento) => setDescricao(evento.target.value)}
        />
      </FieldGrid>
      <Button type="submit" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Registrar procedimento"}
      </Button>
    </form>
  );
};

/**
 * A saída do paciente: único, terminal, assinado pelo enfermeiro.
 *
 * Depois dele o atendimento não recebe registro novo — o que vier é
 * atendimento novo. O aviso diz isso antes de o botão ser apertado.
 */
export const OutcomeForm = ({ visitaId }: { visitaId: string }) => {
  const { ocupado, erro, enviar } = useEnvio();
  const [tipo, setTipo] = useState("ALTA");
  const [destino, setDestino] = useState("");
  const [horario, setHorario] = useState(agora);

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar(() => registerOutcome(visitaId, {
          tipo: tipo as Parameters<typeof registerOutcome>[1]["tipo"],
          destino,
          horario,
        }));
      }}
    >
      <Erro mensagem={erro} />
      <FieldGrid>
        <SelectField
          name="situacao-de-saida"
          label="Situação de saída"
          options={[
            { value: "ALTA", label: "Alta" },
            { value: "ENCAMINHAMENTO", label: "Encaminhamento" },
            { value: "OBITO", label: "Óbito" },
          ]}
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value)}
        />
        <InputField
          name="horario"
          label="Horário"
          type="datetime-local"
          value={horario}
          onChange={(evento) => setHorario(evento.target.value)}
        />
        {tipo === "ENCAMINHAMENTO" ? (
          <InputField
          name="encaminhamento-para"
            label="Encaminhamento para"
            wide
            value={destino}
            onChange={(evento) => setDestino(evento.target.value)}
          />
        ) : null}
      </FieldGrid>
      <Alert tone="error">
        A saída encerra o atendimento. Depois dela a ficha não recebe registro
        novo — só resultado de exame e retificação.
      </Alert>
      <Button type="submit" disabled={ocupado}>
        {ocupado ? "Salvando…" : "Assinar e registrar a saída"}
      </Button>
    </form>
  );
};
