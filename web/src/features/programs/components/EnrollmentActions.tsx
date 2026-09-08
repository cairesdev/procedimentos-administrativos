"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import {
  changeStatus, createPerson, enroll, findPerson, lookupPeople, updatePerson,
} from "../actions";
import {
  SITUACAO_ROTULO, SITUACOES,
  type EnrolledRecord, type PersonRecord, type Program, type Situation,
} from "../types";

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

      {/*
        A busca vem antes do cadastro, e é de propósito.

        O segundo cadastro da mesma pessoa é o defeito clássico deste tipo de
        tela, e ele estraga justamente o número que o ofício pergunta: a mesma
        criança contada duas vezes na faixa etária. Por isso o formulário só
        aparece depois de procurar e não achar.
      */}
      {semResposta && !procurando ? (
        <>
          <Alert tone="info">
            Ninguém com esse nome no cadastro. Se a pessoa nunca passou pelo
            hospital, cadastre-a aqui — o prontuário nasce agora e vale para
            sempre, inclusive quando ela for atendida no pronto atendimento.
          </Alert>
          <CadastroDePessoa nomeInicial={termo} aoCadastrar={aoEscolher} />
        </>
      ) : null}
    </div>
  );
};

/**
 * O cadastro da pessoa, feito pela coordenação do programa.
 *
 * Boa parte das crianças com TEA nunca passou pelo pronto atendimento, e o
 * cadastro de paciente morava atrás da permissão da recepção do hospital. A
 * coordenação ficava esperando o balcão digitar nome por nome — e a fila que o
 * Ministério Público quer medir não existia no sistema por um detalhe de
 * permissão.
 *
 * É o mesmo cadastro do balcão, com as mesmas regras: só o nome é obrigatório,
 * os documentos são conferidos no servidor, e a pessoa que já tem prontuário é
 * devolvida em vez de duplicada. Cadastrar **não** abre ficha e não dá acesso a
 * prontuário nenhum.
 */
const CadastroDePessoa = ({
  nomeInicial, aoCadastrar,
}: {
  nomeInicial: string;
  aoCadastrar: (pessoa: Pessoa) => void;
}) => {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(nomeInicial);
  const [nomeMae, setNomeMae] = useState("");
  const [dataNascimento, setNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [cns, setCns] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (!aberto) {
    return (
      <Button type="button" variant="secondary" onClick={() => setAberto(true)}>
        Cadastrar {nomeInicial.trim() ? `"${nomeInicial.trim()}"` : "uma pessoa nova"}
      </Button>
    );
  }

  const cadastrar = async () => {
    setOcupado(true);
    const resultado = await createPerson({
      nome, nomeMae, dataNascimento, sexo: sexo as "M" | "F" | "I" | "", cns, cpf, telefone,
    });
    setOcupado(false);

    if ("error" in resultado) {
      toast.error(resultado.error);
      return;
    }

    // O aviso é o do cadastro repetido: a pessoa já existia, e o que a tela
    // faz é aproveitá-la. Dizer isso importa — a coordenação precisa saber que
    // não criou ninguém.
    if (resultado.aviso) toast.info(resultado.aviso);
    else toast.success("Pessoa cadastrada");

    aoCadastrar({
      ...resultado.pessoa,
      dataNascimento: dataNascimento || null,
    });
  };

  return (
    <div style={{ marginTop: "12px" }}>
      <FieldGrid>
        <InputField
          name="nome-da-pessoa"
          label="Nome completo"
          wide
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <InputField
          name="nome-da-mae"
          label="Nome da mãe"
          wide
          hint="Ajuda a não criar duas fichas para a mesma criança."
          value={nomeMae}
          onChange={(evento) => setNomeMae(evento.target.value)}
        />
        <InputField
          name="nascimento"
          label="Data de nascimento"
          type="date"
          hint="Sem ela a pessoa cai na linha “sem data de nascimento” do relatório."
          value={dataNascimento}
          onChange={(evento) => setNascimento(evento.target.value)}
        />
        <SelectField
          name="sexo"
          label="Sexo"
          options={[
            { value: "", label: "Não informado" },
            { value: "F", label: "Feminino" },
            { value: "M", label: "Masculino" },
            { value: "I", label: "Ignorado" },
          ]}
          value={sexo}
          onChange={(evento) => setSexo(evento.target.value)}
        />
        <InputField
          name="cartao-do-sus"
          label="Cartão do SUS"
          value={cns}
          onChange={(evento) => setCns(evento.target.value)}
        />
        <InputField
          name="cpf"
          label="CPF"
          value={cpf}
          onChange={(evento) => setCpf(evento.target.value)}
        />
        <InputField
          name="telefone-da-familia"
          label="Telefone da família"
          value={telefone}
          onChange={(evento) => setTelefone(evento.target.value)}
        />
      </FieldGrid>

      <Button type="button" disabled={ocupado || !nome.trim()} onClick={() => void cadastrar()}>
        {ocupado ? "Cadastrando…" : "Cadastrar e usar esta pessoa"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
        Cancelar
      </Button>
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

/**
 * Completar o cadastro — quase sempre a data de nascimento que faltou.
 *
 * Quem cadastra em mutirão preenche nome e telefone e deixa o nascimento para
 * depois. Sem ele a pessoa cai na linha "sem data de nascimento" do relatório,
 * e quem vai corrigi-la é a coordenação, não o balcão do hospital — que nunca
 * viu essa família.
 *
 * O formulário **carrega o que já existe** antes de salvar: o `PUT` grava a
 * pessoa inteira, e mandar só o campo corrigido apagaria o CPF que alguém
 * digitou no mês passado.
 */
export const CompletePersonButton = ({
  pacienteId, nome,
}: {
  pacienteId: string; nome: string;
}) => {
  const router = useRouter();
  const [cadastro, setCadastro] = useState<PersonRecord | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void findPerson(pacienteId)
      .then(setCadastro)
      .catch(() => setErro("Não foi possível carregar o cadastro desta pessoa."));
  }, [pacienteId]);

  const campo = (chave: keyof PersonRecord) => String(cadastro?.[chave] ?? "");

  const trocar = (chave: keyof PersonRecord, valor: string) =>
    setCadastro((atual) => (atual ? { ...atual, [chave]: valor } : atual));

  const salvar = async () => {
    if (!cadastro) return;
    setOcupado(true);
    const resultado = await updatePerson(pacienteId, {
      nome: cadastro.nome,
      nomeMae: cadastro.nomeMae ?? "",
      dataNascimento: cadastro.dataNascimento ?? "",
      sexo: (cadastro.sexo ?? "") as "M" | "F" | "I" | "",
      cns: cadastro.cns ?? "",
      cpf: cadastro.cpf ?? "",
      telefone: cadastro.telefone ?? "",
      // Os campos que esta tela não mostra viajam de volta como vieram: o
      // `PUT` grava a pessoa inteira, e omiti-los apagaria o cadastro do
      // balcão.
      nis: cadastro.nis ?? "",
      cnh: cadastro.cnh ?? "",
      rg: cadastro.rg ?? "",
      endereco: cadastro.endereco ?? "",
      cidade: cadastro.cidade ?? "",
      uf: cadastro.uf ?? "",
      email: cadastro.email ?? "",
    });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Cadastro atualizado");
    router.refresh();
  };

  return (
    <ModalTrigger
      label="Completar cadastro"
      variant="ghost"
      title={`Cadastro — ${nome}`}
      description="Os dados da pessoa. Condição clínica e prontuário não estão aqui."
    >
      {erro ? <Alert tone="error">{erro}</Alert> : null}
      {!cadastro && !erro ? <small>Carregando…</small> : null}

      {cadastro ? (
        <>
          <FieldGrid>
            <InputField
              name="nome-completo"
              label="Nome completo"
              wide
              value={campo("nome")}
              onChange={(evento) => trocar("nome", evento.target.value)}
            />
            <InputField
              name="nome-da-mae-cadastro"
              label="Nome da mãe"
              wide
              value={campo("nomeMae")}
              onChange={(evento) => trocar("nomeMae", evento.target.value)}
            />
            <InputField
              name="nascimento-cadastro"
              label="Data de nascimento"
              type="date"
              hint="É ela que coloca a pessoa na faixa etária do relatório."
              value={campo("dataNascimento")}
              onChange={(evento) => trocar("dataNascimento", evento.target.value)}
            />
            <SelectField
              name="sexo-cadastro"
              label="Sexo"
              options={[
                { value: "", label: "Não informado" },
                { value: "F", label: "Feminino" },
                { value: "M", label: "Masculino" },
                { value: "I", label: "Ignorado" },
              ]}
              value={campo("sexo")}
              onChange={(evento) => trocar("sexo", evento.target.value)}
            />
            <InputField
              name="cartao-do-sus-cadastro"
              label="Cartão do SUS"
              value={campo("cns")}
              onChange={(evento) => trocar("cns", evento.target.value)}
            />
            <InputField
              name="cpf-cadastro"
              label="CPF"
              value={campo("cpf")}
              onChange={(evento) => trocar("cpf", evento.target.value)}
            />
            <InputField
              name="telefone-cadastro"
              label="Telefone da família"
              value={campo("telefone")}
              onChange={(evento) => trocar("telefone", evento.target.value)}
            />
          </FieldGrid>

          <Button
            type="button"
            disabled={ocupado || !cadastro.nome.trim()}
            onClick={() => void salvar()}
          >
            {ocupado ? "Salvando…" : "Salvar cadastro"}
          </Button>
        </>
      ) : null}
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
