import Link from "next/link";

export type Tab = {
  rotulo: string;
  href: string;
  ativa: boolean;
  /** Número ao lado do rótulo — quantas esperam ação. */
  contagem?: number;
};

/**
 * Abas de uma tela.
 *
 * Nasceu inline na fila do setor e a segunda tela que precisou dela — a de
 * devoluções — teria copiado as mesmas doze linhas de estilo. Duas cópias já
 * são o começo de duas aparências.
 */
export const TabNav = ({ tabs }: { tabs: Tab[] }) => (
  <nav style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
    {tabs.map((tab) => (
      <Link
        key={tab.href}
        href={tab.href}
        style={{
          padding: "6px 12px",
          borderRadius: "6px",
          fontSize: "13px",
          textDecoration: "none",
          background: tab.ativa ? "var(--acao_suave)" : "transparent",
          color: tab.ativa ? "var(--acao)" : "var(--texto_suave)",
          fontWeight: tab.ativa ? 600 : 400,
        }}
      >
        {tab.rotulo}
        {/* Zero não vira contagem: "Respondidas 0" seria ruído onde o vazio
            já se explica sozinho. */}
        {tab.contagem ? (
          <span style={{ marginLeft: "6px", opacity: 0.7 }}>{tab.contagem}</span>
        ) : null}
      </Link>
    ))}
  </nav>
);
