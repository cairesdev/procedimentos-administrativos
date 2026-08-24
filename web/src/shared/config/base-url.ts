import { headers } from "next/headers";

/**
 * Endereço público do sistema, para montar o link do QR.
 *
 * Vem da própria requisição em vez de variável de ambiente: o QR precisa
 * apontar para o domínio pelo qual o usuário chegou, e uma configuração a mais
 * seria mais uma coisa para esquecer no deploy e só descobrir quando alguém
 * apontasse o celular para o papel.
 */
export const publicBaseUrl = async (): Promise<string> => {
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
  // Atrás da Cloudflare/Caddy o TLS termina antes; localhost segue em http.
  const protocolo =
    cabecalhos.get("x-forwarded-proto")
    ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocolo}://${host}`;
};
