"use client";

import { useEffect, useState } from "react";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
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
  const [opcoes, setOpcoes] = useState<ChecklistTargetOption[]>([]);
  const [buscando, setBuscando] = useState(false);

  /**
   * Texto curto não busca — e não limpa nada de dentro do efeito.
   *
   * Chamar `setOpcoes([])` na saída do efeito é `setState` síncrono: dispara
   * um render em cascata, e o lint reclama com razão. A lista vazia é
   * **derivada** da condição, logo abaixo.
   */
  const podeBuscar = Boolean(tipo) && busca.trim().length >= 2;
  const encontrados = podeBuscar ? opcoes : [];

  useEffect(() => {
    if (!podeBuscar) return;

    // Espera o usuário parar de digitar: sem isto, cada tecla vira uma
    // consulta, e a resposta da penúltima chega depois da última.
    const relogio = setTimeout(() => {
      setBuscando(true);
      fetch(
        `/api/proxy/checklists/alvos?tipo=${tipo}&busca=${encodeURIComponent(busca.trim())}`,
        { cache: "no-store" },
      )
        .then((resposta) => (resposta.ok ? resposta.json() : []))
        .then(setOpcoes)
        .catch(() => setOpcoes([]))
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

      {encontrados.length > 0 ? (
        <SelectField
          label="Registro"
          name="alvoId"
          required
          emptyOption="— escolha —"
          options={encontrados.map((opcao) => ({
            value: opcao.id,
            label: `${opcao.numero} · ${opcao.rotulo}`,
          }))}
          value={alvoId}
          onChange={(evento) => onAlvo(evento.target.value)}
        />
      ) : null}

      {podeBuscar && !buscando && encontrados.length === 0 ? (
        <small style={{ color: "var(--texto_suave)" }}>
          Nada encontrado com esse texto.
        </small>
      ) : null}
    </>
  );
};
