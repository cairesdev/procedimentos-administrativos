import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getGlobalMarkerCatalog, getGlobalTemplate } from "@/features/system-admin/queries";
import { GlobalTemplateForm } from "@/features/system-admin/components/GlobalTemplateForm";
import { PageHeader } from "@/shared/ui/layout";

type GlobalTemplatePageProps = { params: Promise<{ tipo: string }> };

export default async function GlobalTemplatePage({ params }: GlobalTemplatePageProps) {
  const { tipo } = await params;
  const [modelo, catalogo] = await Promise.all([
    getGlobalTemplate(tipo),
    getGlobalMarkerCatalog(tipo),
  ]);
  if (!modelo) notFound();

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/admin/modelos"
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Modelos padrão
        </Link>
      </p>

      <PageHeader title={modelo.nome} subtitle="Modelo padrão do produto" />
      <GlobalTemplateForm modelo={modelo} catalogo={catalogo} />
    </>
  );
}
