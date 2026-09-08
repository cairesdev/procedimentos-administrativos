"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { addTeamMember, endTeamMember, lookupProfessionals } from "../actions";
import { VINCULO_ROTULO, VINCULOS, type BondType, type Therapy } from "../types";

type Profissional = { id: string; nome: string; papelBase: string; conselho: string | null };

const hoje = () => new Date().toISOString().slice(0, 10);

const OPCOES_VINCULO = VINCULOS.map((vinculo) => ({
  value: vinculo,
  label: VINCULO_ROTULO[vinculo],
}));

/**
 * O item 3 do ofício, preenchido uma pessoa por vez.
 *
 * "Carga horária, local de atuação e vinculação funcional, esclarecendo se
 * atuam exclusivamente ou parcialmente" — as duas horas são campos separados
 * de propósito. Guardar só "exclusivo: sim/não" faria o sistema responder a
 * pergunta de hoje e nenhuma outra; com as duas horas, a exclusividade é
 * conta, e a conta continua certa quando o contrato mudar.
 */
export const AddTeamMemberButton = ({
  programaId, terapias, unidades,
}: {
  programaId: string;
  terapias: Therapy[];
  unidades: { id: string; nome: string }[];
}) => {
  const router = useRouter();
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [usuarioId, setUsuario] = useState("");
  const [terapiaId, setTerapia] = useState("");
  const [cargaHorariaSemanal, setCarga] = useState("");
  const [horasNoPrograma, setHoras] = useState("");
  const [unidadeSaudeId, setUnidade] = useState("");
  const [tipoVinculo, setVinculo] = useState<BondType>("EFETIVO");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void lookupProfessionals().then((achados) => {
      setProfissionais(achados);
      setUsuario((atual) => atual || (achados[0]?.id ?? ""));
    });
  }, []);

  const adicionar = async () => {
    setOcupado(true);
    const resultado = await addTeamMember(programaId, {
      usuarioId, terapiaId, cargaHorariaSemanal, horasNoPrograma,
      unidadeSaudeId, tipoVinculo,
    });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Profissional na equipe");
    router.refresh();
  };

  const excedeu =
    Number(horasNoPrograma.replace(",", ".")) > Number(cargaHorariaSemanal.replace(",", "."));

  return (
    <ModalTrigger
      label="Adicionar profissional"
      title="Profissional no programa"
      description="Carga horária, local e vínculo — as três coisas que a requisição pergunta."
    >
      {profissionais.length === 0 ? (
        <Alert tone="info">
          Nenhum profissional de saúde cadastrado ainda. Quem cria os usuários é
          o administrador, em Administração → Usuários, escolhendo um dos papéis
          da saúde.
        </Alert>
      ) : null}

      <FieldGrid>
        <SelectField
          name="profissional"
          label="Profissional"
          wide
          options={profissionais.map((pessoa) => ({
            value: pessoa.id,
            label: pessoa.conselho ? `${pessoa.nome} — ${pessoa.conselho}` : pessoa.nome,
          }))}
          value={usuarioId}
          onChange={(evento) => setUsuario(evento.target.value)}
        />
        <SelectField
          name="terapia"
          label="Terapia"
          hint="Em branco para quem atua no programa sem terapia própria — a coordenação, por exemplo."
          options={[
            { value: "", label: "Sem terapia específica" },
            ...terapias.map((terapia) => ({ value: terapia.id, label: terapia.nome })),
          ]}
          value={terapiaId}
          onChange={(evento) => setTerapia(evento.target.value)}
        />
        <SelectField
          name="unidade"
          label="Local de atuação"
          options={[
            { value: "", label: "Não informado" },
            ...unidades.map((unidade) => ({ value: unidade.id, label: unidade.nome })),
          ]}
          value={unidadeSaudeId}
          onChange={(evento) => setUnidade(evento.target.value)}
        />
        <SelectField
          name="vinculo"
          label="Vínculo funcional"
          options={OPCOES_VINCULO}
          value={tipoVinculo}
          onChange={(evento) => setVinculo(evento.target.value as BondType)}
        />
        <InputField
          name="carga-horaria"
          label="Carga horária semanal"
          type="number"
          step="1"
          min="1"
          hint="A do contrato, somando tudo que a pessoa faz na prefeitura."
          value={cargaHorariaSemanal}
          onChange={(evento) => setCarga(evento.target.value)}
        />
        <InputField
          name="horas-no-programa"
          label="Horas neste programa"
          type="number"
          step="1"
          min="1"
          hint="Igual à carga horária significa dedicação exclusiva ao programa."
          value={horasNoPrograma}
          onChange={(evento) => setHoras(evento.target.value)}
        />
      </FieldGrid>

      {excedeu ? (
        <Alert tone="error">
          As horas no programa não podem passar da carga horária contratada.
        </Alert>
      ) : null}

      <Button
        type="button"
        disabled={ocupado || !usuarioId || !cargaHorariaSemanal || !horasNoPrograma || excedeu}
        onClick={() => void adicionar()}
      >
        {ocupado ? "Salvando…" : "Adicionar à equipe"}
      </Button>
    </ModalTrigger>
  );
};

/** Encerra o vínculo. O histórico fica: o profissional atendeu no período. */
export const EndTeamMemberButton = ({ membroId, nome }: { membroId: string; nome: string }) => {
  const router = useRouter();
  const [em, setEm] = useState(hoje());
  const [ocupado, setOcupado] = useState(false);

  const encerrar = async () => {
    setOcupado(true);
    const resultado = await endTeamMember(membroId, em);
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Vínculo encerrado");
    router.refresh();
  };

  return (
    <ModalTrigger
      label="Encerrar"
      variant="ghost"
      title={`Encerrar vínculo — ${nome}`}
      description="A pessoa sai da equipe de hoje em diante e continua no histórico do período."
    >
      <FieldGrid>
        <InputField
          name="encerrado-em"
          label="Encerrado em"
          type="date"
          value={em}
          onChange={(evento) => setEm(evento.target.value)}
        />
      </FieldGrid>
      <Button type="button" disabled={ocupado || !em} onClick={() => void encerrar()}>
        {ocupado ? "Salvando…" : "Encerrar vínculo"}
      </Button>
    </ModalTrigger>
  );
};
