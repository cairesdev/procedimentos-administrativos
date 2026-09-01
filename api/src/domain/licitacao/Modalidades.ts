/**
 * As modalidades de contratação, com a sigla que o Tribunal usa.
 *
 * A sigla de duas letras não é enfeite: é como a modalidade viaja nos layouts
 * de prestação de contas. Guardar só o nome obrigaria a traduzir de volta na
 * hora de exportar, e tradução feita duas vezes diverge uma vez.
 *
 * O identificador é o que vai para o banco e é legível por si — `PREGAO_
 * ELETRONICO` num `SELECT` diz o que é; `PE` exigiria consultar esta tabela.
 * Os oito primeiros já existiam e **não podem mudar de nome**: há licitação
 * gravada com cada um deles.
 */
export const MODALIDADES = [
  { id: "DISPENSA", sigla: "DP", nome: "Dispensa de licitação" },
  { id: "DISPENSA_ELETRONICA", sigla: "DE", nome: "Dispensa eletrônica de licitação" },
  { id: "INEXIGIBILIDADE", sigla: "IN", nome: "Inexigibilidade de licitação" },
  { id: "CREDENCIAMENTO", sigla: "CR", nome: "Credenciamento" },
  { id: "ADESAO_ATA", sigla: "AA", nome: "Adesão à ata de registro de preços" },
  { id: "CONCORRENCIA", sigla: "CP", nome: "Concorrência pública" },
  { id: "TOMADA_DE_PRECOS", sigla: "TP", nome: "Tomada de preços" },
  { id: "CARTA_CONVITE", sigla: "CC", nome: "Carta convite" },
  { id: "CONCURSO", sigla: "CO", nome: "Concurso" },
  { id: "LEILAO", sigla: "LL", nome: "Leilão" },
  { id: "LICITACAO_INTERNACIONAL", sigla: "LI", nome: "Licitação internacional" },
  { id: "PREGAO_ELETRONICO", sigla: "PE", nome: "Pregão eletrônico" },
  { id: "PREGAO_PRESENCIAL", sigla: "PP", nome: "Pregão presencial" },
  { id: "RDC_ELETRONICO", sigla: "RE", nome: "RDC eletrônico" },
  { id: "RDC_PRESENCIAL", sigla: "RP", nome: "RDC presencial" },
  { id: "DIALOGO_COMPETITIVO", sigla: "DC", nome: "Diálogo competitivo" },
  { id: "LEI_13303", sigla: "PL", nome: "Procedimentos da Lei nº 13.303/2016" },
  { id: "OUTROS", sigla: "OT", nome: "Outros procedimentos de licitação" },

  /**
   * Chamada pública fica por último, e sem sigla própria.
   *
   * Ela não consta da lista do Tribunal, mas é o que a agricultura familiar do
   * PNAE usa — há licitação gravada com ela, e apagá-la deixaria esses
   * registros apontando para uma modalidade que não existe mais. Numa
   * exportação ela cabe em "OT"; aqui continua com nome próprio, porque é assim
   * que a prefeitura a chama.
   */
  { id: "CHAMADA_PUBLICA", sigla: null, nome: "Chamada pública" },
] as const;

export type Modalidade = (typeof MODALIDADES)[number]["id"];

/**
 * Os identificadores como tupla não-vazia, que é o que `z.enum` exige.
 *
 * Um `.map` simples devolveria `string[]`, e o Zod recusa: ele precisa saber em
 * tempo de tipo que há ao menos um valor. Escrever o primeiro à parte é o que
 * dá essa garantia sem um `as` — e um `as` aqui calaria justamente o dia em que
 * alguém esvaziasse a lista.
 */
export const IDS_DE_MODALIDADE: [Modalidade, ...Modalidade[]] = [
  MODALIDADES[0].id,
  ...MODALIDADES.slice(1).map((modalidade) => modalidade.id),
];

export const ehModalidade = (valor: string): valor is Modalidade =>
  (IDS_DE_MODALIDADE as readonly string[]).includes(valor);

/** Como a modalidade se lê num documento emitido. */
export const nomeDaModalidade = (id: string): string =>
  MODALIDADES.find((modalidade) => modalidade.id === id)?.nome ?? "—";
