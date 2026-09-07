"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InputField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { lookupCnesEstablishments, lookupCnesMunicipalities, saveHealthUnit } from "../actions";
import type { CnesEstablishment, CnesMunicipality, HealthUnit } from "../types";

/**
 * O cadastro da unidade — hospital, UBS, posto.
 *
 * É o único lugar do sistema que fala com o Ministério da Saúde, e é uma tela
 * de cadastro, feita uma vez por unidade. Nenhum atendimento espera por rede
 * externa: se a API do CNES não responder, tudo é digitado e o cadastro
 * funciona igual.
 *
 * **O fluxo é município → lista → escolhe, e não "digite o nome do hospital".**
 * A API aberta não busca estabelecimento por nome — só por município. A
 * limitação é do serviço, e desenhar a tela contra ela é mais honesto que
 * fingir uma busca que filtraria no cliente.
 */
export const HealthUnitForm = ({ unidade }: { unidade?: HealthUnit }) => {
  const router = useRouter();
  const [nome, setNome] = useState(unidade?.nome ?? "");
  const [codigoCnes, setCnes] = useState(unidade?.codigoCnes ?? "");
  const [tipoUnidade, setTipo] = useState(String(unidade?.tipoUnidade ?? ""));
  const [endereco, setEndereco] = useState(unidade?.endereco ?? "");
  const [telefone, setTelefone] = useState(unidade?.telefone ?? "");
  const [ocupado, setOcupado] = useState(false);

  const [municipio, setMunicipio] = useState("");
  const [municipios, setMunicipios] = useState<CnesMunicipality[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<CnesEstablishment[]>([]);
  const [consultando, setConsultando] = useState(false);
  const [semResposta, setSemResposta] = useState(false);

  const procurarMunicipio = async (valor: string) => {
    setMunicipio(valor);
    setEstabelecimentos([]);
    if (valor.trim().length < 3) {
      setMunicipios([]);
      return;
    }
    setConsultando(true);
    const achados = await lookupCnesMunicipalities(valor);
    setConsultando(false);
    setMunicipios(achados);
    setSemResposta(achados.length === 0);
  };

  const listarEstabelecimentos = async (codigo: string) => {
    setConsultando(true);
    const achados = await lookupCnesEstablishments(codigo);
    setConsultando(false);
    setEstabelecimentos(achados);
    setSemResposta(achados.length === 0);
  };

  const usar = (estabelecimento: CnesEstablishment) => {
    setNome(estabelecimento.nome);
    setCnes(estabelecimento.codigoCnes);
    setTipo(String(estabelecimento.tipoUnidade ?? ""));
    setEndereco(estabelecimento.endereco ?? "");
    setTelefone(estabelecimento.telefone ?? "");
    setEstabelecimentos([]);
    setMunicipios([]);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setOcupado(true);
    const resultado = await saveHealthUnit(
      { nome, codigoCnes, tipoUnidade, endereco, telefone },
      unidade?.id,
    );
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Unidade salva");
    router.refresh();
  };

  return (
    <form onSubmit={(evento) => void salvar(evento)}>
      <FieldGrid>
        <InputField
          name="procurar-no-cnes-pelo-municipio"
          label="Procurar no CNES pelo município"
          wide
          hint="O cadastro nacional não busca por nome do estabelecimento — só por município."
          value={municipio}
          onChange={(evento) => void procurarMunicipio(evento.target.value)}
        />
      </FieldGrid>

      {consultando ? <small>Consultando o cadastro nacional…</small> : null}

      {/*
        Serviço do Ministério fora do ar não pode travar o cadastro. A tela diz
        o que houve e o formulário abaixo continua funcionando digitado.
      */}
      {semResposta && !consultando ? (
        <Alert tone="info">
          Não veio resposta do cadastro nacional. Pode ser o município escrito de
          outro jeito, ou o serviço do Ministério fora do ar — preencha os campos
          à mão que funciona igual.
        </Alert>
      ) : null}

      {municipios.map((cidade) => (
        <Button
          key={cidade.codigo}
          type="button"
          variant="ghost"
          onClick={() => void listarEstabelecimentos(cidade.codigo)}
        >
          {cidade.nome} — {cidade.uf}
        </Button>
      ))}

      {estabelecimentos.map((estabelecimento) => (
        <Button
          key={estabelecimento.codigoCnes}
          type="button"
          variant="ghost"
          onClick={() => usar(estabelecimento)}
        >
          {estabelecimento.nome} — CNES {estabelecimento.codigoCnes}
          {estabelecimento.tipoUnidadeDescricao
            ? ` (${estabelecimento.tipoUnidadeDescricao.toLowerCase()})`
            : ""}
        </Button>
      ))}

      <FieldGrid>
        <InputField
          name="nome-da-unidade"
          label="Nome da unidade"
          wide
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <InputField
          name="codigo-cnes"
          label="Código CNES"
          hint="Sete dígitos."
          value={codigoCnes}
          onChange={(evento) => setCnes(evento.target.value)}
        />
        <InputField
          name="tipo-de-unidade-codigo-cnes"
          label="Tipo de unidade (código CNES)"
          value={tipoUnidade}
          onChange={(evento) => setTipo(evento.target.value)}
        />
        <InputField
          name="endereco"
          label="Endereço"
          wide
          value={endereco}
          onChange={(evento) => setEndereco(evento.target.value)}
        />
        <InputField
          name="telefone"
          label="Telefone"
          value={telefone}
          onChange={(evento) => setTelefone(evento.target.value)}
        />
      </FieldGrid>

      <Button type="submit" disabled={ocupado || !nome.trim()}>
        {ocupado ? "Salvando…" : unidade ? "Salvar unidade" : "Cadastrar unidade"}
      </Button>
    </form>
  );
};
