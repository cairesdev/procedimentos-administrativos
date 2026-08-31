/**
 * Quais escolas este usuário enxerga.
 *
 * A pergunta nasceu de um vazamento: a trava por lotação existia só na escrita,
 * e comparava `local.unidade_id` com as unidades do usuário. Toda leitura
 * passava com `stock:read` puro — a escola 1 listava os pedidos, o estoque e o
 * consumo da escola 2.
 *
 * A resposta é uma de três, e é sempre a mesma para todas as consultas do
 * módulo. Ela vive aqui, sem I/O, porque é regra: quem alcança o quê não
 * depende de como o banco guarda nada.
 */

/** Uma lotação, reduzida ao que decide alcance. */
export type LotacaoParaAlcance = {
  localId?: string | null;
  setorId?: string | null;
  unidadeId?: string | null;
  departamentoId?: string | null;
};

export type Alcance =
  /** Sem trava. Administrador, e quem ainda não foi lotado. */
  | { tipo: "TUDO" }
  /** Lotado em escola: alcança as escolas em que está lotado, e nada mais. */
  | { tipo: "LOCAIS"; locais: string[] }
  /** Lotado em setor: alcança o que os almoxarifados do setor dele atendem. */
  | { tipo: "SETORES"; setores: string[] };

/**
 * A escola vence o setor.
 *
 * Quem é lotado nos dois — a diretora que também responde por um setor — é
 * tratado pelo lado mais restrito. O contrário deixaria a trava desligável por
 * acúmulo de lotação, e "ganhar acesso a tudo" viraria efeito colateral de um
 * cadastro a mais.
 */
export const alcanceDe = (lotacoes: LotacaoParaAlcance[]): Alcance => {
  const locais = unicos(lotacoes.map((lotacao) => lotacao.localId));
  if (locais.length > 0) return { tipo: "LOCAIS", locais };

  const setores = unicos(lotacoes.map((lotacao) => lotacao.setorId));
  if (setores.length > 0) return { tipo: "SETORES", setores };

  /**
   * Sem lotação de escola nem de setor, não há trava.
   *
   * Cobre o administrador, e cobre o dia da migration: o sistema já está em
   * produção com gente lotada em unidade e em departamento, e ninguém lotado em
   * escola. Trocar isto por "não alcança nada" trancaria o almoxarifado inteiro
   * no deploy, e a primeira reação seria devolver a permissão a todo mundo —
   * que é como uma trava morre.
   */
  return { tipo: "TUDO" };
};

const unicos = (valores: (string | null | undefined)[]): string[] =>
  [...new Set(valores.filter((valor): valor is string => Boolean(valor)))];
