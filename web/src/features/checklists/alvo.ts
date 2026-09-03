/**
 * O alvo do checklist, como se escreve numa linha de tabela.
 *
 * A API devolve tipo, id, número e rótulo; a tela precisa de um texto e, quando
 * existe página de detalhe, de um endereço. Fornecedor não tem detalhe próprio
 * — a listagem é a única tela —, então ele aparece sem link em vez de levar a
 * lugar nenhum.
 *
 * Mora fora do componente para poder ser testado sem bundler: são os casos de
 * borda (alvo apagado, tipo desconhecido) que quebram tela, e não o feliz.
 */

/**
 * Parcial de propósito: o tipo vem da API, e um tipo novo lá — ou fornecedor,
 * que não tem tela — precisa cair no `undefined` em vez de virar `/undefined/id`.
 */
const DETALHE: Partial<Record<string, (id: string) => string>> = {
  PROCESSO: (id) => `/processos/fila/${id}`,
  CONTRATO: (id) => `/processos/contratos/${id}`,
  LICITACAO: (id) => `/processos/licitacoes/${id}`,
};

export type AlvoDeChecklist = {
  alvoTipo?: string | null;
  alvoId?: string | null;
  alvoNumero?: string | null;
  alvoRotulo?: string | null;
};

export type AlvoNaTela = {
  /** "contrato 010/2026" — ou "lista avulsa" quando não há vínculo. */
  texto: string;
  /** O tipo em minúsculas, para o selo. Nulo em lista avulsa. */
  tipo: string | null;
  /** Quem ou o quê, quando a API soube dizer. */
  detalhe: string | null;
  /** Endereço do registro, se ele tem tela de detalhe e ainda existe. */
  href: string | null;
};

export const alvoNaTela = (checklist: AlvoDeChecklist): AlvoNaTela => {
  const tipo = checklist.alvoTipo?.trim();
  if (!tipo) {
    return { texto: "lista avulsa", tipo: null, detalhe: null, href: null };
  }

  const nome = tipo.toLowerCase();
  const numero = checklist.alvoNumero?.trim();
  const id = checklist.alvoId?.trim();

  /**
   * Sem número, o vínculo está órfão — o registro foi apagado, ou é de outra
   * prefeitura. Dizer isso é melhor que mostrar o uuid, e melhor que esconder:
   * quem vê sabe que há um vínculo e que ele não leva a lugar nenhum.
   */
  if (!numero) {
    return { texto: `${nome} não encontrado`, tipo: nome, detalhe: null, href: null };
  }

  const rota = DETALHE[tipo];
  return {
    texto: `${nome} ${numero}`,
    tipo: nome,
    detalhe: checklist.alvoRotulo?.trim() || null,
    href: rota && id ? rota(id) : null,
  };
};
