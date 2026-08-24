"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Alert, Badge, Table } from "@/shared/ui/layout";
import { registerInventoryChecks, closeInventory } from "../actions";
import { CONSERVATION_STATES, type ConservationState, type InventoryDetail } from "../types";
import styles from "./InventorySheet.module.css";

type Draft = {
  situacao: "ENCONTRADO" | "NAO_ENCONTRADO" | null;
  estadoObservado: ConservationState | "";
  observacao: string;
};

const stateLabel = (state: string) =>
  CONSERVATION_STATES.find((item) => item.value === state)?.label ?? state;

const PAGE_SIZES = [25, 50, 100];

// Folha de conferência: marca item a item e envia em lote. O que já foi
// conferido antes vem preenchido e pode ser corrigido.
export const InventorySheet = ({
  inventory,
  canWrite,
}: {
  inventory: InventoryDetail;
  canWrite: boolean;
}) => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]!);
  const [page, setPage] = useState(0);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      inventory.itens.map((item) => [
        item.bemId,
        {
          situacao: item.situacao,
          estadoObservado: item.estadoObservado ?? "",
          observacao: item.observacao ?? "",
        },
      ]),
    ),
  );

  const closed = inventory.status === "CONCLUIDO";
  const editable = canWrite && !closed;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return inventory.itens;
    return inventory.itens.filter(
      (item) =>
        item.codigoTombamento.toLowerCase().includes(term) ||
        item.nome.toLowerCase().includes(term),
    );
  }, [inventory.itens, search]);

  // Local com centenas de bens: pagina na tela, mas o rascunho é do inventário
  // inteiro — trocar de página não perde o que já foi marcado.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const checked = Object.values(drafts).filter((draft) => draft.situacao).length;
  const missing = Object.values(drafts).filter(
    (draft) => draft.situacao === "NAO_ENCONTRADO",
  ).length;
  // Só o que já foi gravado conta para concluir — rascunho na tela não basta.
  const pending = inventory.esperados - inventory.conferidos;

  const update = (bemId: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [bemId]: { ...current[bemId]!, ...patch } }));

  // Vale para tudo que o filtro alcança, não só a página aberta.
  const markAllFound = () => {
    const scope = new Set(filtered.map((item) => item.bemId));
    setDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).map(([bemId, draft]) => [
          bemId,
          draft.situacao || !scope.has(bemId)
            ? draft
            : { ...draft, situacao: "ENCONTRADO" as const },
        ]),
      ),
    );
  };

  const save = async () => {
    const itens = Object.entries(drafts)
      .filter(([, draft]) => draft.situacao)
      .map(([bemId, draft]) => ({
        bemId,
        situacao: draft.situacao!,
        estadoObservado: draft.estadoObservado || undefined,
        observacao: draft.observacao.trim() || undefined,
      }));

    if (itens.length === 0) {
      toast.error("Marque ao menos um bem como encontrado ou não encontrado");
      return;
    }

    setSaving(true);
    const result = await registerInventoryChecks(inventory.id, { itens });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${itens.length} conferência(s) registrada(s)`);
    router.refresh();
  };

  const close = async () => {
    setClosing(true);
    const result = await closeInventory(inventory.id);
    setClosing(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Inventário concluído");
    router.refresh();
  };

  return (
    <>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Buscar por tombamento ou nome…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        {editable ? (
          <Button type="button" variant="secondary" onClick={markAllFound}>
            Marcar pendentes como encontrados
          </Button>
        ) : null}

        <label className={styles.page_size}>
          Por página
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {closed ? (
        <Alert tone="info">
          Inventário concluído. As divergências ficam registradas aqui; o que fazer com cada bem
          não encontrado — localizar ou dar baixa — é decisão de quem administra o patrimônio.
        </Alert>
      ) : null}

      <Table
        columns={["Tombamento", "Bem", "Estado registrado", "Situação", "Estado observado", "Observação"]}
        isEmpty={visible.length === 0}
        emptyMessage="Nenhum bem neste local."
      >
        {visible.map((item) => {
          const draft = drafts[item.bemId]!;
          return (
            <tr key={item.bemId}>
              <td>
                <strong>{item.codigoTombamento}</strong>
              </td>
              <td>{item.nome}</td>
              <td>
                <Badge tone="neutral">{stateLabel(item.estadoRegistrado)}</Badge>
              </td>
              <td>
                {editable ? (
                  <span className={styles.choice}>
                    <button
                      type="button"
                      className={styles.choice_found}
                      data-selected={draft.situacao === "ENCONTRADO"}
                      onClick={() => update(item.bemId, { situacao: "ENCONTRADO" })}
                    >
                      Encontrado
                    </button>
                    <button
                      type="button"
                      className={styles.choice_missing}
                      data-selected={draft.situacao === "NAO_ENCONTRADO"}
                      onClick={() => update(item.bemId, { situacao: "NAO_ENCONTRADO" })}
                    >
                      Não achado
                    </button>
                  </span>
                ) : draft.situacao ? (
                  <Badge tone={draft.situacao === "ENCONTRADO" ? "success" : "warning"}>
                    {draft.situacao === "ENCONTRADO" ? "encontrado" : "não encontrado"}
                  </Badge>
                ) : (
                  "—"
                )}
              </td>
              <td>
                {editable ? (
                  <select
                    className={styles.state_select}
                    value={draft.estadoObservado}
                    onChange={(event) =>
                      update(item.bemId, {
                        estadoObservado: event.target.value as ConservationState | "",
                      })
                    }
                    disabled={draft.situacao !== "ENCONTRADO"}
                    aria-label={`Estado observado de ${item.codigoTombamento}`}
                  >
                    <option value="">Sem mudança</option>
                    {CONSERVATION_STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  stateLabel(draft.estadoObservado || item.estadoRegistrado)
                )}
              </td>
              <td>
                {editable ? (
                  <input
                    className={styles.note}
                    value={draft.observacao}
                    onChange={(event) => update(item.bemId, { observacao: event.target.value })}
                    placeholder="Opcional"
                    aria-label={`Observação de ${item.codigoTombamento}`}
                  />
                ) : (
                  draft.observacao || "—"
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      {pageCount > 1 ? (
        <nav className={styles.pager} aria-label="Páginas da folha de conferência">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
          >
            Anterior
          </Button>
          <span className={styles.counter}>
            Página {currentPage + 1} de {pageCount} · {filtered.length} bens
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= pageCount - 1}
          >
            Próxima
          </Button>
        </nav>
      ) : null}

      {editable ? (
        <div className={styles.footer}>
          <span className={styles.counter}>
            {checked} de {inventory.itens.length} marcados · {missing} não encontrado(s) ·{" "}
            {pending} pendente(s) de gravação
          </span>
          <span style={{ display: "flex", gap: "8px" }}>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar conferência"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={closing || pending > 0}
              title={pending > 0 ? "Confira todos os bens antes de concluir" : undefined}
            >
              {closing ? "Concluindo…" : "Concluir inventário"}
            </Button>
          </span>
        </div>
      ) : null}
    </>
  );
};
