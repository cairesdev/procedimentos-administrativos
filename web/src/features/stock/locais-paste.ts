// Import relativo, e não pelo alias `@/`: este módulo é lógica pura e o teste
// dele roda a partir do projeto da API, onde o alias do web não é resolvido.
import {
  aplicarSequencia, sugerirSequencia, type ColumnChoice,
} from "../../shared/lib/column-mapping";

/**
 * Colagem do cadastro de escolas do sistema antigo.
 *
 * A prefeitura que troca de sistema chega com dezenas de escolas e postos já
 * cadastrados — com CNPJ, endereço e responsável. Redigitar é o trabalho que
 * ninguém faz direito na segunda hora, e o CNPJ do local é exigido na
 * prestação de contas do PNAE.
 *
 * Todos os campos são texto: limpar máscara de CNPJ, hífen de CEP e caixa da
 * UF é decisão de domínio, e mora do lado da API. Aqui só se resolve **qual
 * coluna é o quê** — que é a parte que o usuário precisa declarar.
 */

export type CampoDoLocal =
  | "codigo" | "nome" | "cnpj" | "endereco" | "bairro"
  | "municipio" | "uf" | "cep" | "telefone" | "email" | "responsavel";

export type LinhaDeLocalColada = Partial<Record<CampoDoLocal, string>>;

export type ColagemDeLocais = {
  linhas: LinhaDeLocalColada[];
  /** Linhas sem nome — rodapé, total, separador que veio junto na cópia. */
  ignoradas: number;
  temCabecalho: boolean;
};

export const CAMPOS_DO_LOCAL: { campo: CampoDoLocal; rotulo: string }[] = [
  { campo: "codigo", rotulo: "Código" },
  { campo: "nome", rotulo: "Nome" },
  { campo: "cnpj", rotulo: "CNPJ" },
  { campo: "endereco", rotulo: "Endereço" },
  { campo: "bairro", rotulo: "Bairro" },
  { campo: "municipio", rotulo: "Município" },
  { campo: "uf", rotulo: "UF" },
  { campo: "cep", rotulo: "CEP" },
  { campo: "telefone", rotulo: "Telefone" },
  { campo: "email", rotulo: "E-mail" },
  { campo: "responsavel", rotulo: "Responsável" },
];

const SINONIMOS: Record<CampoDoLocal, string[]> = {
  codigo: ["codigo", "cod", "cd", "matricula", "inep", "id"],
  nome: ["nome", "escola", "unidade", "local", "estabelecimento", "razao social"],
  cnpj: ["cnpj", "cnpj cpf", "documento"],
  endereco: ["endereco", "logradouro", "rua", "end"],
  bairro: ["bairro", "distrito", "povoado", "localidade"],
  municipio: ["municipio", "cidade"],
  uf: ["uf", "estado", "sigla"],
  cep: ["cep"],
  telefone: ["telefone", "fone", "tel", "contato", "celular", "whatsapp"],
  email: ["email", "e mail", "correio eletronico"],
  responsavel: ["responsavel", "diretor", "diretora", "gestor", "gestora", "coordenador"],
};

/**
 * CNPJ e CEP fazem as vezes de coluna numérica na hora de reconhecer cabeçalho.
 *
 * O critério de `pareceCabecalho` é "nenhum campo numérico tem dígito" — e numa
 * planilha de escolas não há quantidade nem valor. São essas duas colunas que
 * distinguem a linha de título ("CNPJ") da linha de dado ("12.345.678/0001-90").
 */
const COM_DIGITOS: CampoDoLocal[] = ["cnpj", "cep"];

export const sugerirSequenciaDeLocais = (texto: string) =>
  sugerirSequencia<CampoDoLocal>(texto, SINONIMOS);

export const converterPlanilhaDeLocais = (
  texto: string,
  sequencia: ColumnChoice<CampoDoLocal>[],
): ColagemDeLocais => {
  /**
   * O nome é o obrigatório, e não o código: é o que separa a escola do rodapé
   * e da linha de seção. Linha com código e sem nome **segue** para a API, que
   * a devolve no relatório — sumir com ela aqui quebraria a promessa de que
   * tudo o que ficou de fora aparece nomeado.
   */
  const resultado = aplicarSequencia<CampoDoLocal>(texto, sequencia, {
    obrigatorio: "nome",
    camposNumericos: COM_DIGITOS,
  });

  return {
    linhas: resultado.linhas as LinhaDeLocalColada[],
    ignoradas: resultado.ignoradas,
    temCabecalho: resultado.cabecalhoDescartado,
  };
};
