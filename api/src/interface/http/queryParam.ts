import type { Request } from "express";

/**
 * Um filtro da querystring, com **vazio valendo ausente**.
 *
 * O `<select>` de "Todos os locais" tem `value=""`. Clicar em Filtrar manda
 * `?local=` — presente e vazio —, e o `typeof … === "string"` que cada rota
 * escrevia à mão devolvia `""`. O `""` seguia até o SQL como `$n::uuid` e o
 * Postgres respondia `invalid input syntax for type uuid: ""`: a tela inteira
 * caía com "Erro interno".
 *
 * Quatro telas do almoxarifado quebravam assim, e as de patrimônio e contratos
 * tinham o mesmo campo pelo mesmo caminho. O `?tipo=` escapava só porque `tipo`
 * é texto — o mesmo descuido, sem o sintoma.
 *
 * Campo em branco quer dizer "não filtre por isto". `undefined` é como as
 * consultas já escrevem essa ideia, e é o que este helper devolve.
 */
export const filtroDaQuery = (req: Request, chave: string): string | undefined => {
  const valor = req.query[chave];
  if (typeof valor !== "string") return undefined;
  const limpo = valor.trim();
  return limpo === "" ? undefined : limpo;
};
