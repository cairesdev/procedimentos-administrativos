import type { ReactNode } from "react";

/**
 * Conferência pública: fora de qualquer módulo e sem sessão. Quem abre é o
 * cidadão ou o fornecedor com o papel na mão, e não tem login no sistema.
 */
export default function ConferenciaLayout({ children }: { children: ReactNode }) {
  return <div style={{ background: "var(--fundo)", minHeight: "100vh" }}>{children}</div>;
}
