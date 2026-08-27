"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Underline, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Alert } from "@/shared/ui/layout";
import { discardDraft, issueDraft, saveDraftBody } from "../actions";
import styles from "./DocumentEditor.module.css";

/**
 * Edição do documento **antes** de ele ser emitido.
 *
 * `contenteditable` sobre o próprio HTML da peça, e não um editor de terceiros.
 * A razão é a Ordem de Serviço: ela é toda tabela, com `colspan` e
 * `style="width: 22%"` em quase toda célula. Lexical e ProseMirror convertem o
 * HTML de entrada para um estado interno e o devolvem re-serializado — esses
 * atributos se perdem, a menos que se escreva uma extensão para cada um. Para
 * "trocar uma data", o custo não se paga, e o risco de o documento sair
 * deformado sem ninguém pedir é real.
 *
 * Aqui o HTML é o próprio estado: o que entra é o que sai. Quem decide o que
 * pode ficar é `limparCorpo`, na API — o mesmo sanitizador do modelo.
 */
export const DocumentEditor = ({
  documentId,
  corpo,
  corpoOriginal,
  voltarPara,
}: {
  documentId: string;
  corpo: string;
  corpoOriginal: string | null;
  voltarPara: string;
}) => {
  const area = useRef<HTMLDivElement>(null);
  const [ocupado, setOcupado] = useState<"salvando" | "emitindo" | "descartando" | null>(null);
  const [sujo, setSujo] = useState(false);

  /**
   * Colar de um documento do Word traz `<font>`, `<o:p>`, classes do Office e
   * style de mais. Nada disso passaria pelo sanitizador da API, mas até lá o
   * usuário veria o texto formatado de um jeito e salvo de outro. Colar como
   * texto puro evita a surpresa.
   */
  const colarSemFormato = (evento: React.ClipboardEvent) => {
    evento.preventDefault();
    const texto = evento.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, texto);
  };

  const formatar = (comando: "bold" | "italic" | "underline") => {
    document.execCommand(comando);
    area.current?.focus();
    setSujo(true);
  };

  const corpoAtual = () => area.current?.innerHTML ?? corpo;

  const salvar = async (): Promise<boolean> => {
    setOcupado("salvando");
    const resultado = await saveDraftBody(documentId, corpoAtual());
    setOcupado(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return false;
    }
    setSujo(false);
    toast.success(resultado.success ?? "Texto salvo");
    return true;
  };

  const emitir = async () => {
    // Salvar antes de emitir: o usuário pensa nos dois como um ato só, e
    // emitir com o texto antigo seria a pior forma de descobrir que não são.
    if (sujo && !(await salvar())) return;

    setOcupado("emitindo");
    const resultado = await issueDraft(documentId, voltarPara);
    setOcupado(null);
    if (resultado?.error) toast.error(resultado.error);
  };

  const descartar = async () => {
    setOcupado("descartando");
    const resultado = await discardDraft(documentId, voltarPara);
    setOcupado(null);
    if (resultado?.error) toast.error(resultado.error);
  };

  const desfazer = () => {
    if (!area.current || !corpoOriginal) return;
    area.current.innerHTML = corpoOriginal;
    setSujo(true);
    toast.info("Texto do modelo restaurado — salve para confirmar");
  };

  return (
    <div className={styles.editor}>
      <Alert tone="info">
        Este documento ainda é um <strong>rascunho</strong>. Ajuste o texto e as datas do jeito
        que precisar; ele só passa a valer, e a ser conferível pelo código, quando você emitir.
      </Alert>

      <div className={styles.barra}>
        <div className={styles.grupo}>
          <button type="button" onClick={() => formatar("bold")} title="Negrito" aria-label="Negrito">
            <Bold size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => formatar("italic")} title="Itálico" aria-label="Itálico">
            <Italic size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => formatar("underline")}
            title="Sublinhado"
            aria-label="Sublinhado"
          >
            <Underline size={15} aria-hidden="true" />
          </button>
          {corpoOriginal ? (
            <button
              type="button"
              onClick={desfazer}
              title="Voltar ao texto do modelo"
              aria-label="Voltar ao texto do modelo"
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className={styles.grupo_direita}>
          {sujo ? <span className={styles.pendente}>alterações não salvas</span> : null}

          <Button
            type="button"
            variant="secondary"
            onClick={() => void salvar()}
            disabled={ocupado !== null || !sujo}
          >
            <Save size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            {ocupado === "salvando" ? "Salvando…" : "Salvar"}
          </Button>

          <Button type="button" onClick={() => void emitir()} disabled={ocupado !== null}>
            <Send size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            {ocupado === "emitindo" ? "Emitindo…" : "Emitir documento"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => void descartar()}
            disabled={ocupado !== null}
            title="Descartar rascunho"
          >
            <Trash2 size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/*
        `suppressContentEditableWarning`: o React avisa sobre children de um nó
        editável, e é exatamente o que se quer aqui — o navegador é o dono do
        conteúdo enquanto se edita, e o React não deve reconciliá-lo.
      */}
      <div
        ref={area}
        className={styles.area}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Corpo do documento"
        onInput={() => setSujo(true)}
        onPaste={colarSemFormato}
        dangerouslySetInnerHTML={{ __html: corpo }}
      />
    </div>
  );
};
