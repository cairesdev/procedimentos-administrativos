import sanitizeHtml from "sanitize-html";

/**
 * O corpo do modelo é HTML restrito — precisa disso para as duas ordens de
 * serviço do levantamento, que são tabelas com layouts diferentes.
 *
 * HTML editável vira XSS na página **pública** de conferência, que qualquer um
 * abre. Por isso o corpo passa por lista de permissão ao salvar E ao renderizar:
 * se um modelo escapar por outro caminho (importação, correção direta no banco),
 * a peça ainda sai limpa. Os valores interpolados já vão escapados em
 * `Marcadores.ts`; aqui se cuida da marcação que o próprio modelo traz.
 */
const TAGS_PERMITIDAS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "small",
  "h1", "h2", "h3", "h4", "blockquote",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "div", "span",
];

const REGRAS: sanitizeHtml.IOptions = {
  allowedTags: TAGS_PERMITIDAS,
  allowedAttributes: {
    "*": ["style", "class"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
  },
  // Sem href/src: link e imagem num documento oficial só serviriam para
  // apontar para fora, e imagem remota vazaria quem abriu a conferência.
  allowedSchemes: [],
  allowedStyles: {
    "*": {
      "text-align": [/^left$|^right$|^center$|^justify$/],
      "font-weight": [/^bold$|^normal$|^\d{3}$/],
      "font-size": [/^\d{1,2}(\.\d+)?(px|pt|em|rem)$/],
      "font-style": [/^italic$|^normal$/],
      "text-decoration": [/^underline$|^none$/],
      width: [/^\d{1,3}(\.\d+)?(px|%|em)$/],
      padding: [/^\d{1,2}(\.\d+)?(px|em)$/],
      margin: [/^\d{1,2}(\.\d+)?(px|em)( \d{1,2}(\.\d+)?(px|em)){0,3}$/],
      border: [/^\d{1,2}px (solid|dashed|dotted) #[0-9a-fA-F]{3,6}$/],
      "border-collapse": [/^collapse$|^separate$/],
      "vertical-align": [/^top$|^middle$|^bottom$/],
    },
  },
  disallowedTagsMode: "discard",
};

export const limparCorpo = (corpo: string): string => sanitizeHtml(corpo, REGRAS);

/**
 * O que o sanitizador removeria — para a tela de edição avisar antes de salvar,
 * em vez de o texto sumir sem explicação.
 */
export const tagsRemovidas = (corpo: string): string[] => {
  // Varredura por regex, não parse: serve só para avisar quem edita. O que
  // vale de verdade é `limparCorpo`, que é quem realmente decide o que fica.
  const encontradas = [...corpo.matchAll(/<\s*([a-zA-Z][\w-]*)/g)].map(([, tag]) =>
    tag!.toLowerCase(),
  );
  return [...new Set(encontradas.filter((tag) => !TAGS_PERMITIDAS.includes(tag)))];
};
