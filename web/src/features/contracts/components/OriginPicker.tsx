"use client";

import type { Control } from "react-hook-form";
import { useController } from "react-hook-form";
import { FileSignature, Gavel } from "lucide-react";
import { Alert } from "@/shared/ui/layout";
import { toCurrency, toDate } from "@/shared/ui/labels";
import type { Bid } from "@/features/bids/types";
import type { PriceRecord } from "@/features/price-records/types";
import type { ContractInput } from "../schemas";
import styles from "./OriginPicker.module.css";

// Contrato nasce de licitação OU ata — nenhuma das duas é o caminho fixo.
export const OriginPicker = ({
  control,
  bids,
  priceRecords,
}: {
  control: Control<ContractInput>;
  bids: Bid[];
  priceRecords: PriceRecord[];
}) => {
  const origin = useController({ control, name: "origem" });
  const bid = useController({ control, name: "licitacaoId" });
  const record = useController({ control, name: "ataId" });

  const isBid = origin.field.value !== "ATA";
  const sources = isBid ? bids : priceRecords;
  const selected = isBid ? bid : record;

  const pick = (nextOrigin: "LICITACAO" | "ATA") => {
    origin.field.onChange(nextOrigin);
    bid.field.onChange("");
    record.field.onChange("");
  };

  return (
    <div className={styles.picker}>
      <div className={styles.options}>
        <button
          type="button"
          className={`${styles.option} ${isBid ? styles.option_active : ""}`}
          onClick={() => pick("LICITACAO")}
          aria-pressed={isBid}
        >
          <Gavel size={18} aria-hidden="true" />
          <span className={styles.option_title}>Licitação</span>
          <span className={styles.option_hint}>Pregão, dispensa, chamada pública</span>
        </button>

        <button
          type="button"
          className={`${styles.option} ${!isBid ? styles.option_active : ""}`}
          onClick={() => pick("ATA")}
          aria-pressed={!isBid}
        >
          <FileSignature size={18} aria-hidden="true" />
          <span className={styles.option_title}>Ata de registro de preços</span>
          <span className={styles.option_hint}>Itens já registrados com preço</span>
        </button>
      </div>

      {sources.length === 0 ? (
        <Alert tone="info">
          {isBid
            ? "Nenhuma licitação cadastrada. Cadastre a licitação antes do contrato."
            : "Nenhuma ata cadastrada. Cadastre a ata ou escolha uma licitação como origem."}
        </Alert>
      ) : (
        <div className={styles.list}>
          {sources.map((source) => {
            const isSelected = selected.field.value === source.id;
            const validity =
              "dataVigencia" in source
                ? `vigente até ${toDate(source.dataVigencia)}`
                : `assinada em ${toDate(source.dataAssinatura)}`;

            return (
              <button
                key={source.id}
                type="button"
                className={`${styles.source} ${isSelected ? styles.source_active : ""}`}
                onClick={() => selected.field.onChange(source.id)}
                aria-pressed={isSelected}
              >
                <span className={styles.source_number}>{source.numero}</span>
                <span className={styles.source_object}>{source.objeto}</span>
                <span className={styles.source_meta}>
                  {validity} · {toCurrency(source.valorTotal)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected.fieldState.error ? (
        <Alert tone="error">{selected.fieldState.error.message}</Alert>
      ) : null}
    </div>
  );
};
