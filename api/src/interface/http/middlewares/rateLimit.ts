import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

/**
 * Quem chama a API é o servidor Next, pela rede interna — nunca o navegador.
 * Então o IP do socket é sempre o mesmo container e não serve para diferenciar
 * ninguém: o Next repassa o IP real em `X-Client-IP`, e é nele que os limites
 * se apoiam. Confiar nesse cabeçalho só é seguro porque a porta da API não é
 * publicada; se um dia ela for exposta, o cabeçalho vira mentira do cliente.
 */
export const ipDoCliente = (req: Request): string => {
  const repassado = req.get("x-client-ip");
  return repassado?.trim() || req.ip || "desconhecido";
};

const excedido = (mensagem: string) => ({
  message: mensagem,
});

/**
 * Freio de força bruta no login. A chave é o identificador tentado somado ao
 * IP: assim, tentar mil senhas de um usuário trava aquele usuário, e varrer
 * mil usuários do mesmo lugar trava aquele lugar.
 *
 * `skipSuccessfulRequests` deixa quem acerta a senha fora da conta — só erro
 * consome cota, então uso legítimo nunca esbarra no limite.
 */
export const limiteDeLogin = rateLimit({
  windowMs: 60_000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const corpo = req.body as { identificador?: unknown; email?: unknown } | undefined;
    const tentado = typeof corpo?.identificador === "string"
      ? corpo.identificador
      : typeof corpo?.email === "string"
        ? corpo.email
        : "";
    return `${ipKeyGenerator(ipDoCliente(req))}|${tentado.trim().toLowerCase()}`;
  },
  message: excedido(
    "Muitas tentativas de acesso. Aguarde um minuto antes de tentar de novo.",
  ),
});

/**
 * Teto geral, contra laço acidental no front e cliente automatizado — não
 * contra ataque distribuído, que se resolve na borda (Cloudflare).
 * A chave é o usuário autenticado quando existe; sem token, o IP.
 */
export const limiteGlobal = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.sessao?.usuarioId ?? req.admin?.adminId ?? ipKeyGenerator(ipDoCliente(req)),
  message: excedido("Requisições demais em pouco tempo. Aguarde um minuto."),
});
