"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "./Checklist.module.css";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createTemplate, updateTemplate } from "../actions";
import { templateFormSchema, type TemplateFormInput } from "../schemas";
import type { ChecklistTemplateDetail } from "../types";

/**
 * O que a tela não desenha, e mesmo assim precisa voltar.
 *
 * Salvar substitui a lista inteira no banco. Item novo nasce sem nada disso;
 * item vindo de um modelo copiado — o roteiro do PNTP — chega com dimensão,
 * código, classificação, setor sugerido, apoios e arquivo de referência, e
 * perdê-los numa correção de título é o que este resgate evita.
 */
const PRESERVADO = {
  secao: null as string | null,
  codigo: null as string | null,
  classificacao: null as "OBRIGATORIA" | "ESSENCIAL" | "RECOMENDADA" | null,
  setorSugerido: null as string | null,
  modeloArquivo: null as string | null,
  modeloNomeOriginal: null as string | null,
  apoios: [] as { setorId: string | null; departamentoId: string | null }[],
};

const ITEM_VAZIO = {
  titulo: "",
  descricao: "",
  exigeAnexo: false,
  recorrente: false,
  periodicidadeDias: null as number | null,
  prazoDias: null as number | null,
  responsavel: "",
  ...PRESERVADO,
};

const destinoDoItem = (item: {
  setorId: string | null; departamentoId: string | null; paraFornecedor: boolean;
}) => {
  if (item.paraFornecedor) return "fornecedor";
  if (item.setorId) return `setor:${item.setorId}`;
  if (item.departamentoId) return `departamento:${item.departamentoId}`;
  return "";
};

/**
 * O modelo: a lista escrita uma vez.
 *
 * O prazo aqui é em **dias**, e não data: uma data fixa envelheceria junto com
 * o modelo, e um modelo de dois anos atrás nasceria vencido.
 */
export const TemplateForm = ({
  modelo,
  setores,
}: {
  modelo?: ChecklistTemplateDetail;
  setores: { id: string; nome: string }[];
}) => {
  const closeModal = useModalClose();
  const [itens, setItens] = useState(
    modelo?.itens.map((item) => ({
      titulo: item.titulo,
      descricao: item.descricao ?? "",
      exigeAnexo: item.exigeAnexo,
      recorrente: item.recorrente,
      periodicidadeDias: item.periodicidadeDias,
      prazoDias: item.prazoDias,
      responsavel: destinoDoItem(item),
      secao: item.secao,
      codigo: item.codigo,
      classificacao: item.classificacao,
      setorSugerido: item.setorSugerido,
      modeloArquivo: item.modeloArquivo,
      modeloNomeOriginal: item.modeloNomeOriginal,
      apoios: (item.apoios ?? []).map(({ setorId, departamentoId }) => ({
        setorId, departamentoId,
      })),
    })) ?? [{ ...ITEM_VAZIO }],
  );

  const { form, onSubmit, isSubmitting } = useResourceForm<TemplateFormInput>({
    schema: templateFormSchema,
    defaultValues: {
      nome: modelo?.nome ?? "",
      descricao: modelo?.descricao ?? "",
      ativo: modelo?.ativo ?? true,
    },
    /**
     * Os itens entram aqui, vindos do estado — e são conferidos aqui.
     *
     * Recusar antes de chamar a API dá a mensagem certa na hora certa: o
     * servidor diria "o modelo precisa de ao menos um item" depois da ida e
     * volta, e "titulo: obrigatório" sem dizer *qual* linha.
     */
    action: (values) => {
      const preenchidos = itens.filter((item) => item.titulo.trim());

      if (preenchidos.length === 0) {
        return Promise.resolve({
          error: "O modelo precisa de ao menos um item com título.",
        });
      }

      const vazio = itens.findIndex((item) => !item.titulo.trim());
      if (vazio >= 0) {
        return Promise.resolve({
          error: `O item ${vazio + 1} está sem título. Preencha ou remova a linha.`,
        });
      }

      const semPeriodicidade = itens.findIndex(
        (item) => item.recorrente && !item.periodicidadeDias,
      );
      if (semPeriodicidade >= 0) {
        return Promise.resolve({
          error: `O item ${semPeriodicidade + 1} vence, mas não diz de quantos em quantos dias.`,
        });
      }

      return modelo
        ? updateTemplate(modelo.id, { ...values, itens })
        : createTemplate({ ...values, itens });
    },
    resetOnSuccess: !modelo,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  const destinos = [
    ...setores.map((setor) => ({ value: `setor:${setor.id}`, label: `Setor · ${setor.nome}` })),
    { value: "fornecedor", label: "Fornecedor (externo)" },
  ];

  const mudarItem = (indice: number, campo: string, valor: unknown) => {
    setItens((atuais) => atuais.map((item, i) =>
      i === indice ? { ...item, [campo]: valor } : item));
  };

  return (
    <form onSubmit={onSubmit} className={styles.formulario}>
      <InputField
        label="Nome"
        required
        placeholder="Habilitação de fornecedor"
        error={errors.nome?.message}
        {...form.register("nome")}
      />

      <TextareaField
        label="Descrição"
        rows={2}
        {...form.register("descricao")}
      />

      <div className={styles.lista}>
        <strong className={styles.secao_titulo}>Itens</strong>

        {itens.map((item, indice) => (
          <div
            key={indice}
            className={styles.item}
          >
            <InputField
              label={`Item ${indice + 1}`}
              name={`titulo-${indice}`}
              required
              placeholder="Certidão negativa de débitos federais"
              value={item.titulo}
              onChange={(evento) => mudarItem(indice, "titulo", evento.target.value)}
            />

            <FieldGrid>
              <SelectField
                label="Quem cumpre"
                name={`destino-${indice}`}
                emptyOption="— definir na aplicação —"
                options={destinos}
                value={item.responsavel}
                onChange={(evento) => mudarItem(indice, "responsavel", evento.target.value)}
              />
              <InputField
                label="Prazo (dias)"
                name={`prazo-${indice}`}
                type="number"
                min="1"
                hint="Contados a partir da aplicação."
                value={item.prazoDias ?? ""}
                onChange={(evento) => mudarItem(
                  indice, "prazoDias", Number(evento.target.value) || null,
                )}
              />
            </FieldGrid>

            <div className={styles.opcoes}>
              <label className={styles.opcao}>
                <input
                  type="checkbox"
                  checked={item.exigeAnexo}
                  onChange={(evento) => mudarItem(indice, "exigeAnexo", evento.target.checked)}
                />
                Exige documento
              </label>

              <label className={styles.opcao}>
                <input
                  type="checkbox"
                  checked={item.recorrente}
                  onChange={(evento) => mudarItem(indice, "recorrente", evento.target.checked)}
                />
                Vence e volta a ser exigível
              </label>

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

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : modelo ? "Salvar modelo" : "Criar modelo"}
        </Button>
      </div>
    </form>
  );
};
