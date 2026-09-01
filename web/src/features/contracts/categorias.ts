/** O mínimo que o agrupador precisa saber sobre um item. */
type ComCategoria = { categoria?: string | null };

export type Grupo<T> = {
  /** `null` é o bloco dos itens sem categoria. */
  categoria: string | null;
  itens: T[];
};

/**
 * Os itens do contrato, separados por categoria.
 *
 * Um contrato atende mais de uma frente ao mesmo tempo — o mesmo fornecedor
 * entrega para a saúde e para a educação. Sem separar, a lista chega ao
 * solicitante como uma parede de produtos em ordem alfabética, e quem pede
 * material da escola varre o que é do posto de saúde para achar o dele.
 *
 * Três decisões que o teste ao lado trava:
 *
 * - **Categoria vazia é ausência de categoria.** `""`, `"  "` e `null` caem no
 *   mesmo bloco. São o mesmo "sem categoria" para quem lê, e blocos separados
 *   seriam ruído sobre um detalhe de digitação.
 * - **O bloco sem categoria vai por último.** É o resto, e resto no meio da
 *   tela quebra a leitura das seções que têm nome.
 * - **A ordem dentro do grupo é a que chegou.** A consulta já ordena por
 *   produto; reordenar aqui seria decidir duas vezes a mesma coisa, e as duas
 *   decisões divergiriam no dia em que uma delas mudasse.
 */
export const agruparPorCategoria = <T extends ComCategoria>(itens: T[]): Grupo<T>[] => {
  const lista = Array.isArray(itens) ? itens.filter(Boolean) : [];
  const grupos = new Map<string | null, T[]>();

  for (const item of lista) {
    const chave = item.categoria?.trim() || null;
    const atual = grupos.get(chave);
    if (atual) atual.push(item);
    else grupos.set(chave, [item]);
  }

  return [...grupos.entries()]
    .map(([categoria, itensDoGrupo]) => ({ categoria, itens: itensDoGrupo }))
    .sort((a, b) => {
      if (a.categoria === null) return 1;
      if (b.categoria === null) return -1;
      return a.categoria.localeCompare(b.categoria, "pt-BR");
    });
};

/**
 * As categorias já usadas no contrato, para sugerir enquanto se digita.
 *
 * É o que impede "Saude" e "Saúde" convivendo no mesmo contrato sem precisar de
 * uma tabela de cadastro: quem monta a segunda linha vê a primeira na lista.
 */
export const categoriasUsadas = <T extends ComCategoria>(itens: T[]): string[] => {
  const vistas = new Set<string>();
  for (const item of Array.isArray(itens) ? itens : []) {
    const nome = item?.categoria?.trim();
    if (nome) vistas.add(nome);
  }
  return [...vistas].sort((a, b) => a.localeCompare(b, "pt-BR"));
};
