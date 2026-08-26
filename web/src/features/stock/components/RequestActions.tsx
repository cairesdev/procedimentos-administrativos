"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Alert } from "@/shared/ui/layout";
import { cancelStockRequest, sendStockRequest } from "../actions";
import type { StockRequest } from "../types";

/**
 * As ações que o estado do pedido aceita — e só elas.
 *
 * Oferecer botão que a API vai recusar ensina o usuário a desconfiar da tela.
 * Enviar existe no rascunho; cancelar, enquanto ninguém liberou.
 */
export const RequestActions = ({
  pedido,
  podePedir,
}: {
  pedido: StockRequest;
  podePedir: boolean;
}) => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<"enviar" | "cancelar" | null>(null);

  const executar = async (
    acao: "enviar" | "cancelar",
    operacao: () => Promise<{ error?: string; success?: string }>,
  ) => {
    setOcupado(acao);
    const resultado = await operacao();
    setOcupado(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Pronto");
    router.refresh();
  };

  const podeEnviar = pedido.status === "RASCUNHO";
  const podeCancelar = pedido.status === "RASCUNHO" || pedido.status === "SOLICITADA";

  if (!podePedir || (!podeEnviar && !podeCancelar)) {
    return (
      <Alert tone="info">
        Nada a fazer aqui: o pedido está como {pedido.status.toLowerCase()} e segue com o
        almoxarifado ou já foi encerrado.
      </Alert>
    );
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {podeEnviar ? (
        <Alert tone="info">
          Enviar reserva o saldo no almoxarifado
          {pedido.reservaExpiraEm ? " por um prazo configurado pela prefeitura" : ""}. Até lá, este
          rascunho não segura nada.
        </Alert>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        {podeCancelar ? (
          <Button
            type="button"
            variant="secondary"
            disabled={ocupado !== null}
            onClick={() => void executar("cancelar", () => cancelStockRequest(pedido.id))}
          >
            <Ban size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            {ocupado === "cancelar" ? "Cancelando…" : "Cancelar pedido"}
          </Button>
        ) : null}

        {podeEnviar ? (
          <Button
            type="button"
            disabled={ocupado !== null || pedido.itens.length === 0}
            onClick={() => void executar("enviar", () => sendStockRequest(pedido.id))}
          >
            <Send size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            {ocupado === "enviar" ? "Enviando…" : "Enviar ao almoxarifado"}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
