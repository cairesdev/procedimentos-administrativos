import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/shared/api/http-client";
import { clientIpHeader } from "@/shared/api/client-ip";

/**
 * Ponte pública para a abertura de pedido. Existe separada do `/api/proxy`
 * porque aquela exige sessão — aqui não há login, por definição.
 *
 * O IP real vai adiante: é nele que o limite por dispositivo se apoia, e sem
 * repassar todo o país sairia do mesmo balde (o do container do Next).
 */
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) => {
  const { cnpj } = await params;
  const corpo = await request.text();

  const resposta = await fetch(
    `${apiBaseUrl}/publico/prefeituras/${encodeURIComponent(cnpj)}/pedidos`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await clientIpHeader()) },
      body: corpo,
      cache: "no-store",
    },
  );

  const texto = await resposta.text();
  return new NextResponse(texto, {
    status: resposta.status,
    headers: { "content-type": "application/json" },
  });
};
