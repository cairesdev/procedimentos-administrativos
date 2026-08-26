/**
 * Documento não leva sidebar nem topbar: peça oficial é folha, não tela.
 *
 * Esta rota fica **fora** dos workspaces de propósito. Um bem transferido e um
 * processo despachado produzem o mesmo tipo de papel, e prender a tela dentro
 * de /processos deixava quem tem papel PATRIMONIO ou FROTAS emitir a peça e
 * cair em tela travada ao tentar abri-la.
 */
export default function DocumentLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--fundo)", minHeight: "100vh" }}>{children}</div>;
}
