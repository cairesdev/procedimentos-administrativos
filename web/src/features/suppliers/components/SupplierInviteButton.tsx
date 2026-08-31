"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Alert } from "@/shared/ui/layout";
import { inviteSupplier } from "../actions";

/**
 * Gera o link em que o fornecedor corrige o próprio cadastro.
 *
 * O token aparece **uma vez só**: o banco guarda o hash, e não há como
 * reexibi-lo. Gerar de novo cria outro link e mata o anterior — é o
 * comportamento certo, e o único possível quando o segredo não fica guardado.
 */
export const SupplierInviteButton = ({
  supplierId,
  razaoSocial,
}: {
  supplierId: string;
  razaoSocial: string;
}) => {
  const [link, setLink] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const gerar = async () => {
    setGerando(true);
    const resultado = await inviteSupplier(supplierId);
    setGerando(false);

    if ("error" in resultado) {
      toast.error(resultado.error);
      return;
    }

    setLink(`${window.location.origin}/fornecedor/${resultado.token}`);
    setCopiado(false);
  };

  const copiar = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    toast.success("Link copiado");
  };

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <p style={{ margin: 0, fontSize: "13px", color: "var(--texto_suave)" }}>
        Envie este endereço para <strong>{razaoSocial}</strong>. Quem abrir corrige razão social,
        endereço e contato — o CNPJ fica travado, porque identifica a empresa nos contratos.
      </p>

      {link ? (
        <>
          <Alert tone="success">
            Link gerado. <strong>Copie agora</strong> — por segurança ele não pode ser mostrado de
            novo. Se precisar, gere outro (o anterior deixa de valer).
          </Alert>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              readOnly
              value={link}
              onFocus={(evento) => evento.target.select()}
              style={{
                flex: 1,
                fontFamily: "ui-monospace, monospace",
                fontSize: "12px",
                padding: "8px",
              }}
            />
            <Button type="button" variant="secondary" onClick={() => void copiar()}>
              {copiado ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
            </Button>
          </div>
        </>
      ) : null}

      <div>
        <Button type="button" onClick={() => void gerar()} disabled={gerando}>
          <Link2 size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          {gerando ? "Gerando…" : link ? "Gerar outro link" : "Gerar link"}
        </Button>
      </div>
    </div>
  );
};
