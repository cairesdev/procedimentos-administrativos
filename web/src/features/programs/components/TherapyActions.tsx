"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { endTherapy, indicate, recordSession, startTherapy } from "../actions";
import type { Therapy } from "../types";

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Indicar a terapia — o ato que coloca alguém na fila.
 *
 * A fila é por terapia, e não por pessoa: a criança pode estar sendo atendida
 * em fonoaudiologia e esperando terapia ocupacional há oito meses. Somar as
 * duas numa fila só esconderia exatamente o caso que o ofício pergunta.
 */
export const IndicateButton = ({
  inscricaoId, terapias,
}: {
  inscricaoId: string;
  terapias: Therapy[];
}) => {
  const router = useRouter();
  const [terapiaId, setTerapia] = useState(terapias[0]?.id ?? "");
  const [indicadaEm, setIndicada] = useState("");
  const [periodicidadeSemanal, setPeriodicidade] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const indicar = async () => {
    setOcupado(true);
    const resultado = await indicate(inscricaoId, {
      terapiaId, indicadaEm, periodicidadeSemanal,
    });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Terapia indicada");
    router.refresh();
  };

  if (terapias.length === 0) {
    return (
      <Alert tone="info">
        Este programa ainda não tem terapia cadastrada. Quem as cadastra é o
        administrador, em Administração → Programas de cuidado.
      </Alert>
    );
  }

  return (
    <ModalTrigger
      label="Indicar terapia"
      title="Indicar terapia"
      description="A indicação abre a espera. Ela só fecha quando a terapia começar de fato."
    >
      <FieldGrid>
        <SelectField
          name="terapia"
          label="Terapia"
          wide
          options={terapias.map((terapia) => ({ value: terapia.id, label: terapia.nome }))}
          value={terapiaId}
          onChange={(evento) => setTerapia(evento.target.value)}
        />
        <InputField
          name="indicada-em"
          label="Indicada em"
          type="date"
          hint="Em branco é hoje. É daqui que a espera começa a contar."
          value={indicadaEm}
          onChange={(evento) => setIndicada(evento.target.value)}
        />
        <InputField
          name="periodicidade"
          label="Sessões por semana (combinado)"
          type="number"
          step="0.5"
          min="0.5"
          hint="Uma a cada quinze dias é 0,5. Em branco quando ainda não foi combinado."
          value={periodicidadeSemanal}
          onChange={(evento) => setPeriodicidade(evento.target.value)}
        />
      </FieldGrid>

      <Button type="button" disabled={ocupado || !terapiaId} onClick={() => void indicar()}>
        {ocupado ? "Salvando…" : "Indicar"}
      </Button>
    </ModalTrigger>
  );
};

/**
 * O registro que fecha a espera.
 *
 * Enquanto ele não existir, a pessoa continua na fila e a espera dela cresce
 * sozinha todo dia — inclusive no papel que vai para a Promotoria.
 */
export const StartTherapyButton = ({
  indicacaoId, inscricaoId, terapiaNome,
}: {
  indicacaoId: string; inscricaoId: string; terapiaNome: string;
}) => {
  const router = useRouter();
  const [em, setEm] = useState(hoje());
  const [ocupado, setOcupado] = useState(false);

  const iniciar = async () => {
    setOcupado(true);
    const resultado = await startTherapy(indicacaoId, inscricaoId, { em });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Terapia iniciada");
    router.refresh();
  };

  return (
    <ModalTrigger
      label="Iniciar"
      variant="secondary"
      title={`Iniciar — ${terapiaNome}`}
      description="A data do primeiro atendimento é o que fecha a espera desta pessoa."
    >
      <FieldGrid>
        <InputField
          name="iniciada-em"
          label="Primeiro atendimento em"
          type="date"
          value={em}
          onChange={(evento) => setEm(evento.target.value)}
        />
      </FieldGrid>
      <Button type="button" disabled={ocupado || !em} onClick={() => void iniciar()}>
        {ocupado ? "Salvando…" : "Iniciar terapia"}
      </Button>
    </ModalTrigger>
  );
};

export const EndTherapyButton = ({
  indicacaoId, inscricaoId, terapiaNome,
}: {
  indicacaoId: string; inscricaoId: string; terapiaNome: string;
}) => {
  const router = useRouter();
  const [em, setEm] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const encerrar = async () => {
    setOcupado(true);
    const resultado = await endTherapy(indicacaoId, inscricaoId, { em, motivo });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Terapia encerrada");
    router.refresh();
  };

  return (
    <ModalTrigger
      label="Encerrar"
      variant="ghost"
      title={`Encerrar — ${terapiaNome}`}
      description="O motivo fica no registro: alta, transferência e abandono são respostas diferentes."
    >
      <FieldGrid>
        <InputField
          name="encerrada-em"
          label="Encerrada em"
          type="date"
          value={em}
          onChange={(evento) => setEm(evento.target.value)}
        />
        <InputField
          name="motivo"
          label="Motivo"
          wide
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
      </FieldGrid>
      <Button
        type="button"
        disabled={ocupado || !em || !motivo.trim()}
        onClick={() => void encerrar()}
      >
        {ocupado ? "Salvando…" : "Encerrar terapia"}
      </Button>
    </ModalTrigger>
  );
};

/**
 * A sessão que aconteceu — e a que foi marcada e não aconteceu.
 *
 * A falta entra registrada, e não apagada: ela é a diferença entre a
 * periodicidade combinada e a que a família recebeu, que é o que o item 2 do
 * ofício pergunta. Apagar a falta faria o serviço parecer melhor do que é.
 */
export const SessionButton = ({
  indicacaoId, inscricaoId, terapiaNome,
}: {
  indicacaoId: string; inscricaoId: string; terapiaNome: string;
}) => {
  const router = useRouter();
  const [data, setData] = useState(hoje());
  const [compareceu, setCompareceu] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const registrar = async () => {
    setOcupado(true);
    const resultado = await recordSession(indicacaoId, inscricaoId, {
      data, compareceu, observacao,
    });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Sessão registrada");
    setObservacao("");
    router.refresh();
  };

  return (
    <ModalTrigger
      label="Registrar sessão"
      variant="secondary"
      title={`Sessão — ${terapiaNome}`}
      description="Registra o que houve, e não o que estava marcado: a falta também entra."
    >
      <FieldGrid>
        <InputField
          name="data-da-sessao"
          label="Data"
          type="date"
          value={data}
          onChange={(evento) => setData(evento.target.value)}
        />
        <SelectField
          name="compareceu"
          label="Compareceu?"
          options={[
            { value: "sim", label: "Sim, foi atendido" },
            { value: "nao", label: "Não compareceu" },
          ]}
          value={compareceu ? "sim" : "nao"}
          onChange={(evento) => setCompareceu(evento.target.value === "sim")}
        />
        <TextareaField
          name="observacao-da-sessao"
          label="Observação"
          wide
          rows={3}
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />
      </FieldGrid>
      <Button type="button" disabled={ocupado || !data} onClick={() => void registrar()}>
        {ocupado ? "Salvando…" : "Registrar sessão"}
      </Button>
    </ModalTrigger>
  );
};
