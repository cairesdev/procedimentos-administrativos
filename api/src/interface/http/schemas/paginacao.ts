import { z } from "zod";
import { POR_PAGINA_MAXIMO, POR_PAGINA_PADRAO } from "../../../application/shared/Paginacao";

/**
 * `?pagina=2&porPagina=50` nas listas paginadas. O teto existe para o cliente
 * não pedir a tabela inteira de uma vez e derrubar a memória do processo.
 */
export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(POR_PAGINA_MAXIMO).default(POR_PAGINA_PADRAO),
});

export type PaginacaoQuery = z.infer<typeof paginacaoSchema>;
