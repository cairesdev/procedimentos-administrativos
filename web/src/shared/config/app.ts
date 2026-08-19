// Identidade do produto, definida no build da imagem. Como o nome aparece em
// Client Components, precisa do prefixo NEXT_PUBLIC_ — as variáveis são lidas
// literalmente aqui porque o Next só substitui `process.env.X` estático.
export const app = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Procedimentos administrativos",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || "Procedimentos",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
    "Gestão de processos administrativos municipais",
  version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
} as const;
