"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";
import { Alert } from "./layout";
import { Modal } from "./Modal";
import styles from "./RowActions.module.css";
import type { ActionResult } from "./use-resource-form";

type RowActionsProps = {
  /** Nome do registro, usado nas mensagens de confirmação. */
  label: string;
  editTitle?: string;
  editDescription?: string;
  editForm?: ReactNode;
  isActive?: boolean;
  onToggleActive?: () => Promise<ActionResult>;
  onDelete?: () => Promise<ActionResult>;
  deleteWarning?: string;
};

export const RowActions = ({
  label,
  editTitle = "Editar",
  editDescription,
  editForm,
  isActive,
  onToggleActive,
  onDelete,
  deleteWarning,
}: RowActionsProps) => {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "toggle" | null>(null);
  const [running, setRunning] = useState(false);

  const run = async (operation: () => Promise<ActionResult>, fallback: string) => {
    setRunning(true);
    const result = await operation();
    setRunning(false);
    setConfirming(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success ?? fallback);
    router.refresh();
  };

  const activeLabel = isActive ? "Inativar" : "Reativar";

  return (
    <>
      <div className={styles.actions}>
        {editForm ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => setEditing(true)}
            aria-label={`Editar ${label}`}
            title="Editar"
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
        ) : null}

        {onToggleActive ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => setConfirming("toggle")}
            aria-label={`${activeLabel} ${label}`}
            title={activeLabel}
          >
            <Power size={15} aria-hidden="true" />
          </button>
        ) : null}

        {onDelete ? (
          <button
            type="button"
            className={`${styles.action} ${styles.action_danger}`}
            onClick={() => setConfirming("delete")}
            aria-label={`Excluir ${label}`}
            title="Excluir"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {editForm ? (
        <Modal
          open={editing}
          onClose={() => setEditing(false)}
          title={editTitle}
          description={editDescription}
        >
          {editForm}
        </Modal>
      ) : null}

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === "delete" ? "Excluir registro" : `${activeLabel} registro`}
      >
        <div className={styles.confirm}>
          <p className={styles.confirm_message}>
            {confirming === "delete" ? "Excluir " : `${activeLabel.toLowerCase()} `}
            <span className={styles.confirm_target}>{label}</span>?
          </p>

          {confirming === "delete" ? (
            <Alert tone="error">
              {deleteWarning ??
                "A exclusão é definitiva e só funciona se o registro nunca tiver sido usado. Se houver vínculo, prefira inativar."}
            </Alert>
          ) : (
            <Alert tone="info">
              {isActive
                ? "O registro deixa de aparecer nas listas de seleção, mas o histórico é preservado."
                : "O registro volta a ficar disponível para seleção."}
            </Alert>
          )}

          <div className={styles.confirm_actions}>
            <Button type="button" variant="secondary" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className={confirming === "delete" ? styles.danger_button : undefined}
              disabled={running}
              onClick={() =>
                confirming === "delete"
                  ? run(onDelete!, "Registro excluído")
                  : run(onToggleActive!, `Registro ${isActive ? "inativado" : "reativado"}`)
              }
            >
              {running ? "Aplicando…" : confirming === "delete" ? "Excluir" : activeLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
