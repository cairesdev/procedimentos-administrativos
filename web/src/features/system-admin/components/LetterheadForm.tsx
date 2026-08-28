"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { removeLetterheadLogo, saveLetterhead, uploadLetterheadLogo, type LogoSide } from "../actions";
import { letterheadSchema, type LetterheadInput } from "../schemas";
import type { Letterhead, Tenant } from "../types";

export const LetterheadForm = ({
  tenant,
  letterhead,
}: {
  tenant: Tenant;
  letterhead: Letterhead;
}) => {
  const closeModal = useModalClose();
  const [enviando, iniciarEnvio] = useTransition();
  // Muda a query da imagem depois do upload: sem isso o navegador serve a
  // logomarca antiga do cache e parece que nada aconteceu.
  const [versaoLogo, setVersaoLogo] = useState(() => Date.now());
  const [temEsquerda, setTemEsquerda] = useState(Boolean(letterhead.arquivoLogomarca));
  const [temDireita, setTemDireita] = useState(Boolean(letterhead.arquivoLogomarcaDireita));

  const campoEsquerda = useRef<HTMLInputElement>(null);
  const campoDireita = useRef<HTMLInputElement>(null);

  const { form, onSubmit, isSubmitting } = useResourceForm<LetterheadInput>({
    schema: letterheadSchema as never,
    defaultValues: {
      cabecalhoTimbre: letterhead.cabecalhoTimbre ?? "",
      rodapeTimbre: letterhead.rodapeTimbre ?? "",
    },
    action: (values) => saveLetterhead(tenant.id, values),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  const campoDo = (lado: LogoSide) =>
    lado === "ESQUERDA" ? campoEsquerda : campoDireita;

  const marcar = (lado: LogoSide, tem: boolean) => {
    if (lado === "ESQUERDA") setTemEsquerda(tem);
    else setTemDireita(tem);
  };

  const enviarLogomarca = (lado: LogoSide) => {
    const campo = campoDo(lado);
    const arquivo = campo.current?.files?.[0];
    if (!arquivo) {
      toast.error("Escolha um arquivo de imagem");
      return;
    }

    const dados = new FormData();
    dados.append("arquivo", arquivo);

    iniciarEnvio(async () => {
      const resultado = await uploadLetterheadLogo(tenant.id, dados, lado);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.success);
      if (campo.current) campo.current.value = "";
      marcar(lado, true);
      setVersaoLogo(Date.now());
    });
  };

  const removerLogomarca = (lado: LogoSide) => {
    iniciarEnvio(async () => {
      const resultado = await removeLetterheadLogo(tenant.id, lado);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.success);
      marcar(lado, false);
      setVersaoLogo(Date.now());
    });
  };

  /** Um lado do timbre: prévia, escolha do arquivo, enviar e excluir. */
  const bloco = (lado: LogoSide, rotulo: string, tem: boolean, dica: string) => (
    <div style={{ display: "grid", gap: "10px", alignContent: "start" }}>
      <strong style={{ fontSize: "13px" }}>{rotulo}</strong>

      {tem ? (
        // eslint-disable-next-line @next/next/no-img-element -- servida pela API, sem otimização
        <img
          src={`/admin/prefeituras/${tenant.id}/logomarca?lado=${lado}&v=${versaoLogo}`}
          alt={`Logomarca ${rotulo.toLowerCase()}`}
          style={{ height: "72px", width: "auto", objectFit: "contain", justifySelf: "start" }}
        />
      ) : (
        <span style={{ fontSize: "12px", color: "var(--texto_apagado)" }}>Nenhuma imagem.</span>
      )}

      <InputField
        ref={campoDo(lado)}
        name={`arquivo_${lado}`}
        type="file"
        label="Imagem"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hint={dica}
      />

      <div style={{ display: "flex", gap: "8px" }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => enviarLogomarca(lado)}
          disabled={enviando}
        >
          {enviando ? "Enviando…" : tem ? "Trocar" : "Enviar"}
        </Button>

        {tem ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => removerLogomarca(lado)}
            disabled={enviando}
          >
            Excluir
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <Alert tone="info">
        Usado nos documentos impressos pela prefeitura — a solicitação já sai com este timbre.
      </Alert>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
        <TextareaField
          label="Cabeçalho"
          placeholder="PREFEITURA MUNICIPAL DE… — ESTADO DO MARANHÃO"
          {...form.register("cabecalhoTimbre")}
        />
        <TextareaField
          label="Rodapé"
          placeholder="Praça Central, s/n — CEP 65400-000"
          {...form.register("rodapeTimbre")}
        />

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar timbre"}
          </Button>
        </div>
      </form>

      {/* Fora do form de cima: upload é requisição própria, não pode ir junto. */}
      <div style={{ borderTop: "1px solid var(--borda)", paddingTop: "14px" }}>
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--texto_suave)" }}>
          As duas saem lado a lado no topo da folha, com o cabeçalho entre elas. Prefeitura
          costuma pôr o brasão do município à esquerda e a marca do programa ou da secretaria à
          direita — FUNDEB, PNAE, Governo do Estado.
        </p>

        <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          {bloco("ESQUERDA", "Logomarca à esquerda", temEsquerda, "PNG, JPEG, WEBP ou SVG, até 2 MB.")}
          {bloco("DIREITA", "Logomarca à direita", temDireita, "Opcional.")}
        </div>
      </div>
    </div>
  );
};
