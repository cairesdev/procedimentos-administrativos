"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteTemplate, duplicateTemplate } from "../actions";
import { TemplateForm } from "./TemplateForm";
import type { ChecklistTemplate, ChecklistTemplateDetail } from "../types";

/**
 * Editar um modelo exige os itens dele, que a lista não traz.
 *
 * Buscados ao abrir o modal, e não na página: uma tela com trinta modelos
 * faria trinta consultas para mostrar dados que ninguém pediu.
 *
 * O modelo que veio com o sistema — o roteiro do PNTP — é lido por todas as
 * prefeituras e escrito por nenhuma. Oferecer "editar" nele daria um formulário
 * que salva e não muda nada, porque a escrita casa por `orgao_id` e a linha
 * global não tem dono. O que faz sentido ali é **duplicar**: a cópia é da
 * prefeitura, e aí sim se mexe à vontade.
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
  const router = useRouter();
  const [detalhe, setDetalhe] = useState<ChecklistTemplateDetail | null>(null);
  const [copiando, setCopiando] = useState(false);

  const proprio = podeEditar && !modelo.global;

  useEffect(() => {
    if (!proprio) return;
    fetch(`/api/proxy/checklists/modelos/${modelo.id}`, { cache: "no-store" })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((corpo) => setDetalhe(corpo ?? null))
      .catch(() => setDetalhe(null));
  }, [modelo.id, proprio]);

  if (!podeEditar) return null;

  if (modelo.global) {
    const duplicar = async () => {
      setCopiando(true);
      const resultado = await duplicateTemplate(modelo.id);
      setCopiando(false);

      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.success ?? "Cópia criada");
      router.refresh();
    };

    return (
      <Button
        type="button"
        variant="secondary"
        disabled={copiando}
        onClick={() => void duplicar()}
      >
        <Copy size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
        {copiando ? "Copiando…" : "Duplicar"}
      </Button>
    );
  }

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
