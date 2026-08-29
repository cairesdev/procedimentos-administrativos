"use client";

import { useMemo, useState, type ClipboardEvent } from "react";
import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert, Card, Stack, SummaryGrid, Table } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { registerIntake } from "../actions";
import {
  CAMPOS_DA_ENTRADA, converterPlanilhaComSequencia, sugerirSequenciaDaEntrada,
  type PastedLine,
} from "../paste";
import type { ColumnChoice } from "@/shared/lib/column-mapping";
import { ColumnMapper } from "@/shared/ui/ColumnMapper";
import type { StockType, Warehouse } from "../types";

type Linha = PastedLine & { chave: string };

const linhaVazia = (): Linha => ({
  chave: crypto.randomUUID(),
  nome: "",
  unidade: "UN",
  quantidade: 0,
  dataValidade: null,
});

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Entrada de estoque: cabeçalho da remessa e os itens.
 *
 * A planilha é o caminho principal — é assim que o material chega, e digitar
 * duzentos itens à mão é o que faz o almoxarife desistir do sistema. Digitar
 * linha a linha continua possível para a entrada pequena.
 */
export const IntakeWizard = ({
  warehouses,
  types,
}: {
  warehouses: Warehouse[];
  types: StockType[];
}) => {
  const ativos = warehouses.filter((item) => item.ativo);
  const tiposAtivos = types.filter((item) => item.ativo);

  const [cabecalho, setCabecalho] = useState({
    almoxarifadoId: ativos[0]?.id ?? "",
    tipoEstoqueId: tiposAtivos[0]?.id ?? "",
    codigo: "",
    titulo: "",
    data: hoje(),
    localArmazenado: "",
    notaFiscal: "",
  });
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia()]);
  const [enviando, setEnviando] = useState(false);

  const preenchidas = useMemo(
    () => linhas.filter((linha) => linha.nome.trim() && linha.quantidade > 0),
    [linhas],
  );

  // O texto colado fica retido até o almoxarife confirmar o que é cada coluna.
  const [textoColado, setTextoColado] = useState("");
  const [sequencia, setSequencia] = useState<ColumnChoice<keyof PastedLine>[]>([]);

  /** A que vence antes, para o almoxarife ver o que precisa girar primeiro. */
  const primeiraValidade = useMemo(
    () =>
      preenchidas
        .map((linha) => linha.dataValidade)
        .filter((data): data is string => Boolean(data))
        .sort()[0],
    [preenchidas],
  );

  /**
   * Colar não importa: retém o texto e abre o mapeamento das colunas.
   *
   * Adivinhar a ordem funcionava até chegar a planilha com uma coluna a mais,
   * e aí a validade entrava como quantidade sem ninguém perceber. Agora o
   * almoxarife diz o que é cada coluna antes de qualquer linha entrar.
   */
  const receber = (texto: string) => {
    setTextoColado(texto);
    setSequencia(sugerirSequenciaDaEntrada(texto) ?? []);
  };

  const importar = () => {
    if (!sequencia.some((campo) => campo === "nome")) {
      toast.error("Aponte qual coluna é o produto — sem ela não dá para importar.");
      return;
    }

    const { linhas: coladas, ignoradas, datasInvalidas } = converterPlanilhaComSequencia(
      textoColado, sequencia,
    );

    if (coladas.length === 0) {
      toast.error("Nenhuma linha com produto e quantidade. Confira o que você marcou.");
      return;
    }

    setTextoColado("");
    setSequencia([]);

    setLinhas((atuais) => {
      // Descarta as linhas em branco que já estavam na tela: colar sobre um
      // formulário vazio não deve deixar uma linha fantasma no fim.
      const existentes = atuais.filter((linha) => linha.nome.trim());
      return [
        ...existentes,
        ...coladas.map((linha) => ({ ...linha, chave: crypto.randomUUID() })),
      ];
    });

    const avisos = [
      `${coladas.length} ${coladas.length === 1 ? "item lido" : "itens lidos"}`,
      ignoradas > 0 ? `${ignoradas} linha(s) sem produto ou quantidade foram ignoradas` : "",
      datasInvalidas > 0 ? `${datasInvalidas} data(s) não reconhecida(s) — confira a validade` : "",
    ].filter(Boolean);

    if (datasInvalidas > 0) toast.warning(avisos.join(". "));
    else toast.success(avisos.join(". "));
  };

  const alterar = (chave: string, campo: keyof PastedLine, valor: string) =>
    setLinhas((atuais) =>
      atuais.map((linha) =>
        linha.chave !== chave
          ? linha
          : {
              ...linha,
              [campo]:
                campo === "quantidade"
                  ? Number(valor.replace(",", ".")) || 0
                  : campo === "dataValidade"
                    ? valor || null
                    : valor,
            },
      ),
    );

  const enviar = async () => {
    if (!cabecalho.almoxarifadoId || !cabecalho.tipoEstoqueId) {
      toast.error("Escolha o almoxarifado e o tipo de estoque");
      return;
    }
    if (!cabecalho.codigo.trim() || !cabecalho.titulo.trim()) {
      toast.error("Informe o código e o título da remessa");
      return;
    }
    if (preenchidas.length === 0) {
      toast.error("A remessa precisa de ao menos um item");
      return;
    }

    setEnviando(true);
    // Sucesso redireciona para a remessa; só o erro volta com resultado.
    const resultado = await registerIntake({
      almoxarifadoId: cabecalho.almoxarifadoId,
      tipoEstoqueId: cabecalho.tipoEstoqueId,
      codigo: cabecalho.codigo.trim(),
      titulo: cabecalho.titulo.trim(),
      data: cabecalho.data,
      localArmazenado: cabecalho.localArmazenado.trim() || undefined,
      notaFiscal: cabecalho.notaFiscal.trim() || undefined,
      linhas: preenchidas.map(({ chave: _chave, ...linha }) => linha),
    });
    setEnviando(false);
    if (resultado?.error) toast.error(resultado.error);
  };

  if (ativos.length === 0 || tiposAtivos.length === 0) {
    return (
      <Alert tone="info">
        Antes da primeira entrada é preciso ter{" "}
        {ativos.length === 0 ? "um almoxarifado" : "um tipo de estoque"} cadastrado e ativo.
      </Alert>
    );
  }

  return (
    <Stack>
      <Card title="Remessa">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <SelectField
            label="Almoxarifado"
            name="almoxarifadoId"
            required
            value={cabecalho.almoxarifadoId}
            onChange={(e) => setCabecalho({ ...cabecalho, almoxarifadoId: e.target.value })}
            options={ativos.map((item) => ({ value: item.id, label: item.nome }))}
          />
          <SelectField
            label="Tipo de estoque"
            name="tipoEstoqueId"
            required
            value={cabecalho.tipoEstoqueId}
            onChange={(e) => setCabecalho({ ...cabecalho, tipoEstoqueId: e.target.value })}
            options={tiposAtivos.map((item) => ({ value: item.id, label: item.nome }))}
          />
          <InputField
            label="Código"
            name="codigo"
            required
            placeholder="R-2026-001"
            hint="É por ele que se procura a remessa depois."
            value={cabecalho.codigo}
            onChange={(e) => setCabecalho({ ...cabecalho, codigo: e.target.value })}
          />
          <InputField
            label="Data de entrada"
            name="data"
            type="date"
            required
            value={cabecalho.data}
            onChange={(e) => setCabecalho({ ...cabecalho, data: e.target.value })}
          />
          <InputField
            label="Título"
            name="titulo"
            required
            wide
            placeholder="Gêneros alimentícios — 1ª remessa de agosto"
            value={cabecalho.titulo}
            onChange={(e) => setCabecalho({ ...cabecalho, titulo: e.target.value })}
          />
          <InputField
            label="Local armazenado"
            name="localArmazenado"
            placeholder="Depósito central, prateleira 3"
            value={cabecalho.localArmazenado}
            onChange={(e) => setCabecalho({ ...cabecalho, localArmazenado: e.target.value })}
          />
          <InputField
            label="Nota fiscal"
            name="notaFiscal"
            value={cabecalho.notaFiscal}
            onChange={(e) => setCabecalho({ ...cabecalho, notaFiscal: e.target.value })}
          />
        </div>
      </Card>

      <Card title="Itens">
        <Stack>
          <Alert tone="info">
            Cole a planilha aqui e diga o que é cada coluna. A validade aceita 31/12/2026 ou
            2026-12-31, e produto que ainda não existe entra no catálogo.
          </Alert>

          <textarea
            value={textoColado}
            onChange={(evento) => receber(evento.target.value)}
            placeholder="Clique aqui e cole (Ctrl+V) as linhas copiadas do Excel"
            rows={2}
            aria-label="Colar planilha"
            style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: "12px" }}
          />

          {textoColado ? (
            <>
              <ColumnMapper
                texto={textoColado}
                campos={CAMPOS_DA_ENTRADA}
                sequencia={sequencia}
                onChange={setSequencia}
                sugestao={sugerirSequenciaDaEntrada(textoColado)}
              />

              <div style={{ display: "flex", gap: "8px" }}>
                <Button type="button" onClick={importar}>
                  Importar linhas
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setTextoColado("");
                    setSequencia([]);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </>
          ) : null}

          <Table
            columns={["Produto", "Unidade", "Quantidade", "Validade", ""]}
            isEmpty={linhas.length === 0}
            emptyMessage="Nenhum item. Cole a planilha ou acrescente uma linha."
          >
            {linhas.map((linha) => (
              <tr key={linha.chave}>
                <td>
                  <input
                    value={linha.nome}
                    onChange={(e) => alterar(linha.chave, "nome", e.target.value)}
                    placeholder="ARROZ TIPO 1"
                    aria-label="Produto"
                    style={{ width: "100%" }}
                  />
                </td>
                <td style={{ width: "90px" }}>
                  <input
                    value={linha.unidade}
                    onChange={(e) => alterar(linha.chave, "unidade", e.target.value)}
                    aria-label="Unidade de medida"
                    style={{ width: "100%" }}
                  />
                </td>
                <td style={{ width: "120px" }}>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={linha.quantidade || ""}
                    onChange={(e) => alterar(linha.chave, "quantidade", e.target.value)}
                    aria-label="Quantidade"
                    style={{ width: "100%", textAlign: "right" }}
                  />
                </td>
                <td style={{ width: "160px" }}>
                  <input
                    type="date"
                    value={linha.dataValidade ?? ""}
                    onChange={(e) => alterar(linha.chave, "dataValidade", e.target.value)}
                    aria-label="Data de validade"
                    style={{ width: "100%" }}
                  />
                </td>
                <td style={{ width: "40px" }}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setLinhas((atuais) => atuais.filter((item) => item.chave !== linha.chave))
                    }
                    title="Remover linha"
                    aria-label={`Remover ${linha.nome || "linha"}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </Table>

          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLinhas((atuais) => [...atuais, linhaVazia()])}
            >
              <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              Acrescentar linha
            </Button>
          </div>
        </Stack>
      </Card>

      <Card title="Conferência">
        <Stack>
          <SummaryGrid
            items={[
              { label: "Itens a registrar", value: `${preenchidas.length}` },
              {
                label: "Com validade",
                value: `${preenchidas.filter((linha) => linha.dataValidade).length}`,
              },
              {
                label: "Validade mais próxima",
                value: primeiraValidade ? toDate(primeiraValidade) : "—",
              },
            ]}
          />

          <Alert tone="info">
            Cada linha vira um lote com saldo próprio. A saída para as unidades segue a validade —
            o que vence primeiro é sugerido primeiro.
          </Alert>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="button" onClick={() => void enviar()} disabled={enviando}>
              <ClipboardPaste size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {enviando ? "Registrando…" : `Registrar ${preenchidas.length} item(ns)`}
            </Button>
          </div>
        </Stack>
      </Card>
    </Stack>
  );
};
