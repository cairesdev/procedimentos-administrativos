import { notFound } from "next/navigation";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { PublicChecklistForm } from "@/features/checklists/components/PublicChecklistForm";
import styles from "@/features/checklists/components/Checklist.module.css";
import { app } from "@/shared/config/app";
import { Alert } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import type { PublicChecklist } from "@/features/checklists/public-types";

type PageProps = { params: Promise<{ token: string }> };

/**
 * O fornecedor cumprindo exigências, sem conta no sistema.
 *
 * A credencial é o token do endereço. Ele vê **só os itens que são dele** — o
 * checklist mistura exigências de vários setores, e mostrar a lista inteira
 * contaria a quem está de fora o que a prefeitura exige de si mesma.
 */
export default async function PublicChecklistPage({ params }: PageProps) {
  const { token } = await params;

  const dados = await apiRequest<PublicChecklist>(
    `/publico/checklist/${encodeURIComponent(token)}`,
  ).catch((erro) => {
    // Inválido, expirado e revogado dão o mesmo 404, de propósito: distinguir
    // contaria a quem tem um link velho que ele existiu.
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const pendentes = dados.itens.filter(
    (item) => item.situacao === "PENDENTE" || item.situacao === "VENCIDO",
  );

  return (
    <main className={styles.publico}>
      <header className={styles.publico_cabecalho}>
        <p className={styles.publico_orgao}>
          {dados.orgaoNome}
        </p>
        <h1 className={styles.publico_titulo}>{dados.titulo}</h1>
        {dados.descricao ? (
          <p className={styles.publico_orgao}>{dados.descricao}</p>
        ) : null}
      </header>

      {pendentes.length === 0 ? (
        <Alert tone="info">
          Não há nada pendente com você no momento. Se alguma entrega vencer, esta página volta a
          pedi-la — o endereço continua valendo até {toDate(dados.expiraEm)}.
        </Alert>
      ) : (
        <Alert tone="info">
          {pendentes.length === 1
            ? "Há uma exigência aguardando você."
            : `Há ${pendentes.length} exigências aguardando você.`}{" "}
          O que for enviado passa por conferência da prefeitura antes de ser dado por cumprido.
        </Alert>
      )}

      <PublicChecklistForm token={token} itens={dados.itens} />

      <footer className={styles.publico_rodape}>
        Este endereço é pessoal e vale até {toDate(dados.expiraEm)}. Não o repasse.
        <br />
        {app.name}
      </footer>
    </main>
  );
}
