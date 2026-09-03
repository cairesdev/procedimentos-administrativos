"use server";

import { apiRequest } from "@/shared/api/http-client";
import { runAction } from "@/shared/api/action-result";
import type { ReportFilters, ReportType } from "./types";

/**
 * Grava o recorte para a peça poder apontar para ele.
 *
 * A tela não salva nada enquanto se está consultando. Só quem vai emitir
 * precisa de um registro — e o que se grava é a pergunta, nunca a resposta.
 */
export const saveReportCut = async (tipo: ReportType, filtros: ReportFilters) =>
  runAction(async () => {
    const criado = await apiRequest<{ id: string }>("/relatorios", {
      method: "POST",
      body: {
        tipo,
        periodoInicio: filtros.inicio,
        periodoFim: filtros.fim,
        unidadeId: filtros.unidade || null,
        fornecedorId: filtros.fornecedor || null,
        modalidade: filtros.modalidade || null,
        setorId: filtros.setor || null,
      },
    });
    return criado;
  }, "Recorte salvo");
