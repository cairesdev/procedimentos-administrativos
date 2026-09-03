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
  // A nota fiscal chega dias depois da ordem, e quem a confere é quem a tem em
  // mãos: compras e controladoria. Separada de `processes:order` porque
  // informar o número não é emitir a ordem.
  "orders:invoice",
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
  // Checklist: ver, montar a lista, cumprir um item e conferir o que veio.
  // Cumprir e conferir são separadas porque ninguém fecha o próprio item.
  "checklists:read", "checklists:manage", "checklists:fulfill", "checklists:verify",
  /**
   * Relatórios gerenciais.
   *
   * Permissão própria porque a pergunta é outra: `contracts:read` autoriza ver
   * *um* contrato: quem o tem em mãos precisa dele. O relatório mostra o
   * conjunto — quanto a prefeitura contratou no ano, de quem, e onde o processo
   * trava. Isso é leitura de gestão, e quem lê um contrato não necessariamente
   * responde por ela.
   */
  "reports:read",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

export const ehPermissao = (valor: string): valor is Permissao =>
  (PERMISSOES as readonly string[]).includes(valor);

/**
 * O organograma da prefeitura: nome de unidade e de setor.
 *
 * **Isto não é o `READ_ONLY` de volta.** Aquela lista carregava frotas,
 * licitações, contratos e processos — dados de outros módulos, que é o que
 * fazia a nutricionista enxergar a frota. Aqui são dois cadastros que devolvem
 * `id`, `nome` e `ativo` da própria prefeitura, e sem eles a tela não consegue
 * escrever "Setor de Compras" ao lado do processo nem oferecer a unidade numa
 * solicitação. Todo papel opera em alguma tela que precisa deles.
 *
 * Escrever continua sendo administração: `units:write` e `sectors:write` ficam
 * com quem organiza a prefeitura.
 */
const LE_O_ORGANOGRAMA: Permissao[] = ["units:read", "sectors:read"];

/** Administração da prefeitura: cadastros, fluxos, modelos e a auditoria. */
const ADMINISTRA_A_PREFEITURA: Permissao[] = [
  ...LE_O_ORGANOGRAMA,
  "units:write",
  "sectors:write",
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
    "checklists:read", "checklists:manage", "checklists:fulfill", "checklists:verify",
    ...ADMINISTRA_A_PREFEITURA.filter((p) => p !== "audit:read"),
    ...CONDUZ_CONTRATACAO,
    "processes:order", "orders:invoice",
    "assets:read", "assets:write",
    "fleet:read", "fleet:write", "trips:create",
    "protocol:read", "protocol:serve", "protocol:manage",
    "stock:read", "stock:request", "stock:receive", "stock:manage",
    "reports:read",
  ],

  // Setor de compras: emite a ordem e cuida de fornecedor e contrato.
  COMPRAS: [
    "checklists:read", "checklists:manage", "checklists:fulfill", "checklists:verify",
    ...LE_O_ORGANOGRAMA,
    "suppliers:read", "suppliers:write",
    "bids:read", "bids:write",
    "contracts:read", "contracts:write",
    "requests:read",
    "processes:read", "processes:dispatch", "processes:order",
    "orders:invoice",
    "documents:read", "documents:issue",
    "reports:read",
  ],

  // Controladoria: lê para dar parecer, e não escreve cadastro nenhum.
  CONTROLADORIA: [
    "checklists:read", "checklists:verify",
    ...LE_O_ORGANOGRAMA,
    "suppliers:read", "bids:read", "contracts:read", "requests:read",
    "workflows:read",
    "processes:read", "processes:dispatch", "processes:opinion",
    /**
     * A única escrita da controladoria, e deliberada.
     *
     * Informar o número da nota fiscal é ato de conferência, não de cadastro:
     * a nota chega com a mercadoria, dias depois da ordem, e quem a confere é
     * quem a tem em mãos.
     */
    "orders:invoice",
    "assets:read",
    "documents:issue",
    "audit:read",
    "documents:read",
    "reports:read",
  ],

  // Servidor de setor administrativo: abre solicitação e acompanha o trâmite.
  SERVIDOR: [
    "checklists:read", "checklists:fulfill",
    ...LE_O_ORGANOGRAMA,
    "suppliers:read", "bids:read", "contracts:read",
    "requests:read", "requests:create",
    "processes:read",
    "documents:read",
  ],

  // Balcão de atendimento. Sem contrato, licitação nem solicitação: quem
  // atende o cidadão não precisa deles para fazer o trabalho.
  // O balcão encaminha para setores: precisa saber os nomes deles.
  PROTOCOLO: [
    "checklists:read", "checklists:fulfill",
    ...LE_O_ORGANOGRAMA,
    "protocol:read", "protocol:serve", "documents:read", "documents:issue",
  ],

  // Alimentação escolar. Dá entrada, libera para as escolas e presta contas —
  // e não tem nada que fazer em frotas, patrimônio ou licitação.
  NUTRICIONISTA: [
    "checklists:read", "checklists:fulfill",
    ...LE_O_ORGANOGRAMA,
    "stock:read", "stock:request", "stock:receive", "stock:manage",
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
    "checklists:read", "checklists:fulfill",
    ...LE_O_ORGANOGRAMA,
    "stock:read", "stock:request", "stock:receive",
    "documents:read", "documents:issue",
  ],

  // A entrada de bens registra de quem veio o bem — daí o fornecedor. Ler o
  // cadastro não é o mesmo que conduzir a contratação: `suppliers:write`,
  // licitação e contrato continuam de fora.
  PATRIMONIO: [
    "checklists:read", "checklists:fulfill",
    ...LE_O_ORGANOGRAMA,
    "assets:read", "assets:write",
    "suppliers:read",
    "documents:read", "documents:issue",
  ],

  FROTAS: [
    "checklists:read", "checklists:fulfill",
    ...LE_O_ORGANOGRAMA,
    "fleet:read", "fleet:write", "trips:create", "documents:read", "documents:issue",
  ],
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
