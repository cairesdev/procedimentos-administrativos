/**
 * CPF e CNPJ do requerente.
 *
 * A validação existe menos por rigor cadastral e mais porque o documento é
 * metade da chave da consulta pública: documento errado no cadastro deixa o
 * cidadão sem conseguir acompanhar o próprio pedido, e ele não tem a quem
 * recorrer a não ser voltar ao balcão.
 */

export const somenteDigitos = (valor: string): string => valor.replace(/\D/g, "");

/** Dígito verificador por soma ponderada — mesma mecânica no CPF e no CNPJ. */
const digito = (base: string, pesos: number[]): number => {
  const soma = pesos.reduce((total, peso, indice) => total + Number(base[indice]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

const cpfValido = (cpf: string): boolean => {
  // Sequência repetida passa na conta dos dígitos, mas não é CPF de ninguém.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const primeiro = digito(cpf, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito(cpf, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(cpf[9]) && segundo === Number(cpf[10]);
};

const cnpjValido = (cnpj: string): boolean => {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const primeiro = digito(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(cnpj[12]) && segundo === Number(cnpj[13]);
};

export const documentoValido = (documento: string): boolean => {
  const limpo = somenteDigitos(documento);
  if (limpo.length === 11) return cpfValido(limpo);
  if (limpo.length === 14) return cnpjValido(limpo);
  return false;
};

/** Formata para leitura: 000.000.000-00 ou 00.000.000/0000-00. */
export const formatarDocumento = (documento: string): string => {
  const limpo = somenteDigitos(documento);
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return documento;
};
