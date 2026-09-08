"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { changeStatus, enroll, lookupPeople } from "../actions";
import { SITUACAO_ROTULO, SITUACOES, type EnrolledRecord, type Program, type Situation } from "../types";

type Pessoa = { id: string; prontuario: number; nome: string; dataNascimento: string | null };

const OPCOES_SITUACAO = SITUACOES.map((situacao) => ({
  value: situacao,
  label: SITUACAO_ROTULO[situacao],
}));

/**
 * Procurar a pessoa sem sair do formulário.
 *
 * A busca devolve nome, prontuário e nascimento — e nada mais. A coordenação
 * do programa não lê prontuário, e o índice de nomes que ela alcança para
 * inscrever alguém não pode ser a porta dos fundos dele.
 */
const BuscaDePessoa = ({
  escolhida, aoEscolher,
}: {
  escolhida: Pessoa | null;
  aoEscolher: (pessoa: Pessoa | null) => void;
}) => {
  const [termo, setTermo] = useState("");
  const [achadas, setAchadas] = useState<Pessoa[]>([]);
  const [procurando, setProcurando] = useState(false);
  const [semResposta, setSemResposta] = useState(false);

  const procurar = async (valor: string) => {
    setTermo(valor);
    setSemResposta(false);
    if (valor.trim().length < 2) {
      setAchadas([]);
      return;
    }
    setProcurando(true);
    const resultado = await lookupPeople(valor);
    setProcurando(false);
    setAchadas(resultado);
    setSemResposta(resultado.length === 0);
  };

  if (escolhida) {
    return (
      <div style={{ margin: "0 0 16px" }}>
        <p style={{ margin: 0 }}>
          <strong>{escolhida.nome}</strong>{" "}
          <small style={{ color: "var(--texto_suave)" }}>
            prontuário {escolhida.prontuario}
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
        name="pessoa"
        label="Pessoa"
        wide
        hint="Nome, prontuário, CPF ou cartão do SUS."
        value={termo}
        onChange={(evento) => void procurar(evento.target.value)}
      />
      {procurando ? <small>Procurando…</small> : null}
      {/*
        Quem cadastra pessoa é a recepção do hospital, com outra permissão e
        noutra tela. Sem este aviso, a coordenação buscaria três vezes o mesmo
        nome antes de descobrir que o cadastro simplesmente não existe.
      */}
      {semResposta && !procurando ? (
        <Alert tone="info">
          Ninguém com esse nome no cadastro. Quem registra uma pessoa nova é a
          recepção do hospital, em Atendimentos → Pacientes; depois ela aparece
          aqui para ser inscrita.
        </Alert>
      ) : null}
      {achadas.map((pessoa) => (
        <Button
          key={pessoa.id}
          type="button"
          variant="ghost"
          onClick={() => aoEscolher(pessoa)}
        >
          {pessoa.nome} — prontuário {pessoa.prontuario}
        </Button>
      ))}
    </div>
  );
};

/**
 * Inscrever alguém no programa.
 *
 * A situação começa em "em investigação" porque é o que acontece na vida: a
 * criança entra na fila da avaliação antes de existir laudo. Contar essa
 * pessoa como diagnosticada inflaria a resposta ao Ministério Público; deixá-la
 * de fora esconderia a fila que ela está ocupando.
 */
export const EnrollButton = ({ programas }: { programas: Program[] }) => {
  const router = useRouter();
  const [programaId, setPrograma] = useState(programas[0]?.id ?? "");
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [situacao, setSituacao] = useState<Situation>("EM_INVESTIGACAO");
  const [inscritoEm, setInscritoEm] = useState("");
  const [diagnosticoEm, setDiagnostico] = useState("");
  const [cid, setCid] = useState("");
  const [observacao, setObservacao] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const inscrever = async () => {
    if (!pessoa) return;
    setOcupado(true);
    const resultado = await enroll({
      programaId,
      pacienteId: pessoa.id,
      situacao,
      inscritoEm,
      diagnosticoEm,
      cid,
      observacao,
    });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Pessoa inscrita");
    router.refresh();
    if (resultado.id) router.push(`/saude/programas/inscritos/${resultado.id}`);
  };

  return (
    <ModalTrigger
      label="Inscrever"
      title="Inscrever no programa"
      description="A inscrição não espera laudo: quem está em investigação também ocupa fila."
    >
      <FieldGrid>
        <SelectField
          name="programa"
          label="Programa"
          wide
          options={programas.map((programa) => ({ value: programa.id, label: programa.nome }))}
          value={programaId}
          onChange={(evento) => setPrograma(evento.target.value)}
        />
      </FieldGrid>

      <BuscaDePessoa escolhida={pessoa} aoEscolher={setPessoa} />

      <FieldGrid>
        <SelectField
          name="situacao"
          label="Situação"
          options={OPCOES_SITUACAO}
          value={situacao}
          onChange={(evento) => setSituacao(evento.target.value as Situation)}
        />
        <InputField
          name="inscrito-em"
          label="Inscrito em"
          type="date"
          hint="Em branco é hoje."
          value={inscritoEm}
          onChange={(evento) => setInscritoEm(evento.target.value)}
        />
        <InputField
          name="diagnostico-em"
          label="Diagnóstico em"
          type="date"
          value={diagnosticoEm}
          onChange={(evento) => setDiagnostico(evento.target.value)}
        />
        <InputField
          name="cid"
          label="CID"
          hint="Código, não o diagnóstico por extenso."
          value={cid}
          onChange={(evento) => setCid(evento.target.value)}
        />
        <TextareaField
          name="observacao"
          label="Observação"
          wide
          rows={3}
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />
      </FieldGrid>

      <Button
        type="button"
        disabled={ocupado || !pessoa || !programaId}
        onClick={() => void inscrever()}
      >
        {ocupado ? "Inscrevendo…" : "Inscrever"}
      </Button>
    </ModalTrigger>
  );
};

/** Muda a situação — inclusive para alta, transferência ou abandono. */
export const ChangeStatusButton = ({ inscricao }: { inscricao: EnrolledRecord["inscricao"] }) => {
  const router = useRouter();
  const [situacao, setSituacao] = useState<Situation>(inscricao.situacao);
  const [diagnosticoEm, setDiagnostico] = useState(inscricao.diagnosticoEm ?? "");
  const [cid, setCid] = useState(inscricao.cid ?? "");
  const [observacao, setObservacao] = useState(inscricao.observacao ?? "");
  const [encerradoEm, setEncerrado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const encerra = situacao === "ALTA" || situacao === "TRANSFERIDO" || situacao === "ABANDONO";

  const salvar = async () => {
    setOcupado(true);
    const resultado = await changeStatus(inscricao.id, {
      situacao, diagnosticoEm, cid, observacao, encerradoEm,
    });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Situação atualizada");
    router.refresh();
  };

  return (
    <ModalTrigger
      label="Mudar situação"
      variant="secondary"
      title="Situação no programa"
      description="Quem sai continua na lista, com a data e o motivo — a saída também é resposta."
    >
      <FieldGrid>
        <SelectField
          name="situacao"
          label="Situação"
          options={OPCOES_SITUACAO}
          value={situacao}
          onChange={(evento) => setSituacao(evento.target.value as Situation)}
        />
        <InputField
          name="diagnostico-em"
          label="Diagnóstico em"
          type="date"
          value={diagnosticoEm}
          onChange={(evento) => setDiagnostico(evento.target.value)}
        />
        <InputField
          name="cid"
          label="CID"
          value={cid}
          onChange={(evento) => setCid(evento.target.value)}
        />
        {encerra ? (
          <InputField
            name="encerrado-em"
            label="Encerrado em"
            type="date"
            hint="Em branco é hoje."
            value={encerradoEm}
            onChange={(evento) => setEncerrado(evento.target.value)}
          />
        ) : null}
        <TextareaField
          name="observacao"
          label="Observação"
          wide
          rows={3}
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />
      </FieldGrid>

      <Button type="button" disabled={ocupado} onClick={() => void salvar()}>
        {ocupado ? "Salvando…" : "Salvar situação"}
      </Button>
    </ModalTrigger>
  );
};
