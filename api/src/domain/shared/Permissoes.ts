/**
 * Quem pode o quê — a matriz, em um lugar só, do lado que decide.
 *
 * Antes esta lista vivia apenas no web, para esconder botão, e a API se
 * defendia com `exigirPapel` em 40 das ~219 rotas. Nas outras, a regra real
 * era "tem sessão e a prefeitura contratou o módulo": bastava chamar a rota
 * direto para passar por cima do que a tela escondia.
 *
 * Duas regras que este arquivo existe para manter:
 *
 * 1. **Nenhuma herança comum entre papéis.** Havia um `READ_ONLY` que todos
 *    herdavam, e ele carregava frotas, licitações, contratos e processos. Fazia
 *    sentido quando o produto era um sistema só; com cinco módulos, virou passe
 *    livre — era por isso que a nutricionista enxergava a frota. Cada papel
 *    abaixo lista o que aquele cargo faz, e nada além.
 *
 * 2. **Permissão nova entra numa lista explícita.** Acrescentar uma permissão
 *    sem dar a ninguém é seguro; esquecer de tirá-la de um papel é que custa.
 */

export const PERMISSOES = [
  // Organização da prefeitura
  "units:read", "units:write",
  "sectors:read", "sectors:write",
  "users:read", "users:write",
  // Trilha de conduta dos servidores
  "audit:read",
  // Contratação
  "suppliers:read", "suppliers:write",
  "bids:read", "bids:write",
  "contracts:read", "contracts:write",
  "requests:read", "requests:create",
  "workflows:read", "workflows:write",
  "processes:read", "processes:dispatch", "processes:opinion", "processes:order",
  // Três atos diferentes: ver a peça de um registro que já se alcança, emitir
  // uma nova, e mexer no modelo — este último é administração da prefeitura.
  "documents:read", "documents:issue", "documents:template",
  // Balcão
  "protocol:read", "protocol:serve", "protocol:manage",
  // Patrimônio e frotas
  "assets:read", "assets:write",
  "fleet:read", "fleet:write", "trips:create",
  // Almoxarifado: pedir é da unidade; liberar e dar entrada é de quem
  // administra o estoque.
  "stock:read", "stock:request", "stock:receive", "stock:manage",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

export const ehPermissao = (valor: string): valor is Permissao =>
  (PERMISSOES as readonly string[]).includes(valor);

/** Administração da prefeitura: cadastros, fluxos, modelos e a auditoria. */
const ADMINISTRA_A_PREFEITURA: Permissao[] = [
  "units:read", "units:write",
  "sectors:read", "sectors:write",
  "users:read", "users:write",
  "workflows:read", "workflows:write",
  "documents:template",
  "audit:read",
];

/** O ciclo de contratação, de ponta a ponta. */
const CONDUZ_CONTRATACAO: Permissao[] = [
  "suppliers:read", "suppliers:write",
  "bids:read", "bids:write",
  "contracts:read", "contracts:write",
  "requests:read", "requests:create",
  "processes:read", "processes:dispatch",
  "documents:read", "documents:issue",
];

/**
 * O que cada papel pode. Sem herança comum: a repetição aqui é deliberada e
 * barata, e é o que permite ler uma linha e saber exatamente o alcance dela.
 */
export const PERMISSOES_DO_PAPEL: Record<string, Permissao[]> = {
  // O administrador da prefeitura responde por tudo que ela contratou.
  ADMIN: [...PERMISSOES],

  // Secretário ou chefe de gabinete: conduz a contratação e administra os
  // cadastros, mas não mexe na trilha de auditoria dos próprios servidores.
  GESTOR: [
    ...ADMINISTRA_A_PREFEITURA.filter((p) => p !== "audit:read"),
    ...CONDUZ_CONTRATACAO,
    "processes:order",
    "assets:read", "assets:write",
    "fleet:read", "fleet:write", "trips:create",
    "protocol:read", "protocol:serve", "protocol:manage",
    "stock:read", "stock:request", "stock:receive", "stock:manage",
  ],

  // Setor de compras: emite a ordem e cuida de fornecedor e contrato.
  COMPRAS: [
    "suppliers:read", "suppliers:write",
    "bids:read", "bids:write",
    "contracts:read", "contracts:write",
    "requests:read",
    "processes:read", "processes:dispatch", "processes:order",
    "documents:read", "documents:issue",
  ],

  // Controladoria: lê para dar parecer, e não escreve cadastro nenhum.
  CONTROLADORIA: [
    "suppliers:read", "bids:read", "contracts:read", "requests:read",
    "workflows:read",
    "processes:read", "processes:dispatch", "processes:opinion",
    "assets:read",
    "documents:issue",
    "audit:read",
    "documents:read",
  ],

  // Servidor de setor administrativo: abre solicitação e acompanha o trâmite.
  SERVIDOR: [
    "suppliers:read", "bids:read", "contracts:read",
    "requests:read", "requests:create",
    "processes:read",
    "documents:read",
  ],

  // Balcão de atendimento. Sem contrato, licitação nem solicitação: quem
  // atende o cidadão não precisa deles para fazer o trabalho.
  PROTOCOLO: ["protocol:read", "protocol:serve", "documents:read", "documents:issue"],

  // Alimentação escolar. Dá entrada, libera para as escolas e presta contas —
  // e não tem nada que fazer em frotas, patrimônio ou licitação.
  NUTRICIONISTA: [
    "stock:read", "stock:request", "stock:receive", "stock:manage",
    "units:read",
    "documents:read", "documents:issue",
  ],

  /**
   * A escola, a creche, o posto de saúde — quem recebe o material e responde
   * por ele. Pede, confirma o que chegou, registra o consumo, devolve a sobra
   * e imprime o comprovante de cada um desses atos.
   *
   * `stock:read` aqui não é o estoque da prefeitura: `SolicitarEstoque` e as
   * consultas do módulo já limitam quem tem lotação de unidade ao local dela.
   * O papel abre a porta; a lotação diz de qual armário se está falando.
   */
  UNIDADE: [
    "stock:read", "stock:request", "stock:receive",
    "documents:read", "documents:issue",
  ],

  PATRIMONIO: ["assets:read", "assets:write", "units:read", "documents:read", "documents:issue"],

  FROTAS: ["fleet:read", "fleet:write", "trips:create", "units:read", "documents:read", "documents:issue"],
};

/**
 * Permissão do papel, mais as exceções do usuário.
 *
 * `usuario_permissao` existe desde a 0001 e nunca foi lida — mais uma
 * configuração sem efeito. Ela é a válvula para o caso que não cabe em papel
 * nenhum: o servidor que, só nesta prefeitura, também responde pela frota.
 * Concede e revoga, porque tirar uma permissão de alguém é tão necessário
 * quanto dar.
 */
export const permissoesDe = (
  papel: string,
  excecoes: { permissao: string; concedida: boolean }[] = [],
): Set<string> => {
  const permitidas = new Set<string>(PERMISSOES_DO_PAPEL[papel] ?? []);
  for (const excecao of excecoes) {
    if (!ehPermissao(excecao.permissao)) continue;
    if (excecao.concedida) permitidas.add(excecao.permissao);
    else permitidas.delete(excecao.permissao);
  }
  return permitidas;
};
