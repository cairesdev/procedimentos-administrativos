import { somenteDigitos } from "../protocolo/Documento";

/**
 * Uma linha de planilha virando escola.
 *
 * A prefeitura chega com o cadastro no sistema antigo — dezenas de escolas e
 * postos, com CNPJ, endereço e responsável. Redigitar tudo é o trabalho que
 * ninguém faz direito na segunda hora: erra o CNPJ, abrevia o nome, pula o
 * telefone. E o CNPJ do local é exigido na prestação de contas do PNAE.
 *
 * A regra de fundo: **a linha só é recusada quando não dá para identificar o
 * que ela é**. Sem código ou sem nome não há escola. O resto degrada com
 * aviso — CNPJ ilegível entra vazio e aparece no relatório, e quem confere
 * corrige uma escola em vez de refazer a planilha inteira.
 */

export type LinhaCrua = {
  codigo?: string;
  nome?: string;
  cnpj?: string;
  endereco?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  responsavel?: string;
};

export type LocalParaImportar = {
  codigo: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
};

export type LinhaNormalizada =
  | { aproveitavel: true; local: LocalParaImportar; avisos: string[] }
  | { aproveitavel: false; motivo: string };

/** Os limites das colunas. Passar deles é erro do banco, não da tela. */
const TETO = {
  codigo: 10,
  nome: 150,
  endereco: 200,
  bairro: 100,
  municipio: 100,
  telefone: 20,
  email: 150,
  responsavel: 150,
} as const;

const limpo = (valor?: string): string => (valor ?? "").replace(/\s+/g, " ").trim();

/**
 * Texto que passa do teto é **cortado, com aviso** — nunca em silêncio.
 *
 * Recusar a escola inteira porque o endereço tem 210 caracteres seria trocar um
 * dado incompleto por dado nenhum. Cortar calado seria pior: o endereço
 * truncado parece correto e ninguém revisa.
 */
const cabendo = (
  valor: string, teto: number, campo: string, avisos: string[],
): string | null => {
  if (!valor) return null;
  if (valor.length <= teto) return valor;
  avisos.push(`${campo} passava de ${teto} caracteres e foi cortado`);
  return valor.slice(0, teto);
};

/** Um e-mail plausível. Validação de verdade é o envio, que aqui não acontece. */
const PARECE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizarLinhaDeLocal = (linha: LinhaCrua): LinhaNormalizada => {
  const avisos: string[] = [];

  const codigo = limpo(linha.codigo);
  const nome = limpo(linha.nome);

  if (!codigo && !nome) return { aproveitavel: false, motivo: "linha em branco" };
  if (!codigo) return { aproveitavel: false, motivo: `"${nome}" está sem código` };
  if (!nome) return { aproveitavel: false, motivo: `o código ${codigo} está sem nome` };

  /**
   * Código e nome não são cortados: são a identidade do local. Um código
   * cortado casaria com outra escola, e um nome cortado entra no romaneio.
   */
  if (codigo.length > TETO.codigo) {
    return {
      aproveitavel: false,
      motivo: `o código "${codigo}" tem mais de ${TETO.codigo} caracteres`,
    };
  }
  if (nome.length > TETO.nome) {
    return {
      aproveitavel: false,
      motivo: `o nome de "${codigo}" tem mais de ${TETO.nome} caracteres`,
    };
  }

  const digitosDoCnpj = somenteDigitos(limpo(linha.cnpj));
  let cnpj: string | null = null;
  if (digitosDoCnpj) {
    if (digitosDoCnpj.length === 14) {
      cnpj = digitosDoCnpj;
    } else {
      avisos.push(`CNPJ com ${digitosDoCnpj.length} dígitos foi deixado em branco`);
    }
  }

  const digitosDoCep = somenteDigitos(limpo(linha.cep));
  let cep: string | null = null;
  if (digitosDoCep) {
    if (digitosDoCep.length === 8) {
      cep = digitosDoCep;
    } else {
      avisos.push(`CEP com ${digitosDoCep.length} dígitos foi deixado em branco`);
    }
  }

  const ufCrua = limpo(linha.uf).toUpperCase();
  let uf: string | null = null;
  if (ufCrua) {
    if (/^[A-Z]{2}$/.test(ufCrua)) {
      uf = ufCrua;
    } else {
      avisos.push(`UF "${ufCrua}" não é uma sigla de dois caracteres`);
    }
  }

  const emailCru = limpo(linha.email).toLowerCase();
  let email: string | null = null;
  if (emailCru) {
    if (PARECE_EMAIL.test(emailCru) && emailCru.length <= TETO.email) {
      email = emailCru;
    } else {
      avisos.push(`o e-mail "${emailCru}" não parece um endereço e ficou em branco`);
    }
  }

  return {
    aproveitavel: true,
    avisos,
    local: {
      codigo,
      nome,
      cnpj,
      cep,
      uf,
      email,
      endereco: cabendo(limpo(linha.endereco), TETO.endereco, "o endereço", avisos),
      bairro: cabendo(limpo(linha.bairro), TETO.bairro, "o bairro", avisos),
      municipio: cabendo(limpo(linha.municipio), TETO.municipio, "o município", avisos),
      telefone: cabendo(limpo(linha.telefone), TETO.telefone, "o telefone", avisos),
      responsavel: cabendo(
        limpo(linha.responsavel), TETO.responsavel, "o responsável", avisos,
      ),
    },
  };
};
