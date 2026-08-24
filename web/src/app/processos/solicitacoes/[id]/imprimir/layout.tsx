/**
 * Sai da casca do módulo: documento para imprimir não leva sidebar nem topbar.
 * O layout de /processos continua valendo acima, então o guard de módulo e a
 * sessão seguem aplicados — aqui só se remove o cromo visual.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--fundo)", minHeight: "100vh" }}>{children}</div>;
}
