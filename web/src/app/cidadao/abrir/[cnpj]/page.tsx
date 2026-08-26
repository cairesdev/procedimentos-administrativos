import Link from "next/link";
import { notFound } from "next/navigation";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { PublicRequestForm, type PublicSubject } from "@/features/protocol/components/PublicRequestForm";
import { PageHeader } from "@/shared/ui/layout";

type AberturaPublicaProps = { params: Promise<{ cnpj: string }> };

type PrefeituraPublica = {
  nome: string;
  municipio: string;
  uf: string;
  assuntos: PublicSubject[];
};

/**
 * Portal do cidadão. A prefeitura vem no endereço, pelo CNPJ, e não existe
 * listagem: quem chega vem pelo site da própria prefeitura. Publicar a lista
 * de quem usa o sistema entregaria a carteira de clientes do produto.
 */
export default async function AbrirPedidoPage({ params }: AberturaPublicaProps) {
  const { cnpj } = await params;

  const prefeitura = await apiRequest<PrefeituraPublica>(
    `/publico/prefeituras/${encodeURIComponent(cnpj)}`,
  ).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 20px", display: "grid", gap: "18px", alignContent: "start" }}>
      <PageHeader
        title="Abrir pedido"
        subtitle={`${prefeitura.nome} — ${prefeitura.municipio}/${prefeitura.uf}`}
      />

      <PublicRequestForm cnpj={cnpj.replace(/\D/g, "")} assuntos={prefeitura.assuntos} />

      <p style={{ marginTop: "18px", fontSize: "12.5px", color: "var(--texto_suave)" }}>
        Já tem um protocolo?{" "}
        <Link href="/cidadao" style={{ color: "var(--acao)" }}>
          Acompanhe o andamento
        </Link>
        .
      </p>
    </div>
  );
}
