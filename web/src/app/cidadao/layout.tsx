import type { ReactNode } from "react";

/**
 * Acompanhamento público: sem sessão e fora de qualquer módulo. Quem abre é o
 * cidadão com o comprovante na mão, que não tem login no sistema.
 */
export default function ProtocoloPublicoLayout({ children }: { children: ReactNode }) {
  return <div style={{ background: "var(--fundo)", minHeight: "100vh" }}>{children}</div>;
}
