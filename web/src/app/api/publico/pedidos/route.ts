import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/shared/api/http-client";
import { clientIpHeader } from "@/shared/api/client-ip";

/**
 * Ponte pública das ações do requerente (ver exigências, responder, anexar).
 * O caminho real vai em `?acao=`, para uma rota só cobrir as três.
 *
 * Multipart passa em streaming — ler o corpo aqui carregaria o arquivo inteiro
 * na memória do Next sem necessidade.
 */
const ACOES = new Set(["exigencias", "responder", "anexos"]);

export const POST = async (request: Request) => {
  const acao = new URL(request.url).searchParams.get("acao") ?? "";
  if (!ACOES.has(acao)) {
    return NextResponse.json({ message: "Ação desconhecida" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.startsWith("multipart/form-data");

  const resposta = await fetch(`${apiBaseUrl}/publico/pedidos/${acao}`, {
    method: "POST",
    headers: {
      ...(contentType && !isMultipart ? { "Content-Type": contentType } : {}),
      ...(await clientIpHeader()),
    },
    body: request.body,
    // @ts-expect-error duplex é exigido pelo Node ao repassar streams
    duplex: "half",
    cache: "no-store",
  });

  const texto = await resposta.text();
  return new NextResponse(texto, {
    status: resposta.status,
    headers: { "content-type": "application/json" },
  });
};
