import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { withPage, type Page } from "@/shared/api/pagination";

export type EmailStatus = "PENDENTE" | "ENVIADO" | "FALHOU";

export type QueuedEmail = {
  id: string;
  orgaoId: string;
  tipo: string;
  destinatario: string;
  assunto: string;
  corpo: string;
  referenciaId: string | null;
  status: EmailStatus;
  tentativas: number;
  ultimoErro: string | null;
  agendadoPara: string;
  enviadoEm: string | null;
  criadoEm: string;
};

/**
 * A fila de e-mails da prefeitura.
 *
 * Fila sem onde olhar é fila que ninguém sabe que parou: sem esta tela, um
 * SMTP mal configurado acumularia exigências não entregues em silêncio até
 * alguém reclamar por telefone.
 */
export const listEmails = (pagina?: string) => {
  const query = new URLSearchParams();
  withPage(query, pagina);
  return apiRequest<Page<QueuedEmail>>(
    `${endpoints.emails}${query.size > 0 ? `?${query}` : ""}`,
  );
};
