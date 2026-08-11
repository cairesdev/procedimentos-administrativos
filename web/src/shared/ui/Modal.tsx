"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "./button";
import styles from "./Modal.module.css";

const ModalContext = createContext<() => void>(() => {});

/** Dentro de um modal, fecha ao concluir. Fora dele, não faz nada. */
export const useModalClose = () => useContext(ModalContext);

// Diálogo nativo: fecha com Esc e trava o foco sem depender de biblioteca.
export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} onCancel={onClose}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.body}>
        {open ? <ModalContext.Provider value={onClose}>{children}</ModalContext.Provider> : null}
      </div>
    </dialog>
  );
};

// Botão + modal em um componente só, para cadastros curtos na própria listagem.
// children é JSX pronto (não função) para poder vir de um Server Component.
export const ModalTrigger = ({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}>
        {children}
      </Modal>
    </>
  );
};
