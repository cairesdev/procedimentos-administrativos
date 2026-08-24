"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { saveLetterhead, uploadLetterheadLogo } from "../actions";
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
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [enviando, iniciarEnvio] = useTransition();
  // Muda a query da imagem depois do upload: sem isso o navegador serve a
  // logomarca antiga do cache e parece que nada aconteceu.
  const [versaoLogo, setVersaoLogo] = useState(() => Date.now());
  const [temLogo, setTemLogo] = useState(Boolean(letterhead.arquivoLogomarca));

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

  const enviarLogomarca = () => {
    const arquivo = campoArquivo.current?.files?.[0];
    if (!arquivo) {
      toast.error("Escolha um arquivo de imagem");
      return;
    }

    const dados = new FormData();
    dados.append("arquivo", arquivo);

    iniciarEnvio(async () => {
      const resultado = await uploadLetterheadLogo(tenant.id, dados);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.success);
      if (campoArquivo.current) campoArquivo.current.value = "";
      setTemLogo(true);
      setVersaoLogo(Date.now());
    });
  };

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
      <div style={{ display: "grid", gap: "10px", borderTop: "1px solid var(--borda)", paddingTop: "14px" }}>
        {temLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- servida pela API, sem otimização
          <img
            src={`/admin/prefeituras/${tenant.id}/logomarca?v=${versaoLogo}`}
            alt="Logomarca atual"
            style={{ height: "72px", width: "auto", objectFit: "contain", justifySelf: "start" }}
          />
        ) : null}

        <InputField
          ref={campoArquivo}
          name="arquivo"
          type="file"
          label="Logomarca"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hint="PNG, JPEG, WEBP ou SVG, até 2 MB."
        />

        <div>
          <Button type="button" variant="secondary" onClick={enviarLogomarca} disabled={enviando}>
            {enviando ? "Enviando…" : temLogo ? "Trocar logomarca" : "Enviar logomarca"}
          </Button>
        </div>
      </div>
    </div>
  );
};
