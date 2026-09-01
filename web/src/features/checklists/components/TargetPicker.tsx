"use client";

import { useEffect, useState } from "react";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { lista } from "@/shared/api/colecao";
import { ALVOS, type ChecklistTargetOption } from "../types";

/**
 * A que registro o checklist se prende.
 *
 * Antes o formulário pedia o **UUID colado à mão**, com a dica "Cole o
 * identificador". Nenhum servidor de prefeitura copia um UUID de uma URL —
 * ele conhece o processo pelo número e o contrato pelo fornecedor.
 *
 * A busca só dispara com dois caracteres: uma letra casaria com metade da
 * prefeitura, e uma lista de vinte resultados aleatórios não ajuda ninguém.
 */
export const TargetPicker = ({
  tipo,
  onTipo,
  alvoId,
  onAlvo,
}: {
  tipo: string;
  onTipo: (tipo: string) => void;
  alvoId: string;
  onAlvo: (id: string) => void;
}) => {
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState<ChecklistTargetOption[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  /**
   * Texto curto não busca — e não limpa nada de dentro do efeito.
   *
   * Chamar `setEncontrados([])` na saída do efeito é `setState` síncrono:
   * dispara um render em cascata, e o lint reclama com razão. Quem não pode
   * buscar simplesmente não mostra a lista, logo abaixo.
   */
  const podeBuscar = Boolean(tipo) && busca.trim().length >= 2;
  const opcoes = podeBuscar ? encontrados : [];
  const escolhido = opcoes.find((opcao) => opcao.id === alvoId);

  useEffect(() => {
    if (!podeBuscar) return;

    // Espera o usuário parar de digitar: sem isto, cada tecla vira uma
    // consulta, e a resposta da penúltima chega depois da última.
    const relogio = setTimeout(() => {
      setBuscando(true);
      setFalhou(false);
      fetch(
        `/api/proxy/checklists/alvos?tipo=${tipo}&busca=${encodeURIComponent(busca.trim())}`,
        { cache: "no-store" },
      )
        .then(async (resposta) => {
          if (!resposta.ok) throw new Error(String(resposta.status));
          return resposta.json();
        })
        /**
         * O que chega é dado externo, não o tipo que o genérico promete.
         *
         * Duas respostas fora do array quebravam a tela de formas diferentes e
         * igualmente mudas: um envelope `{ itens: [...] }` deixava
         * `resultado.length` indefinido e o seletor sumia sem uma linha de
         * explicação — para quem estava usando, "o item não seleciona"; e um
         * furo na lista fazia `opcao.id` explodir no `.map`, derrubando o
         * formulário inteiro no meio do render. `lista` fecha os dois.
         */
        .then((corpo) => setEncontrados(
          // Sem id não há vínculo a gravar: a opção existiria só para o
          // usuário escolher e o formulário não guardar nada.
          lista<ChecklistTargetOption>(corpo).filter((opcao) => Boolean(opcao?.id)),
        ))
        .catch(() => {
          setEncontrados([]);
          setFalhou(true);
        })
        .finally(() => setBuscando(false));
    }, 300);

    return () => clearTimeout(relogio);
  }, [tipo, busca, podeBuscar]);

  return (
    <>
      <FieldGrid>
        <SelectField
          label="Referente a"
          name="alvoTipo"
          emptyOption="— lista avulsa —"
          hint="Um processo, contrato, licitação… ou nada."
          options={ALVOS.map((alvo) => ({ value: alvo, label: alvo.toLowerCase() }))}
          value={tipo}
          onChange={(evento) => {
            onTipo(evento.target.value);
            // Trocar o tipo invalida o que estava escolhido: um id de contrato
            // não é um processo.
            onAlvo("");
            setBusca("");
            setEncontrados([]);
            setFalhou(false);
          }}
        />

        {tipo ? (
          <InputField
            label="Procurar"
            name="buscaAlvo"
            placeholder="Número, nome ou CNPJ"
            hint={buscando ? "Procurando…" : "Dois caracteres, no mínimo."}
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        ) : null}
      </FieldGrid>

      {opcoes.length > 0 ? (
        <SelectField
          label="Registro"
          name="alvoId"
          required
          emptyOption="— escolha —"
          hint={escolhido ? `Vinculado a ${escolhido.numero} · ${escolhido.rotulo}` : undefined}
          options={opcoes.map((opcao) => ({
            value: opcao.id,
            label: `${opcao.numero} · ${opcao.rotulo}`,
          }))}
          value={alvoId}
          onChange={(evento) => onAlvo(evento.target.value)}
        />
      ) : null}

      {/* Falhar a busca e não achar nada são coisas diferentes, e dizer a
          segunda quando aconteceu a primeira manda o usuário procurar um
          registro que existe. */}
      {podeBuscar && !buscando && falhou ? (
        <small style={{ color: "var(--perigo)" }}>
          Não foi possível consultar agora. Tente de novo em instantes.
        </small>
      ) : null}

      {podeBuscar && !buscando && !falhou && opcoes.length === 0 ? (
        <small style={{ color: "var(--texto_suave)" }}>
          Nada encontrado com esse texto.
        </small>
      ) : null}
    </>
  );
};
