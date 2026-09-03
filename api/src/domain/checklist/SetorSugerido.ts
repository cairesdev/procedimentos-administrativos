/**
 * De "CONTABILIDADE COM JURÍDICO" ao setor desta prefeitura.
 *
 * O modelo do PNTP é global e o organograma não é: o Tribunal sugere quem
 * responde por cada critério, mas quem existe de fato — e com que nome — muda
 * de município para município. Até aqui a sugestão vivia enterrada no texto da
 * descrição, e aplicar o modelo custava 53 atribuições à mão.
 *
 * A regra é deliberadamente tímida: casa quando **um** setor corresponde, e
 * desiste quando nenhum ou mais de um correspondem. Errar o responsável é pior
 * que deixá-lo em branco — em branco alguém preenche; errado, o item fica
 * cobrado de quem não devia e ninguém percebe até o prazo vencer.
 */

export type SetorConhecido = { id: string; nome: string };

export type ResponsavelSugerido = {
  /** Quem responde. Nulo quando a sugestão não casou com setor nenhum. */
  setorId: string | null;
  /** Quem apoia sem responder — o "COM" da planilha. */
  apoios: { setorId: string; departamentoId: null }[];
};

/** Sem acento, sem caixa, sem espaço dobrado: "Saúde" e "SAUDE" são a mesma. */
const chave = (nome: string): string =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();

/**
 * "CONTABILIDADE COM JURÍDICO" → dois papéis; "OBRAS OU INFRAESTRUTURA" → um
 * papel com dois nomes possíveis. A planilha usa as duas conjunções, e elas
 * querem dizer coisas diferentes.
 */
const papeis = (sugestao: string): string[][] =>
  chave(sugestao).split(" COM ")
    .map((papel) => papel.split(" OU ").map((nome) => nome.trim()).filter(Boolean))
    .filter((alternativas) => alternativas.length > 0);

/**
 * O setor que corresponde a um nome — ou nada.
 *
 * Vale o nome igual e o nome contido: "ADMINISTRAÇÃO" acha "Secretaria de
 * Administração", que é como as prefeituras costumam cadastrar. Dois candidatos
 * empatados não escolhem nenhum: "SAÚDE" diante de "Secretaria de Saúde" e
 * "Fundo Municipal de Saúde" é uma pergunta que só quem trabalha lá responde.
 *
 * A comparação é literal, e a flexão de gênero muda o texto: "JURÍDICO" não
 * acha "Procuradoria Jurídica". Reconhecer os dois pediria radicalização de
 * palavra, que acerta aqui e erra adiante — e errar o responsável é justamente
 * o que não se pode fazer. Nesses casos o item nasce em branco, como antes.
 */
const casar = (nome: string, setores: SetorConhecido[]): string | null => {
  const alvo = chave(nome);

  const exatos = setores.filter((setor) => chave(setor.nome) === alvo);
  if (exatos.length === 1) return exatos[0]!.id;
  if (exatos.length > 1) return null;

  const contidos = setores.filter((setor) => {
    const dele = chave(setor.nome);
    return dele.includes(alvo) || alvo.includes(dele);
  });
  return contidos.length === 1 ? contidos[0]!.id : null;
};

export const responsavelSugerido = (
  sugestao: string | null | undefined,
  setores: SetorConhecido[],
): ResponsavelSugerido => {
  const vazio: ResponsavelSugerido = { setorId: null, apoios: [] };
  if (!sugestao?.trim() || setores.length === 0) return vazio;

  const [responsavel, ...apoiadores] = papeis(sugestao);
  if (!responsavel) return vazio;

  const escolher = (alternativas: string[]): string | null => {
    for (const nome of alternativas) {
      const id = casar(nome, setores);
      if (id) return id;
    }
    return null;
  };

  const setorId = escolher(responsavel);

  /**
   * Apoio repetido vira um só, e apoio igual ao responsável some: o banco tem
   * chave sobre (item, setor), e a tela mostraria o mesmo nome duas vezes.
   */
  const vistos = new Set(setorId ? [setorId] : []);
  const apoios = apoiadores.flatMap((alternativas) => {
    const id = escolher(alternativas);
    if (!id || vistos.has(id)) return [];
    vistos.add(id);
    return [{ setorId: id, departamentoId: null }];
  });

  return { setorId, apoios };
};
