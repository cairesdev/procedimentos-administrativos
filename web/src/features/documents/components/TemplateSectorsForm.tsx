"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Alert, Card } from "@/shared/ui/layout";
import { saveTemplateSectors } from "../actions";
import { SECTOR_TYPES } from "../types";

/**
 * Quem emite esta peça.
 *
 * Sem setor marcado, a peça vale para todos — é o comportamento de sempre, e é
 * o que mantém no ar os modelos que já existiam. Marcando, ela some da lista de
 * emissão de quem não é daqueles setores: o parecer da controladoria deixa de
 * aparecer para o resto da prefeitura.
 *
 * O corte é pelo **setor da lotação**, não pelo papel. O processo tramita entre
 * setores, e é lá que a peça nasce — um servidor com papel SERVIDOR lotado em
 * Compras emite a ordem; o mesmo papel lotado na escola, não.
 */
export const TemplateSectorsForm = ({
  tipo,
  atuais,
  podeRestringir,
}: {
  tipo: string;
  atuais: string[];
  podeRestringir: boolean;
}) => {
  const [marcados, setMarcados] = useState<string[]>(atuais);
  const [salvando, iniciarSalvamento] = useTransition();

  const alternar = (setor: string) =>
    setMarcados((atual) =>
      atual.includes(setor) ? atual.filter((item) => item !== setor) : [...atual, setor]);

  const salvar = () =>
    iniciarSalvamento(async () => {
      const resultado = await saveTemplateSectors(tipo, marcados);
      if (resultado.error) toast.error(resultado.error);
      else toast.success(resultado.success ?? "Setores atualizados");
    });

  return (
    <Card title="Quem emite esta peça">
      {podeRestringir ? null : (
        <div style={{ marginBottom: "12px" }}>
          <Alert tone="info">
            Este é o modelo padrão do produto, usado por todas as prefeituras. Salve uma versão
            desta prefeitura antes de restringir quem a emite.
          </Alert>
        </div>
      )}

      <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--texto_suave)" }}>
        Sem nenhum setor marcado, qualquer servidor que possa emitir documentos alcança esta
        peça. Marcando, ela aparece só para quem está lotado nos setores escolhidos.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
        {SECTOR_TYPES.map((setor) => {
          const ativo = marcados.includes(setor.value);
          return (
            <label
              key={setor.value}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                border: `1px solid ${ativo ? "var(--acao)" : "var(--borda)"}`,
                borderRadius: "999px",
                fontSize: "13px",
                cursor: podeRestringir ? "pointer" : "not-allowed",
                background: ativo ? "var(--acao_suave)" : "transparent",
                color: ativo ? "var(--acao)" : "var(--texto_suave)",
                opacity: podeRestringir ? 1 : 0.6,
              }}
            >
              <input
                type="checkbox"
                checked={ativo}
                disabled={!podeRestringir}
                onChange={() => alternar(setor.value)}
              />
              {setor.label}
            </label>
          );
        })}
      </div>

      <Button type="button" onClick={salvar} disabled={!podeRestringir || salvando}>
        {salvando ? "Salvando…" : marcados.length === 0 ? "Liberar para todos" : "Salvar setores"}
      </Button>
    </Card>
  );
};
