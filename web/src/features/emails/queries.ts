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
/**
 * `atrasoEmMinutos` é o sinal de vida da fila.
 *
 * Nulo = nada atrasado. Um número grande significa que ninguém está
 * processando — worker parado, derrubado ou reiniciando em laço. É o que
 * transforma "fila parada" em algo visível: sem ele, a tela dizia "esperando
 * o próximo envio" enquanto o worker estava morto havia um dia.
 */
export const listEmails = (pagina?: string) => {
  const query = new URLSearchParams();
  withPage(query, pagina);
  return apiRequest<Page<QueuedEmail> & { atrasoEmMinutos: number | null }>(
    `${endpoints.emails}${query.size > 0 ? `?${query}` : ""}`,
  );
};
