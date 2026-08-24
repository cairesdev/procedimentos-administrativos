import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiBaseUrl } from "@/shared/api/http-client";
import { clientIpHeader } from "@/shared/api/client-ip";

// Ponte para os casos client-side (upload de anexo, autocomplete):
// o token nunca chega ao navegador, o proxy injeta no caminho.
const forward = async (request: Request, path: string[]) => {
  const session = await auth();
  if (!session) return NextResponse.json({ message: "Sessão expirada" }, { status: 401 });

  const url = new URL(request.url);
  const target = `${apiBaseUrl}/${path.join("/")}${url.search}`;
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.startsWith("multipart/form-data");

  const response = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(contentType && !isMultipart ? { "Content-Type": contentType } : {}),
      ...(await clientIpHeader()),
    },
    body: request.method === "GET" || request.method === "DELETE" ? undefined : request.body,
    // @ts-expect-error duplex é exigido pelo Node ao repassar streams
    duplex: "half",
    cache: "no-store",
  });

  // Repassa o corpo como stream: ler com .text() corromperia download de
  // anexo (PDF, imagem) e carregaria o arquivo inteiro na memória.
  const headers = new Headers();
  for (const cabecalho of ["content-type", "content-length", "content-disposition"]) {
    const valor = response.headers.get(cabecalho);
    if (valor) headers.set(cabecalho, valor);
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");

  return new NextResponse(response.body, { status: response.status, headers });
};

type Contexto = { params: Promise<{ path: string[] }> };

export const GET = async (request: Request, { params }: Contexto) =>
  forward(request, (await params).path);
export const POST = async (request: Request, { params }: Contexto) =>
  forward(request, (await params).path);
export const PUT = async (request: Request, { params }: Contexto) =>
  forward(request, (await params).path);
export const PATCH = async (request: Request, { params }: Contexto) =>
  forward(request, (await params).path);
export const DELETE = async (request: Request, { params }: Contexto) =>
  forward(request, (await params).path);
