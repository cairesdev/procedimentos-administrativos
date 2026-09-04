"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { resendEmail } from "../actions";

/**
 * Devolve o e-mail à fila.
 *
 * Não corrige nada por si: se o SMTP continua errado, vai falhar de novo. O
 * botão existe para o depois do conserto — trocada a senha ou a porta, os que
 * ficaram para trás saem sem precisar refazer o ato que os gerou.
 */
export const ResendButton = ({ id }: { id: string }) => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  const reenviar = async () => {
    setOcupado(true);
    const resultado = await resendEmail(id);
    setOcupado(false);

    if ("error" in resultado) {
      toast.error(resultado.error);
      return;
    }
    toast.success("E-mail devolvido à fila");
    router.refresh();
  };

  return (
    <Button type="button" variant="secondary" disabled={ocupado} onClick={() => void reenviar()}>
      {ocupado ? "Enviando…" : "Reenviar"}
    </Button>
  );
};
