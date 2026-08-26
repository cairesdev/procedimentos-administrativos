import { redirect } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";
import { app } from "@/shared/config/app";

type ConferenciaPageProps = { searchParams: Promise<{ codigo?: string; erro?: string }> };

/** Formulário de consulta por código, para quem digita em vez de ler o QR. */
export default async function ConferenciaPage({ searchParams }: ConferenciaPageProps) {
  const { codigo, erro } = await searchParams;
  if (codigo?.trim()) redirect(`/conferencia/${encodeURIComponent(codigo.trim())}`);

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "40px 20px", display: "grid", gap: "18px", alignContent: "start" }}>
      <PageHeader
        title="Conferência de documento"
        subtitle={`Confira a autenticidade de um documento emitido pelo ${app.shortName}`}
      />

      {erro ? (
        <div style={{ marginBottom: "14px" }}>
          <Alert tone="error">
            Não encontramos documento com esse código. Confira a digitação — o código tem 12
            caracteres, em três grupos.
          </Alert>
        </div>
      ) : null}

      <Card>
        <form method="get" style={{ display: "grid", gap: "12px" }}>
          <label htmlFor="codigo" style={{ fontSize: "13px", fontWeight: 500 }}>
            Código verificador
          </label>
          <input
            id="codigo"
            name="codigo"
            required
            autoComplete="off"
            placeholder="XXXX-XXXX-XXXX"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: "16px", letterSpacing: "0.08em" }}
          />
          <div>
            <Button type="submit">Conferir</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
