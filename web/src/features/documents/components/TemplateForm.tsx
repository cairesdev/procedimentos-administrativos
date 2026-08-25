"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { deleteTemplate, restoreDefaultTemplate, saveTemplate } from "../actions";
import { templateSchema, type TemplateInput } from "../schemas";
import type { DocumentTemplate, MarkerCatalog } from "../types";
import styles from "./TemplateForm.module.css";

/**
 * Edição do modelo pela prefeitura. A lista de marcadores fica ao lado porque
 * escrever `{{contrato.numero}}` de cabeça é como o modelo quebra: o nome
 * errado só apareceria na hora de emitir.
 */
export const TemplateForm = ({
  modelo,
  catalogo,
}: {
  modelo: DocumentTemplate;
  catalogo: MarkerCatalog;
}) => {
  const [restaurando, iniciarRestauracao] = useTransition();
  const router = useRouter();
  const [corpo, setCorpo] = useState(modelo.corpo);

  const { form, onSubmit, isSubmitting } = useResourceForm<TemplateInput>({
    schema: templateSchema as never,
    defaultValues: {
      nome: modelo.nome,
      titulo: modelo.titulo,
      corpo: modelo.corpo,
      ativo: modelo.ativo,
    },
    resetOnSuccess: false,
    action: (values) => saveTemplate(modelo.tipo, values),
  });

  const excluir = () => {
    iniciarRestauracao(async () => {
      const resultado = await deleteTemplate(modelo.tipo);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.success);
      router.push("/administracao/documentos");
    });
  };

  const restaurar = () => {
    iniciarRestauracao(async () => {
      const resultado = await restoreDefaultTemplate(modelo.tipo);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.success);
    });
  };

  return (
    <div className={styles.layout}>
      <form onSubmit={onSubmit} className={styles.formulario}>
        {modelo.personalizado ? (
          <Alert tone="info">
            Documento criado por esta prefeitura. Não existe padrão do sistema por trás dele: para
            tirá-lo de circulação, desative; para apagar de vez, exclua.
          </Alert>
        ) : modelo.origem === "GLOBAL" ? (
          <Alert tone="info">
            Esta prefeitura usa o modelo padrão do sistema. Ao salvar, passa a ter uma versão
            própria — e o padrão deixa de valer aqui.
          </Alert>
        ) : (
          <Alert tone="info">
            Modelo personalizado desta prefeitura. Correções feitas no padrão do sistema não
            chegam mais aqui; use &ldquo;restaurar padrão&rdquo; para voltar a acompanhá-lo.
          </Alert>
        )}

        <InputField
          label="Nome no botão de emissão"
          required
          error={form.formState.errors.nome?.message}
          {...form.register("nome")}
        />
        <InputField
          label="Título impresso na peça"
          required
          hint="Sai em caixa alta no topo do documento, abaixo do timbre."
          error={form.formState.errors.titulo?.message}
          {...form.register("titulo")}
        />

        <TextareaField
          label="Corpo"
          required
          rows={18}
          hint="Aceita parágrafos e tabelas. Marcadores entre chaves duplas são trocados na emissão."
          error={form.formState.errors.corpo?.message}
          {...form.register("corpo", {
            onChange: (evento) => setCorpo(evento.target.value),
          })}
        />

        <label className={styles.ativo}>
          <input type="checkbox" {...form.register("ativo")} />
          Disponível para emissão
        </label>

        <div className={styles.acoes}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar modelo"}
          </Button>

          {modelo.origem === "PREFEITURA" && !modelo.personalizado ? (
            <Button type="button" variant="secondary" onClick={restaurar} disabled={restaurando}>
              <RotateCcw size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {restaurando ? "Restaurando…" : "Restaurar padrão"}
            </Button>
          ) : null}

          {modelo.personalizado ? (
            <Button type="button" variant="secondary" onClick={excluir} disabled={restaurando}>
              <Trash2 size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {restaurando ? "Excluindo…" : "Excluir documento"}
            </Button>
          ) : null}
        </div>
      </form>

      <aside className={styles.marcadores}>
        <h3 className={styles.titulo_lista}>Marcadores deste documento</h3>
        <p className={styles.ajuda}>
          Clique para copiar. Marcador que não estiver nesta lista impede de salvar.
        </p>

        <ul className={styles.lista}>
          {catalogo.valores.map((marcador) => (
            <li key={marcador}>
              <button
                type="button"
                className={styles.marcador}
                onClick={() => {
                  void navigator.clipboard.writeText(`{{${marcador}}}`);
                  toast.success(`{{${marcador}}} copiado`);
                }}
              >
                {`{{${marcador}}}`}
              </button>
            </li>
          ))}
        </ul>

        {Object.entries(catalogo.listas).map(([lista, campos]) => (
          <div key={lista}>
            <h4 className={styles.titulo_lista}>Lista {`{{#${lista}}}`}</h4>
            <p className={styles.ajuda}>
              O trecho entre {`{{#${lista}}}`} e {`{{/${lista}}}`} se repete por item. Use{" "}
              {"{{indice}}"} para numerar.
            </p>
            <ul className={styles.lista}>
              {campos.map((campo) => (
                <li key={campo}>
                  <span className={styles.marcador}>{`{{${campo}}}`}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <h4 className={styles.titulo_lista}>Pré-visualização da marcação</h4>
        <div className={styles.previa} dangerouslySetInnerHTML={{ __html: corpo }} />
        <p className={styles.ajuda}>
          Mostra só a formatação; os marcadores são trocados na emissão.
        </p>
      </aside>
    </div>
  );
};
