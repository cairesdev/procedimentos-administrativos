"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import styles from "./Checklist.module.css";
import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { inviteToChecklist, revokeChecklistInvite } from "../actions";

/**
 * O link que o fornecedor recebe.
 *
 * O token aparece **uma vez**, aqui. O banco guarda só o hash, e perdido o
 * endereço gera-se outro — que é o comportamento certo, e o mesmo de qualquer
 * sistema que leve segredo a sério.
 */
export const InviteButton = ({
  checklistId,
  conviteAberto,
}: {
  checklistId: string;
  conviteAberto: { expiraEm: string; destinatario: string | null } | null;
}) => {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [link, setLink] = useState<{ url: string; expiraEm: string } | null>(null);

  const gerar = async () => {
    setOcupado(true);
    const resultado = await inviteToChecklist(checklistId, destinatario);
    setOcupado(false);

    if ("error" in resultado) {
      toast.error(resultado.error);
      return;
    }
    setLink({
      url: `${window.location.origin}/exigencias/${resultado.token}`,
      expiraEm: resultado.expiraEm,
    });
    router.refresh();
  };

  const revogar = async () => {
    setOcupado(true);
    const resultado = await revokeChecklistInvite(checklistId);
    setOcupado(false);
    setLink(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Link revogado");
    setAberto(false);
    router.refresh();
  };

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setAberto(true)}>
        <Link2 size={15} aria-hidden="true" style={{ marginRight: "6px" }} />
        {conviteAberto ? "Link do fornecedor" : "Enviar link"}
      </Button>

      <Modal
        open={aberto}
        onClose={() => { setAberto(false); setLink(null); }}
        title="Link para o fornecedor"
        description="Ele cumpre os itens marcados como dele, sem precisar de conta."
      >
        <div className={styles.lista}>
          {link ? (
            <>
              <Alert tone="info">
                Copie agora: este endereço aparece <strong>uma única vez</strong>. Perdido, é só
                gerar outro — e o anterior deixa de valer.
              </Alert>
              <div className={styles.link}>
                <input
                  readOnly
                  value={link.url}
                  onFocus={(evento) => evento.target.select()}
                />
                <Button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(link.url);
                    toast.success("Endereço copiado");
                  }}
                >
                  <Copy size={14} aria-hidden="true" />
                </Button>
              </div>
              <small className={styles.suave}>
                Vale até {toDate(link.expiraEm)}.
              </small>
            </>
          ) : (
            <>
              {conviteAberto ? (
                <Alert tone="info">
                  Já existe um link aberto
                  {conviteAberto.destinatario ? ` para ${conviteAberto.destinatario}` : ""},
                  válido até {toDate(conviteAberto.expiraEm)}. Gerar outro invalida o anterior.
                </Alert>
              ) : null}

              <InputField
                label="Para quem"
                name="destinatario"
                placeholder="Construtora Alfa — contato@alfa.com.br"
                hint="Só para o registro; o link não é enviado por e-mail pelo sistema."
                value={destinatario}
                onChange={(evento) => setDestinatario(evento.target.value)}
              />

              <div className={styles.rodape}>
                {conviteAberto ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={ocupado}
                    onClick={() => void revogar()}
                  >
                    Revogar o atual
                  </Button>
                ) : null}
                <Button type="button" disabled={ocupado} onClick={() => void gerar()}>
                  {ocupado ? "Gerando…" : conviteAberto ? "Gerar novo" : "Gerar link"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};
