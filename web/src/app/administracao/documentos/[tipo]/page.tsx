import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { findTemplate, getMarkerCatalog } from "@/features/documents/queries";
import { TemplateForm } from "@/features/documents/components/TemplateForm";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { PageHeader } from "@/shared/ui/layout";

type TemplatePageProps = { params: Promise<{ tipo: string }> };

export default async function TemplatePage({ params }: TemplatePageProps) {
  await requirePermission("documents:template");
  const { tipo } = await params;

  const [modelo, catalogo] = await Promise.all([
    findTemplate(tipo).catch((erro) => {
      if (erro instanceof ApiError && erro.status === 404) notFound();
      throw erro;
    }),
    getMarkerCatalog(tipo).catch((erro) => {
      if (erro instanceof ApiError && erro.status === 404) notFound();
      throw erro;
    }),
  ]);

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/administracao/documentos"
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Modelos de documento
        </Link>
      </p>

      <PageHeader
        title={modelo.nome}
        subtitle={
          modelo.origem === "PREFEITURA"
            ? "Versão personalizada desta prefeitura"
            : "Modelo padrão do sistema"
        }
      />

      <TemplateForm modelo={modelo} catalogo={catalogo} />
    </>
  );
}
