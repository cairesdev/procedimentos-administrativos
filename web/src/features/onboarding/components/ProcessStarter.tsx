"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileSignature, Gavel } from "lucide-react";
import { BidForm } from "@/features/bids/components/BidForm";
import { PriceRecordForm } from "@/features/price-records/components/PriceRecordForm";
import type { Bid } from "@/features/bids/types";
import type { Unit } from "@/features/units/types";
import { Button } from "@/shared/ui/button";
import { Alert, Card, Stack, Steps } from "@/shared/ui/layout";
import styles from "./ProcessStarter.module.css";

type Origin = "LICITACAO" | "ATA";

const STEPS = ["Origem", "Cadastro da origem", "Contrato"];

export const ProcessStarter = ({
  units,
  bids,
}: {
  units: Unit[];
  bids: Bid[];
}) => {
  const router = useRouter();
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<{ id: string; numero: string } | null>(null);

  // O formulário devolve o registro criado e o assistente segue para o passo 3.
  const handleCreated = (record: { id: string; numero: string }) => {
    setCreated(record);
    setStep(2);
  };

  return (
    <Stack>
      <Steps steps={STEPS} current={step} />

      {step === 0 ? (
        <Card title="Este procedimento nasce de quê?">
          <div className={styles.options}>
            <button
              type="button"
              className={`${styles.option} ${origin === "LICITACAO" ? styles.option_active : ""}`}
              onClick={() => setOrigin("LICITACAO")}
              aria-pressed={origin === "LICITACAO"}
            >
              <Gavel size={20} aria-hidden="true" />
              <span className={styles.option_title}>Licitação</span>
              <span className={styles.option_hint}>
                Pregão, concorrência, dispensa, inexigibilidade ou chamada pública
              </span>
            </button>

            <button
              type="button"
              className={`${styles.option} ${origin === "ATA" ? styles.option_active : ""}`}
              onClick={() => setOrigin("ATA")}
              aria-pressed={origin === "ATA"}
            >
              <FileSignature size={20} aria-hidden="true" />
              <span className={styles.option_title}>Ata de registro de preços</span>
              <span className={styles.option_hint}>
                Itens com preço já registrado, com ou sem licitação vinculada
              </span>
            </button>
          </div>

          <div className={styles.actions}>
            <Button type="button" disabled={!origin} onClick={() => setStep(1)}>
              Continuar
              <ArrowRight size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginLeft: "6px" }} />
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 1 && origin === "LICITACAO" ? (
        <Card title="Dados da licitação">
          <BidForm units={units} onCreated={handleCreated} />
        </Card>
      ) : null}

      {step === 1 && origin === "ATA" ? (
        <PriceRecordForm bids={bids} onCreated={handleCreated} />
      ) : null}

      {step === 2 && created ? (
        <Card title="Cadastrar o contrato agora?">
          <Stack>
            <Alert tone="success">
              <Check size={14} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {origin === "ATA" ? "Ata" : "Licitação"} {created.numero} cadastrada. Os itens já
              podem virar contrato.
            </Alert>

            <p className={styles.explain}>
              O contrato define fornecedor, vigência, unidades atendidas e o saldo de cada item.
              Sem ele, nenhuma secretaria consegue solicitar. Você pode fazer isso agora ou depois,
              pela tela de contratos.
            </p>

            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(origin === "ATA" ? "/atas" : "/licitacoes")}
              >
                Concluir sem contrato
              </Button>
              <Button
                type="button"
                onClick={() =>
                  router.push(
                    `/processos/contratos/novo?origem=${origin}&origemId=${created.id}`,
                  )
                }
              >
                Cadastrar contrato
                <ArrowRight size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginLeft: "6px" }} />
              </Button>
            </div>
          </Stack>
        </Card>
      ) : null}

      {step > 0 && step < 2 ? (
        <div>
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
        </div>
      ) : null}
    </Stack>
  );
};
