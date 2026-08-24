"use client";

import { Printer } from "lucide-react";
import { Button } from "@/shared/ui/button";
import styles from "./Letterhead.module.css";

/** Some na impressão: só existe para disparar o diálogo do navegador. */
export const PrintBar = () => (
  <div className={styles.barra}>
    <Button type="button" onClick={() => window.print()}>
      <Printer size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
      Imprimir ou salvar em PDF
    </Button>
  </div>
);
