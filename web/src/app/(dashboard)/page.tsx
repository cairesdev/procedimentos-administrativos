import { auth } from "@/auth";
import { listUnits } from "@/features/units/queries";
import { Badge, Card, Columns, PageHeader } from "@/shared/ui/layout";

export default async function HomePage() {
  const [session, units] = await Promise.all([auth(), listUnits()]);

  return (
    <>
      <PageHeader title="Início" subtitle="Visão geral desta prefeitura" />

      <Columns>
        <Card title="Base cadastral">
          <p style={{ fontSize: "26px", fontWeight: 600 }}>{units.length}</p>
          <p style={{ fontSize: "13px", color: "var(--texto_suave)" }}>unidades cadastradas</p>
        </Card>

        <Card title="Módulos habilitados">
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {session?.user.modules.map((module) => (
              <Badge key={module} tone="accent">
                {module.toLowerCase()}
              </Badge>
            ))}
          </div>
        </Card>
      </Columns>
    </>
  );
}
