import { NextResponse } from "next/server";
import { readAdminToken } from "@/features/system-admin/session";
import { apiBaseUrl } from "@/shared/api/http-client";

/**
 * Pré-visualização da logomarca no painel do produto. O `/api/proxy` usa a
 * sessão do servidor da prefeitura; aqui quem manda é o token de admin.
 */
export const GET = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const token = await readAdminToken();
  if (!token) return NextResponse.json({ message: "Sessão expirada" }, { status: 401 });

  const { id } = await params;
  // O lado vem da query e é repassado; sem ele, a API entende ESQUERDA.
  const lado = new URL(request.url).searchParams.get("lado") === "DIREITA" ? "DIREITA" : "ESQUERDA";

  const resposta = await fetch(`${apiBaseUrl}/admin/orgaos/${id}/timbre/logomarca?lado=${lado}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const headers = new Headers();
  for (const cabecalho of ["content-type", "content-length"]) {
    const valor = resposta.headers.get(cabecalho);
    if (valor) headers.set(cabecalho, valor);
  }
  return new NextResponse(resposta.body, { status: resposta.status, headers });
};
