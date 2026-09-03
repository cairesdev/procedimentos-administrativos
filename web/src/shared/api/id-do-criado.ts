/**
 * O id do registro criado, quando a operação devolveu um.
 *
 * `runAction` fazia `await operation()` e descartava o retorno: quem precisava
 * do id tinha de guardá-lo numa variável fora da closure. O padrão funciona e
 * é fácil de esquecer — e o esquecimento é mudo. `resultado.id` sai
 * `undefined`, a tela diz "a API não devolveu o identificador", e a API tinha
 * devolvido. Foi assim que a emissão de relatório quebrou.
 *
 * Mora fora de `action-result.ts` para poder ser testado sem bundler: aquele
 * arquivo puxa o cliente HTTP, que puxa a sessão do servidor.
 */
export const idDoCriado = (valor: unknown): string | undefined => {
  if (typeof valor !== "object" || valor === null || !("id" in valor)) return undefined;

  const { id } = valor as { id: unknown };

  /**
   * Só texto não vazio. Um `id` numérico ou nulo vindo de um endpoint que
   * responde outra coisa viraria uma rota como `/relatorios/undefined` — e é
   * melhor a tela dizer que não recebeu o id do que navegar para o nada.
   */
  return typeof id === "string" && id.trim() ? id : undefined;
};
