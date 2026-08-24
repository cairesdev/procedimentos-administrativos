import { headers } from "next/headers";

/**
 * IP real de quem está usando o sistema, para a API aplicar rate-limit.
 *
 * O Express só enxerga o container do Next — sem repassar isto, todo mundo
 * dividiria o mesmo balde e o primeiro usuário a errar a senha travaria a
 * prefeitura inteira. A ordem segue a cadeia: Cloudflare, depois Caddy.
 */
export const clientIpHeader = async (): Promise<Record<string, string>> => {
  try {
    const cabecalhos = await headers();
    const ip =
      cabecalhos.get("cf-connecting-ip")
      ?? cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? cabecalhos.get("x-real-ip");

    return ip ? { "X-Client-IP": ip } : {};
  } catch {
    // Fora de uma requisição (build, geração estática) não há IP nenhum —
    // seguir sem o cabeçalho é melhor que derrubar a chamada.
    return {};
  }
};
