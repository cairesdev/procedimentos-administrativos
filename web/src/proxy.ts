import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { ModuleName } from "@/features/auth/types";

// Rotas que só existem quando o módulo está habilitado para a prefeitura.
const moduleRoutes: Record<string, ModuleName> = {
  "/processos": "PROCESSOS",
  "/patrimonio": "PATRIMONIO",
  "/frotas": "FROTAS",
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
  // `conferencia` fora do matcher: é a página que o QR do documento abre, e
  // quem confere é o cidadão ou o fornecedor, que não tem login aqui.
  //
  // Cada exceção termina em `(?:/|$)` de propósito. Sem isso, o prefixo solto
  // `admin` também casava `/administracao/...`, e o sistema inteiro de
  // administração ficava fora da checagem de sessão do proxy — só as guardas
  // de página seguravam. Página nova que esquecesse a guarda ficaria aberta.
  matcher: [
    "/((?!login(?:/|$)|admin(?:/|$)|conferencia(?:/|$)|protocolo(?:/|$)|modulo-indisponivel(?:/|$)|api/auth(?:/|$)|api/publico(?:/|$)|_next/static|_next/image|favicon.ico).*)",
  ],
};
