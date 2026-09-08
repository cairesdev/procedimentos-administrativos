"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { saveCut } from "../actions";

/**
 * O botão que transforma a consulta em papel.
 *
 * A tela de filtros não grava nada — consulta boa se refaz. Isto existe para o
 * outro caso: quando o relatório vai virar documento, e documento precisa de um
 * registro para apontar. O que fica gravado é a **pergunta** (programa e
 * período); a resposta é reapurada na emissão, pelo mesmo caso de uso que
 * desenhou esta tela.
 */
export const SaveCutButton = ({
  programaId, desde, ate,
}: {
  programaId: string; desde: string; ate: string;
}) => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  const salvar = async () => {
    setOcupado(true);
    const resultado = await saveCut(programaId, { desde, ate });
    setOcupado(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Recorte salvo");
    if (resultado.id) router.push(`/saude/programas/recortes/${resultado.id}`);
  };

  return (
    <Button type="button" disabled={ocupado} onClick={() => void salvar()}>
      {ocupado ? "Salvando…" : "Gerar documento deste período"}
    </Button>
  );
};
