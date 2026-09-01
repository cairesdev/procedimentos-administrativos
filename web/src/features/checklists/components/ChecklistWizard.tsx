"use client";

import { useState } from "react";
import { Link2, ListChecks, Plus, Trash2 } from "lucide-react";
import styles from "./Checklist.module.css";
import { Button } from "@/shared/ui/button";
import { ChoiceCards } from "@/shared/ui/ChoiceCards";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, FieldGrid, Steps, SummaryGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createChecklist } from "../actions";
import { checklistSchema, type ChecklistInput } from "../schemas";
import { TargetPicker } from "./TargetPicker";
import type { ChecklistTemplate } from "../types";

const ITEM_VAZIO = {
  titulo: "",
  descricao: "",
  exigeAnexo: false,
  recorrente: false,
  periodicidadeDias: null as number | null,
  prazoLimite: "",
  responsavel: "",
};

const PASSOS = ["Vínculo", "Conteúdo", "Revisão"];

type Vinculo = "REGISTRO" | "AVULSO";

/**
 * Criar um checklist, em passos.
 *
 * Antes era um formulário só, e a primeira coisa que ele mostrava era um campo
 * "Referente a" com sete tipos — quem ia criar uma lista avulsa precisava
 * entender e descartar aquilo, e quem ia prender a lista a um processo tinha o
 * seletor espremido entre título e itens.
 *
 * A pergunta que de fato bifurca o trabalho é uma só: **isto acompanha um
 * registro, ou não?** Feita primeiro e sozinha, ela dá espaço para o segundo
 * passo ser só a busca do processo — que é onde o servidor gasta o tempo dele.
 *
 * Quando o checklist nasce de dentro de um registro, o alvo já vem resolvido e
 * o assistente começa no segundo passo: perguntar o vínculo do que já está
 * vinculado seria burocracia.
 */
export const ChecklistWizard = ({
  modelos,
  setores,
  alvo,
}: {
  modelos: ChecklistTemplate[];
  setores: { id: string; nome: string }[];
  /** Quando a tela já sabe a que o checklist se prende — o card do processo. */
  alvo?: { tipo: string; id: string };
}) => {
  const closeModal = useModalClose();
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [passo, setPasso] = useState(alvo ? 1 : 0);
  const [vinculo, setVinculo] = useState<Vinculo | "">(alvo ? "REGISTRO" : "");
  const [erroDoPasso, setErroDoPasso] = useState("");

  const { form, onSubmit, isSubmitting } = useResourceForm<ChecklistInput>({
    schema: checklistSchema,
    defaultValues: {
      titulo: "",
      descricao: "",
      modeloId: "",
      alvoTipo: alvo?.tipo as ChecklistInput["alvoTipo"],
      alvoId: alvo?.id ?? "",
      responsavel: "",
    },
    action: (values) => createChecklist({
      ...values,
      // Sem vínculo é sem vínculo: o que ficou digitado numa escolha desfeita
      // não pode viajar junto.
      ...(vinculo === "AVULSO" ? { alvoTipo: undefined, alvoId: "" } : {}),
      // Com modelo, os itens vêm de lá; sem ele, do formulário.
      itens: values.modeloId ? undefined : itens,
    }),
    onDone: closeModal,
  });

  const { errors } = form.formState;
  const modeloEscolhido = form.watch("modeloId");
  const alvoTipo = form.watch("alvoTipo") ?? "";
  const alvoId = form.watch("alvoId") ?? "";
  const titulo = form.watch("titulo") ?? "";

  const destinos = [
    ...setores.map((setor) => ({ value: `setor:${setor.id}`, label: `Setor · ${setor.nome}` })),
    { value: "fornecedor", label: "Fornecedor (externo)" },
  ];

  const mudarItem = (indice: number, campo: string, valor: unknown) => {
    setItens((atuais) => atuais.map((item, i) =>
      i === indice ? { ...item, [campo]: valor } : item));
  };

  const preenchidos = itens.filter((item) => item.titulo.trim());
  const modelo = modelos.find((item) => item.id === modeloEscolhido);

  /**
   * O que falta para sair deste passo.
   *
   * Devolver a frase, e não um booleano, é o que permite dizer **por que** o
   * botão não avança. Um "Próximo" desabilitado sem explicação é o mesmo
   * beco sem saída do botão que não fazia nada.
   */
  const pendenciaDoPasso = (): string => {
    if (passo === 0) {
      if (!vinculo) return "Escolha se o checklist acompanha um registro ou é avulso.";
      if (vinculo === "REGISTRO" && !alvoId) return "Encontre e escolha o registro.";
      return "";
    }

    if (passo === 1) {
      if (!modeloEscolhido && !titulo.trim()) {
        return "Dê um título ao checklist, ou escolha um modelo.";
      }
      if (!modeloEscolhido && preenchidos.length === 0) {
        return "Escreva ao menos um item, ou escolha um modelo.";
      }
      const semPeriodicidade = itens.findIndex(
        (item) => item.recorrente && !item.periodicidadeDias,
      );
      if (!modeloEscolhido && semPeriodicidade >= 0) {
        return `O item ${semPeriodicidade + 1} vence, mas não diz de quantos em quantos dias.`;
      }
    }
    return "";
  };

  const avancar = () => {
    const pendencia = pendenciaDoPasso();
    setErroDoPasso(pendencia);
    if (!pendencia) setPasso((atual) => atual + 1);
  };

  const voltar = () => {
    setErroDoPasso("");
    setPasso((atual) => Math.max(alvo ? 1 : 0, atual - 1));
  };

  return (
    <form onSubmit={onSubmit} className={styles.formulario}>
      <Steps steps={alvo ? PASSOS.slice(1) : PASSOS} current={alvo ? passo - 1 : passo} />

      {erroDoPasso ? <Alert tone="error">{erroDoPasso}</Alert> : null}

      {/* ---- 1. Vínculo -------------------------------------------------- */}
      {passo === 0 ? (
        <>
          <ChoiceCards<Vinculo>
            legenda="A que este checklist se refere"
            valor={vinculo}
            onEscolher={(escolhido) => {
              setVinculo(escolhido);
              setErroDoPasso("");
              if (escolhido === "AVULSO") {
                form.setValue("alvoTipo", undefined);
                form.setValue("alvoId", "");
              }
            }}
            escolhas={[
              {
                valor: "REGISTRO",
                titulo: "Acompanha um registro",
                dica: "Processo, contrato, licitação, fornecedor…",
                icone: <Link2 size={18} aria-hidden="true" />,
              },
              {
                valor: "AVULSO",
                titulo: "Lista avulsa",
                dica: "Tarefas que não pertencem a um processo",
                icone: <ListChecks size={18} aria-hidden="true" />,
              },
            ]}
          />

          {vinculo === "REGISTRO" ? (
            <TargetPicker
              tipo={alvoTipo}
              onTipo={(tipo) => form.setValue(
                "alvoTipo", (tipo || undefined) as ChecklistInput["alvoTipo"],
              )}
              alvoId={alvoId}
              onAlvo={(id) => {
                form.setValue("alvoId", id);
                if (id) setErroDoPasso("");
              }}
            />
          ) : null}

          {vinculo === "AVULSO" ? (
            <Alert tone="info">
              A lista vai existir por si. Dá para prendê-la a um registro depois, editando o
              checklist.
            </Alert>
          ) : null}
        </>
      ) : null}

      {/* ---- 2. Conteúdo ------------------------------------------------- */}
      {passo === 1 ? (
        <>
          {modelos.length > 0 ? (
            <SelectField
              label="Modelo"
              emptyOption="— escrever na hora —"
              hint="Os itens do modelo são copiados. Mudar o modelo depois não mexe nesta lista."
              options={modelos.map((item) => ({ value: item.id, label: item.nome }))}
              {...form.register("modeloId")}
            />
          ) : null}

          <InputField
            label="Título"
            required={!modeloEscolhido}
            placeholder="Habilitação do fornecedor"
            hint={modeloEscolhido ? "Em branco: usa o nome do modelo." : undefined}
            error={errors.titulo?.message}
            {...form.register("titulo")}
          />

          <SelectField
            label="Responsável geral"
            emptyOption="— sem responsável —"
            options={destinos.filter((destino) => destino.value !== "fornecedor")}
            {...form.register("responsavel")}
          />

          {modeloEscolhido ? (
            <Alert tone="info">
              Os itens virão do modelo escolhido, com os prazos contados a partir de hoje.
            </Alert>
          ) : (
            <div className={styles.lista}>
              <strong className={styles.secao_titulo}>Itens</strong>

              {itens.map((item, indice) => (
                <div key={indice} className={styles.item}>
                  <InputField
                    label={`Item ${indice + 1}`}
                    name={`item-${indice}`}
                    required
                    placeholder="Certidão negativa de débitos"
                    value={item.titulo}
                    onChange={(evento) => mudarItem(indice, "titulo", evento.target.value)}
                  />

                  <FieldGrid>
                    <SelectField
                      label="Quem cumpre"
                      name={`responsavel-${indice}`}
                      emptyOption="— definir depois —"
                      options={destinos}
                      value={item.responsavel}
                      onChange={(evento) => mudarItem(indice, "responsavel", evento.target.value)}
                    />
                    <InputField
                      label="Prazo"
                      name={`prazo-${indice}`}
                      type="date"
                      value={item.prazoLimite}
                      onChange={(evento) => mudarItem(indice, "prazoLimite", evento.target.value)}
                    />
                  </FieldGrid>

                  <div className={styles.opcoes}>
                    <label className={styles.opcao}>
                      <input
                        type="checkbox"
                        checked={item.exigeAnexo}
                        onChange={(evento) => mudarItem(indice, "exigeAnexo", evento.target.checked)}
                      />
                      Exige documento anexado
                    </label>

                    <label className={styles.opcao}>
                      <input
                        type="checkbox"
                        checked={item.recorrente}
                        onChange={(evento) => mudarItem(indice, "recorrente", evento.target.checked)}
                      />
                      Vence e precisa ser cumprido de novo
                    </label>

                    {/* Só aparece quando é recorrente: periodicidade sem
                        recorrência é número que ninguém lê, e o banco recusa. */}
                    {item.recorrente ? (
                      <InputField
                        label="A cada (dias)"
                        name={`periodicidade-${indice}`}
                        type="number"
                        min="1"
                        required
                        value={item.periodicidadeDias ?? ""}
                        onChange={(evento) => mudarItem(
                          indice, "periodicidadeDias", Number(evento.target.value) || null,
                        )}
                      />
                    ) : null}

                    {itens.length > 1 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setItens((atuais) => atuais.filter((_, i) => i !== indice))}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>

                  <TextareaField
                    label="Detalhe"
                    name={`descricao-${indice}`}
                    rows={2}
                    value={item.descricao}
                    onChange={(evento) => mudarItem(indice, "descricao", evento.target.value)}
                  />
                </div>
              ))}

              <Button
                type="button"
                variant="secondary"
                onClick={() => setItens((atuais) => [...atuais, { ...ITEM_VAZIO }])}
              >
                <Plus size={14} aria-hidden="true" style={{ marginRight: "6px" }} />
                Mais um item
              </Button>
            </div>
          )}
        </>
      ) : null}

      {/* ---- 3. Revisão -------------------------------------------------- */}
      {passo === 2 ? (
        <SummaryGrid
          items={[
            {
              label: "Referente a",
              value: vinculo === "AVULSO" || !alvoTipo
                ? "lista avulsa"
                : `${alvoTipo.toLowerCase()} escolhido`,
            },
            { label: "Título", value: titulo.trim() || modelo?.nome || "—" },
            { label: "Modelo", value: modelo?.nome ?? "escrito na hora" },
            {
              label: "Itens",
              value: modelo
                ? `${modelo.totalItens} vindos do modelo`
                : `${preenchidos.length} escrito(s) agora`,
            },
          ]}
        />
      ) : null}

      {/* ---- Navegação --------------------------------------------------- */}
      <div className={styles.rodape}>
        {passo > (alvo ? 1 : 0) ? (
          <Button type="button" variant="secondary" onClick={voltar}>
            Voltar
          </Button>
        ) : null}

        {passo < 2 ? (
          <Button type="button" onClick={avancar}>
            Próximo
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Criando…" : "Criar checklist"}
          </Button>
        )}
      </div>
    </form>
  );
};
