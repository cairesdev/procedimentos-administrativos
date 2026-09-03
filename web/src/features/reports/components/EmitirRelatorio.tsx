"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { saveReportCut } from "../actions";
import type { ReportFilters, ReportType } from "../types";

/**
 * Congela o relatório numa peça com timbre, assinatura e código de conferência.
 *
 * A tela se refaz a cada abertura, e é isso que se quer de uma consulta. Já a
 * prestação de contas precisa do contrário: um papel que diga o que se via
 * naquela data, e continue dizendo o mesmo daqui a um ano.
 *
 * O recorte é gravado neste clique — a pergunta, não a resposta —, porque o
 * documento precisa de um registro para apontar. Os números são apurados na
 * emissão e ficam presos ao corpo da peça.
 */
export const EmitirRelatorio = ({
  tipo,
  filtros,
}: {
  tipo: ReportType;
  filtros: ReportFilters;
}) => {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);

  const emitir = async () => {
    setSalvando(true);
    const resultado = await saveReportCut(tipo, filtros);
    setSalvando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    if (!resultado.id) {
      toast.error("O recorte foi salvo, mas a API não devolveu o identificador.");
      return;
    }

    // A emissão acontece na página do recorte, que reapura os mesmos números e
    // traz o painel de documentos — o mesmo caminho de qualquer outra peça.
    router.push(`/processos/relatorios/${resultado.id}`);
  };

  return (
    <Button type="button" variant="secondary" disabled={salvando} onClick={() => void emitir()}>
      <FileText size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
      {salvando ? "Preparando…" : "Emitir relatório"}
    </Button>
  );
};
