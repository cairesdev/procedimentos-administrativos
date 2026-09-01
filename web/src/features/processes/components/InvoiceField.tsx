"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { informInvoice } from "../actions";

/**
 * O número da nota fiscal, informado depois.
 *
 * A ordem é emitida quando a compra é autorizada; a nota chega com a
 * mercadoria, dias depois. Fica editável — número digitado errado é comum, e
 * travar a correção empurraria o acerto para fora do sistema.
 */
export const InvoiceField = ({
  processId,
  ordemId,
  atual,
}: {
  processId: string;
  ordemId: string;
  atual: string | null;
}) => {
  const router = useRouter();
  const [valor, setValor] = useState(atual ?? "");
  const [salvando, setSalvando] = useState(false);

  const mudou = (valor.trim() || null) !== (atual ?? null);

  const salvar = async () => {
    setSalvando(true);
    const resultado = await informInvoice(processId, ordemId, valor.trim() || null);
    setSalvando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Nota fiscal registrada");
    router.refresh();
  };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
      <InputField
        label="Nota fiscal"
        name={`nota-${ordemId}`}
        placeholder="Informe quando a nota chegar"
        hint="Em branco limpa o número."
        value={valor}
        onChange={(evento) => setValor(evento.target.value)}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={!mudou || salvando}
        onClick={() => void salvar()}
      >
        {salvando ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
};
