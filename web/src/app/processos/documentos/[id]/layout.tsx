/**
 * Documento sai da casca do módulo: peça oficial não leva sidebar nem topbar.
 * O layout de /processos continua acima, então guard de módulo e sessão valem.
 */
export default function DocumentLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--fundo)", minHeight: "100vh" }}>{children}</div>;
}
