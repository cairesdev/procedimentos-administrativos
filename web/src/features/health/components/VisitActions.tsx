"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { amendRecord, identifyPatient, lookupPatients, openVisit } from "../actions";
import type { HealthUnit, PatientSummary } from "../types";

/**
 * Procurar o paciente sem sair do formulário.
 *
 * A recepção tem a pessoa na frente e um papel na mão — pode ser o nome, pode
 * ser o cartão. O campo é um só e a busca aceita os dois, porque escolher em
 * qual campo digitar é uma pergunta a mais entre a atendente e o atendimento.
 */
const BuscaDePaciente = ({
  aoEscolher, escolhido,
}: {
  aoEscolher: (paciente: PatientSummary | null) => void;
  escolhido: PatientSummary | null;
}) => {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<PatientSummary[]>([]);
  const [procurando, setProcurando] = useState(false);

  const procurar = async (valor: string) => {
    setTermo(valor);
    if (valor.trim().length < 2) {
      setAchados([]);
      return;
    }
    setProcurando(true);
    setAchados(await lookupPatients(valor));
    setProcurando(false);
  };

  if (escolhido) {
    return (
      <div style={{ margin: "0 0 16px" }}>
        <p style={{ margin: 0 }}>
          <strong>{escolhido.nome}</strong>{" "}
          <small style={{ color: "var(--texto_suave)" }}>
            prontuário {escolhido.prontuario}
          </small>
        </p>
        <Button type="button" variant="ghost" onClick={() => aoEscolher(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div style={{ margin: "0 0 16px" }}>
      <InputField
          name="paciente"
        label="Paciente"
        wide
        hint="Nome, prontuário ou documento. Deixe em branco se ainda não souber quem é."
        value={termo}
        onChange={(evento) => void procurar(evento.target.value)}
      />
      {procurando ? <small>Procurando…</small> : null}
      {achados.map((paciente) => (
        <Button
          key={paciente.id}
          type="button"
          variant="ghost"
          onClick={() => aoEscolher(paciente)}
        >
          {paciente.nome} — prontuário {paciente.prontuario}
        </Button>
      ))}
    </div>
  );
};

/**
 * Abrir a ficha. **O paciente pode ficar em branco.**
 *
 * É a decisão mais importante desta tela: inconsciente, sem acompanhante e sem
 * documento, registra-se a hora e o socorro começa. A identificação entra
 * depois, quando alguém reconhecer.
 */
export const OpenVisitButton = ({ unidades }: { unidades: HealthUnit[] }) => {
  const router = useRouter();
  const [unidadeSaudeId, setUnidade] = useState(unidades[0]?.id ?? "");
  const [paciente, setPaciente] = useState<PatientSummary | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const abrir = async () => {
    setOcupado(true);
    const resultado = await openVisit({ unidadeSaudeId, pacienteId: paciente?.id ?? "" });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Atendimento aberto");
    router.refresh();
    if (resultado.id) router.push(`/saude/atendimentos/${resultado.id}`);
  };

  return (
    <ModalTrigger
      label="Abrir atendimento"
      title="Abrir atendimento"
      description="A ficha abre com o que houver. Sem documento também abre."
    >
      <SelectField
          name="unidade"
        label="Unidade"
        options={unidades.map((unidade) => ({ value: unidade.id, label: unidade.nome }))}
        value={unidadeSaudeId}
        onChange={(evento) => setUnidade(evento.target.value)}
      />
      <BuscaDePaciente escolhido={paciente} aoEscolher={setPaciente} />
      {!paciente ? (
        <Alert tone="info">
          Sem paciente identificado a ficha abre assim mesmo — é o caso de quem
          chega inconsciente ou sem documento. A identificação pode ser
          completada depois, e é exigida antes da saída.
        </Alert>
      ) : null}
      <Button type="button" disabled={ocupado || !unidadeSaudeId} onClick={() => void abrir()}>
        {ocupado ? "Abrindo…" : "Abrir atendimento"}
      </Button>
    </ModalTrigger>
  );
};

/** Amarra o paciente a uma ficha que abriu sem identificação. */
export const IdentifyPatientButton = ({ visitaId }: { visitaId: string }) => {
  const router = useRouter();
  const [paciente, setPaciente] = useState<PatientSummary | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const identificar = async () => {
    if (!paciente) return;
    setOcupado(true);
    const resultado = await identifyPatient(visitaId, paciente.id);
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Paciente identificado");
    router.refresh();
  };

  return (
    <ModalTrigger
      label="Identificar o paciente"
      title="Identificar o paciente"
      description="Só preenche o vazio. Trocar o paciente moveria o registro clínico de uma pessoa para outra."
    >
      <BuscaDePaciente escolhido={paciente} aoEscolher={setPaciente} />
      <Button type="button" disabled={ocupado || !paciente} onClick={() => void identificar()}>
        {ocupado ? "Salvando…" : "Identificar"}
      </Button>
    </ModalTrigger>
  );
};

/**
 * A rasura datada e rubricada do papel.
 *
 * O registro original permanece; a correção entra ao lado, com autor e hora
 * próprios, e a ficha impressa mostra as duas. Vale depois da alta, que é
 * quando o erro costuma ser notado.
 */
export const AmendButton = ({
  visitaId, tabelaOrigem, registroId, rotulo,
}: {
  visitaId: string; tabelaOrigem: string; registroId: string; rotulo: string;
}) => {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const retificar = async () => {
    setOcupado(true);
    const resultado = await amendRecord(visitaId, {
      tabelaOrigem: tabelaOrigem as Parameters<typeof amendRecord>[1]["tabelaOrigem"],
      registroId,
      texto,
    });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Retificação registrada");
    setTexto("");
    router.refresh();
  };

  return (
    <ModalTrigger
      label="Retificar"
      variant="ghost"
      title={`Retificar — ${rotulo}`}
      description="O registro original continua. A correção entra ao lado, com o seu nome e a hora."
    >
      <FieldGrid>
        <TextareaField
          name="correcao"
          label="Correção"
          wide
          rows={4}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
        />
      </FieldGrid>
      <Button type="button" disabled={ocupado || !texto.trim()} onClick={() => void retificar()}>
        {ocupado ? "Salvando…" : "Registrar retificação"}
      </Button>
    </ModalTrigger>
  );
};
