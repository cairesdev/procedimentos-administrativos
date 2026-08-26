"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { SelectField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { issueDocument } from "../actions";
import type { DocumentTemplate } from "../types";

/**
 * Emissão a partir de uma linha de listagem — bem, transferência, manutenção.
 *
 * O painel completo mostra o que já saiu, e pede uma tela de detalhe para
 * caber. Estes registros não têm tela própria: quem trabalha com eles opera
 * pela lista, e mandá-lo a outro lugar só para imprimir um termo seria um
 * desvio inútil no meio do trabalho.
 */
export const IssueDocumentButton = ({
  referenciaId,
  voltarPara,
  modelos,
  titulo,
  descricao,
  rotulo,
}: {
  referenciaId: string;
  voltarPara: string;
  modelos: DocumentTemplate[];
  titulo: string;
  descricao?: string;
  /** Para o leitor de tela distinguir uma linha da outra. */
  rotulo: string;
}) => {
  const disponiveis = modelos.filter((modelo) => modelo.ativo);
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState(disponiveis[0]?.tipo ?? "");
  const [emitindo, iniciarEmissao] = useTransition();

  // Sem modelo ativo não há o que oferecer: um botão que sempre abre um aviso
  // é ruído na linha.
  if (disponiveis.length === 0) return null;

  const emitir = () => {
    if (!tipo) return;
    iniciarEmissao(async () => {
      // Sucesso redireciona para a peça; só o erro volta com resultado.
      const resultado = await issueDocument({ tipo, referenciaId, voltarPara });
      if (resultado?.error) toast.error(resultado.error);
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setAberto(true)}
        title="Emitir documento"
        aria-label={`Emitir documento de ${rotulo}`}
      >
        <FileText size={15} aria-hidden="true" />
      </Button>

      <Modal open={aberto} onClose={() => setAberto(false)} title={titulo} description={descricao}>
        <div style={{ display: "grid", gap: "14px" }}>
          {disponiveis.length === 1 ? (
            <Alert tone="info">{disponiveis[0]!.nome}</Alert>
          ) : (
            <SelectField
              label="Documento"
              name="tipo"
              value={tipo}
              onChange={(evento) => setTipo(evento.target.value)}
              options={disponiveis.map((modelo) => ({
                value: modelo.tipo,
                label: modelo.nome,
              }))}
            />
          )}

          <div>
            <Button type="button" onClick={emitir} disabled={emitindo}>
              {emitindo ? "Emitindo…" : "Emitir"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
