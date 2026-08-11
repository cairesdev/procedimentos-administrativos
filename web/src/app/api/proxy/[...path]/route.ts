import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiBaseUrl } from "@/shared/api/http-client";

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
    },
    body: request.method === "GET" || request.method === "DELETE" ? undefined : request.body,
    // @ts-expect-error duplex é exigido pelo Node ao repassar streams
    duplex: "half",
    cache: "no-store",
  });

  const raw = await response.text();
  return new NextResponse(raw, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
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
