import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { ModuleName } from "@/features/auth/types";

// Rotas que só existem quando o módulo está habilitado para a prefeitura.
const moduleRoutes: Record<string, ModuleName> = {
  "/licitacoes": "PROCESSOS",
  "/contratos": "PROCESSOS",
  "/solicitacoes": "PROCESSOS",
  "/processos": "PROCESSOS",
  "/fluxos": "PROCESSOS",
  "/frotas": "FROTAS",
  "/patrimonio": "PATRIMONIO",
  "/almoxarifado": "ALMOXARIFADO",
};

// Next 16: arquivo proxy.ts substitui middleware.ts.
export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (!request.auth) {
    const login = new URL("/login", request.url);
    login.searchParams.set("retorno", pathname);
    return NextResponse.redirect(login);
  }

  const required = Object.entries(moduleRoutes).find(([rota]) => pathname.startsWith(rota))?.[1];
  if (required && !request.auth.user.modules.includes(required)) {
    return NextResponse.redirect(new URL("/modulo-indisponivel", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!login|modulo-indisponivel|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
