import type { Request } from "express";
import type { LocaisAlcancados } from "../../../application/almoxarifado/ResolverAlcance";
import { container } from "../../../container";

declare module "express-serve-static-core" {
  interface Request {
    alcance?: LocaisAlcancados;
  }
}

/**
 * O alcance desta requisição, resolvido uma vez só.
 *
 * Mesma forma da memoização de permissões: várias consultas de uma tela
 * perguntam a mesma coisa, e sem isto cada uma faria duas idas ao banco para
 * descobrir de novo em que escola a pessoa trabalha.
 */
export const alcanceDe = async (req: Request): Promise<LocaisAlcancados> => {
  if (req.alcance) return req.alcance;
  req.alcance = await container.resolverAlcance.resolver(
    req.sessao!.orgaoId, req.sessao!.usuarioId,
  );
  return req.alcance;
};
