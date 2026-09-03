"use client";

import { useState } from "react";
import { AlertTriangle, Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { SelectField } from "@/shared/ui/form-field";
import { Alert, Badge, Card, Stack, Table } from "@/shared/ui/layout";
import { ColumnMapper } from "@/shared/ui/ColumnMapper";
import type { ColumnChoice } from "@/shared/lib/column-mapping";
import { importStockPlaces, type ImportedPlaces } from "../actions";
import {
  CAMPOS_DO_LOCAL, converterPlanilhaDeLocais, sugerirSequenciaDeLocais,
  type CampoDoLocal,
} from "../locais-paste";
import type { Warehouse } from "../types";

/**
 * O cadastro de escolas do sistema antigo, em três passos na mesma tela.
 *
 * Cola, diz o que é cada coluna, confere a prévia. É o mesmo caminho da entrada
 * de estoque e dos itens de contrato — quem já importou uma planilha aqui não
 * reaprende nada.
 *
 * O relatório fica na tela depois de importar, e não vira só um toast: a
 * planilha do legado sempre tem uma escola repetida ou um CNPJ pela metade, e
 * é essa lista que diz quais linhas corrigir para rodar de novo.
 */
export const ImportPlaces = ({ warehouses }: { warehouses: Warehouse[] }) => {
  const ativos = warehouses.filter((item) => item.ativo);

  const [almoxarifadoId, setAlmoxarifadoId] = useState(ativos[0]?.id ?? "");
  const [texto, setTexto] = useState("");
  const [sequencia, setSequencia] = useState<ColumnChoice<CampoDoLocal>[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [relatorio, setRelatorio] = useState<ImportedPlaces | null>(null);

  const previa = texto ? converterPlanilhaDeLocais(texto, sequencia) : null;
  const mapeouNome = sequencia.includes("nome");
  const mapeouCodigo = sequencia.includes("codigo");

  const importar = async () => {
    if (!previa || previa.linhas.length === 0) {
      toast.error("Nenhuma linha para importar. Confira o que você marcou como Nome.");
      return;
    }

    setEnviando(true);
    const resposta = await importStockPlaces({
      almoxarifadoId: almoxarifadoId || null,
      linhas: previa.linhas,
    });
    setEnviando(false);

    if (resposta.error || !resposta.relatorio) {
      toast.error(resposta.error ?? "Não foi possível importar as escolas");
      return;
    }

    setRelatorio(resposta.relatorio);
    setTexto("");
    setSequencia([]);

    const { importados, ignorados } = resposta.relatorio;
    if (importados.length === 0) {
      toast.error(`Nenhuma escola entrou — ${ignorados.length} linha(s) ficaram de fora.`);
    } else {
      toast.success(
        `${importados.length} escola(s) importada(s)`
        + (ignorados.length > 0 ? `, ${ignorados.length} de fora` : ""),
      );
    }
  };

  return (
    <Stack>
      <Alert tone="info">
        Cole aqui a planilha de escolas do sistema antigo e diga o que é cada coluna.{" "}
        <strong>O que já existe é pulado</strong> — rodar a mesma planilha duas vezes não
        duplica nada, e a segunda passada mostra o que continua de fora.
      </Alert>

      {ativos.length === 0 ? (
        <Alert tone="error">
          Nenhum almoxarifado ativo. As escolas entram sem vínculo e não conseguem pedir
          material até você ligá-las a um.
        </Alert>
      ) : (
        <SelectField
          name="almoxarifadoId"
          label="As escolas desta planilha recebem de"
          hint="Dá para importar sem escolher e vincular depois, uma a uma."
          emptyOption="Sem vínculo por enquanto"
          options={ativos.map((item) => ({ value: item.id, label: item.nome }))}
          value={almoxarifadoId}
          onChange={(evento) => setAlmoxarifadoId(evento.target.value)}
        />
      )}

      <textarea
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Clique aqui e cole (Ctrl+V) as linhas copiadas do Excel"
        rows={3}
        aria-label="Colar planilha de escolas"
        style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: "12px" }}
      />

      {texto ? (
        <>
          <ColumnMapper
            texto={texto}
            campos={CAMPOS_DO_LOCAL}
            sequencia={sequencia}
            onChange={setSequencia}
            sugestao={sugerirSequenciaDeLocais(texto)}
          />

          {/* Sem nome não há o que importar; sem código a API recusa linha a
              linha. Dizer antes evita a ida ao servidor para ouvir isso. */}
          {!mapeouNome ? (
            <Alert tone="error">Marque qual coluna é o <strong>Nome</strong> da escola.</Alert>
          ) : null}
          {mapeouNome && !mapeouCodigo ? (
            <Alert tone="error">
              Nenhuma coluna marcada como <strong>Código</strong>. Sem ele a escola não entra —
              é por ele que o almoxarife identifica o local no romaneio.
            </Alert>
          ) : null}

          {previa && previa.linhas.length > 0 ? (
            <Card title={`Prévia — ${previa.linhas.length} escola(s)`} padded={false}>
              <Table
                columns={["Código", "Nome", "CNPJ", "Município"]}
                isEmpty={false}
                emptyMessage=""
              >
                {previa.linhas.slice(0, 8).map((linha, indice) => (
                  <tr key={`${linha.codigo ?? ""}-${indice}`}>
                    <td>{linha.codigo || "—"}</td>
                    <td>{linha.nome}</td>
                    <td>{linha.cnpj || "—"}</td>
                    <td>{linha.municipio || "—"}</td>
                  </tr>
                ))}
              </Table>
              {previa.linhas.length > 8 ? (
                <div style={{ padding: "8px 16px", fontSize: "12px" }}>
                  e mais {previa.linhas.length - 8} linha(s).
                </div>
              ) : null}
            </Card>
          ) : null}

          {previa && previa.ignoradas > 0 ? (
            <Alert tone="info">
              {previa.ignoradas} linha(s) sem nome foram descartadas antes de enviar — costuma
              ser rodapé, total ou linha de seção que veio junto na cópia.
            </Alert>
          ) : null}

          <div style={{ display: "flex", gap: "8px" }}>
            <Button type="button" onClick={() => void importar()} disabled={enviando || !mapeouNome}>
              <Upload size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {enviando ? "Importando…" : "Importar escolas"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setTexto(""); setSequencia([]); }}
            >
              Limpar
            </Button>
          </div>
        </>
      ) : null}

      {relatorio ? (
        <Stack>
          <Card title={`${relatorio.importados.length} escola(s) importada(s)`} padded={false}>
            <Table
              columns={["Código", "Nome", "Observação"]}
              isEmpty={relatorio.importados.length === 0}
              emptyMessage="Nenhuma escola nova entrou nesta planilha."
            >
              {relatorio.importados.map((local) => (
                <tr key={local.codigo}>
                  <td>{local.codigo}</td>
                  <td>{local.nome}</td>
                  <td>
                    {local.avisos.length === 0 ? (
                      <Badge tone="success">
                        <Check size={12} aria-hidden="true" /> completa
                      </Badge>
                    ) : (
                      <small>{local.avisos.join("; ")}</small>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>

          {relatorio.ignorados.length > 0 ? (
            <Card title={`${relatorio.ignorados.length} linha(s) de fora`} padded={false}>
              <Alert tone="info">
                Corrija estas linhas na planilha e cole de novo — o que já entrou não entra
                duas vezes.
              </Alert>
              <Table columns={["Linha", "Motivo"]} isEmpty={false} emptyMessage="">
                {relatorio.ignorados.map((linha) => (
                  <tr key={linha.linha}>
                    <td>
                      <AlertTriangle size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} />
                      {" "}{linha.linha}
                    </td>
                    <td>{linha.motivo}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
};
