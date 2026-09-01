import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import type { DocumentTemplate, IssuedDocument } from "@/features/documents/types";
import { Alert, SummaryGrid } from "@/shared/ui/layout";
import { toCurrency, toDate } from "@/shared/ui/labels";
import { InvoiceField } from "./InvoiceField";
import type { SupplyOrder } from "../types";

/**
 * Cada ordem emitida vira um bloco com a peça correspondente logo abaixo.
 * A ordem é o registro; o documento é o papel que sai dela — e o papel se
 * pede aqui, no setor que emitiu a ordem, não em outra tela.
 */
export const SupplyOrderPanel = ({
  ordens,
  documentosPorOrdem,
  modelos,
  voltarPara,
  podeEmitir,
  processId,
  podeInformarNota,
}: {
  ordens: SupplyOrder[];
  documentosPorOrdem: Record<string, IssuedDocument[]>;
  modelos: DocumentTemplate[];
  voltarPara: string;
  podeEmitir: boolean;
  processId: string;
  /** Compras e controladoria: quem tem a nota em mãos. */
  podeInformarNota: boolean;
}) => {
  if (ordens.length === 0) {
    return (
      <Alert tone="info">
        Nenhuma ordem emitida neste processo. Emita a ordem em Ações — a peça para impressão
        aparece aqui em seguida.
      </Alert>
    );
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      {ordens.map((ordem) => (
        <section key={ordem.id}>
          <h3 style={{ fontSize: "0.95rem", margin: "0 0 8px" }}>
            Ordem {ordem.numero} · {ordem.fornecedorNome}
          </h3>

          <SummaryGrid
            items={[
              { label: "Contrato", value: ordem.contratoNumero },
              { label: "Valor", value: toCurrency(ordem.valor) },
              { label: "Emitida em", value: toDate(ordem.data) },
              { label: "Empenho", value: ordem.numeroEmpenho ?? "—" },
              ...(podeInformarNota
                ? []
                : [{ label: "Nota fiscal", value: ordem.numeroNotaFiscal ?? "—" }]),
            ]}
          />

          {/* Editável para quem confere; só leitura para os demais. */}
          {podeInformarNota ? (
            <div style={{ marginTop: "10px", maxWidth: "420px" }}>
              <InvoiceField
                processId={processId}
                ordemId={ordem.id}
                atual={ordem.numeroNotaFiscal}
              />
            </div>
          ) : null}

          <div style={{ marginTop: "12px" }}>
            <IssueDocumentPanel
              referenciaId={ordem.id}
              voltarPara={voltarPara}
              modelos={modelos}
              emitidos={documentosPorOrdem[ordem.id] ?? []}
              podeEmitir={podeEmitir}
            />
          </div>
        </section>
      ))}
    </div>
  );
};
