"use client";

import { useEffect, useState } from "react";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteTemplate } from "../actions";
import { TemplateForm } from "./TemplateForm";
import type { ChecklistTemplate, ChecklistTemplateDetail } from "../types";

/**
 * Editar um modelo exige os itens dele, que a lista não traz.
 *
 * Buscados ao abrir o modal, e não na página: uma tela com trinta modelos
 * faria trinta consultas para mostrar dados que ninguém pediu.
 */
export const TemplateActions = ({
  modelo,
  setores,
  podeEditar,
}: {
  modelo: ChecklistTemplate;
  setores: { id: string; nome: string }[];
  podeEditar: boolean;
}) => {
  const [detalhe, setDetalhe] = useState<ChecklistTemplateDetail | null>(null);

  useEffect(() => {
    if (!podeEditar) return;
    fetch(`/api/proxy/checklists/modelos/${modelo.id}`, { cache: "no-store" })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then(setDetalhe)
      .catch(() => setDetalhe(null));
  }, [modelo.id, podeEditar]);

  if (!podeEditar) return null;

  return (
    <RowActions
      label={modelo.nome}
      editTitle="Editar modelo"
      editDescription="Mudar o modelo não mexe nos checklists já aplicados."
      editForm={detalhe ? <TemplateForm modelo={detalhe} setores={setores} /> : undefined}
      onDelete={deleteTemplate.bind(null, modelo.id)}
      deleteWarning="Modelo já aplicado a algum checklist não pode ser excluído — inative-o."
    />
  );
};
