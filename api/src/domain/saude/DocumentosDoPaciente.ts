/**
 * Os cinco documentos pelos quais um paciente é reconhecido.
 *
 * Cinco, e todos opcionais, porque o SUS registra por Cartão, o Bolsa Família
 * por NIS e quem chega de carro tem a CNH no bolso e mais nada. Um campo só
 * obrigaria a recepção a cadastrar a mesma pessoa de novo na segunda visita —
 * que é como nascem prontuários duplicados.
 *
 * **O que este arquivo confere e o que não confere.** Ele confere formato e
 * dígito verificador: pega o número trocado ao digitar, que é o erro comum.
 * Não confere existência: a base nacional do CNS (CADSUS) tem barramento
 * próprio, com cadastro de cessionário e autorização do DATASUS, e não é
 * aberta (`docs/integracao-cnes.md`). Dizer "CNS válido" aqui significa
 * "podia existir", não "existe".
 */

export type TipoDeDocumento = "cns" | "cpf" | "nis" | "cnh" | "rg";

/** Só os dígitos. A recepção digita com ponto, traço e espaço. */
export const somenteDigitos = (valor: string): string => valor.replace(/\D/g, "");

const todosIguais = (digitos: string): boolean =>
  digitos.split("").every((digito) => digito === digitos[0]);

/**
 * CNS: quinze dígitos, com dois algoritmos diferentes.
 *
 * Cartão definitivo começa em 1 ou 2 e fecha em módulo 11 sobre os quinze
 * dígitos; provisório começa em 7, 8 ou 9 e a soma ponderada tem de fechar
 * redonda. O DATASUS emitiu os dois durante anos, e recusar o provisório
 * deixaria de fora justamente quem se cadastrou de última hora — que é boa
 * parte de quem chega no pronto atendimento.
 */
const INICIOS_DE_CNS = ["1", "2", "7", "8", "9"];

export const cnsValido = (valor: string): boolean => {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 15) return false;
  if (!INICIOS_DE_CNS.includes(digitos[0]!)) return false;

  // Os dois algoritmos convergem no mesmo teste final: a soma ponderada de 15
  // a 1 tem de ser múltipla de 11. O que muda entre definitivo e provisório é
  // como o dígito foi gerado, não como se confere.
  const soma = digitos
    .split("")
    .reduce((total, digito, indice) => total + Number(digito) * (15 - indice), 0);

  return soma % 11 === 0;
};

/**
 * CPF: os dois dígitos verificadores.
 *
 * Rejeita os onze repetidos, que passam no cálculo e são o valor que alguém
 * digita para "preencher o campo".
 */
export const cpfValido = (valor: string): boolean => {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 11 || todosIguais(digitos)) return false;

  const verificador = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) soma += Number(digitos[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return verificador(9) === Number(digitos[9]) && verificador(10) === Number(digitos[10]);
};

/**
 * NIS/PIS/PASEP: onze dígitos, módulo 11 com pesos de 3 a 2.
 *
 * Vale a pena conferir porque o NIS costuma ser copiado do cartão do Bolsa
 * Família à mão, e é o documento que mais chega trocado.
 */
export const nisValido = (valor: string): boolean => {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 11 || todosIguais(digitos)) return false;

  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = pesos.reduce(
    (total, peso, indice) => total + Number(digitos[indice]) * peso,
    0,
  );
  const resto = 11 - (soma % 11);
  const esperado = resto >= 10 ? 0 : resto;
  return esperado === Number(digitos[10]);
};

/**
 * CNH: onze dígitos, dois verificadores.
 *
 * Entra na lista porque é o documento que o paciente traz quando chega de
 * carro depois de um acidente — e nessa hora ele não trouxe mais nada.
 */
export const cnhValida = (valor: string): boolean => {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 11 || todosIguais(digitos)) return false;

  let primeira = 0;
  let segunda = 0;
  for (let i = 0, peso = 9; i < 9; i += 1, peso -= 1) {
    primeira += Number(digitos[i]) * peso;
  }
  for (let i = 0, peso = 1; i < 9; i += 1, peso += 1) {
    segunda += Number(digitos[i]) * peso;
  }

  let primeiroDigito = primeira % 11;
  let excesso = 0;
  if (primeiroDigito >= 10) {
    primeiroDigito = 0;
    excesso = 2;
  }
  let segundoDigito = (segunda % 11) - excesso;
  if (segundoDigito < 0) segundoDigito += 11;
  if (segundoDigito >= 10) segundoDigito = 0;

  return primeiroDigito === Number(digitos[9]) && segundoDigito === Number(digitos[10]);
};

/**
 * O RG não tem dígito verificador nacional.
 *
 * Cada estado emite no seu formato, alguns com letra, alguns com "X". Conferir
 * seria inventar uma regra que não existe e recusar documento verdadeiro, o
 * que é pior que aceitar um errado: o RG aqui é pista de busca, não chave.
 */
export const rgAceitavel = (valor: string): boolean =>
  valor.trim().length >= 5 && valor.trim().length <= 20;

const VALIDADORES: Record<TipoDeDocumento, (valor: string) => boolean> = {
  cns: cnsValido,
  cpf: cpfValido,
  nis: nisValido,
  cnh: cnhValida,
  rg: rgAceitavel,
};

const NOMES: Record<TipoDeDocumento, string> = {
  cns: "Cartão do SUS",
  cpf: "CPF",
  nis: "NIS",
  cnh: "CNH",
  rg: "RG",
};

export type DocumentosInformados = Partial<Record<TipoDeDocumento, string | null>>;

/**
 * Normaliza o que a recepção digitou e devolve o que não fecha.
 *
 * Devolve **lista**, e não o primeiro erro, porque a recepção digita os cinco
 * campos de uma vez: mostrar um por vez faria a tela recusar o cadastro quatro
 * vezes seguidas com a pessoa esperando em pé no balcão.
 */
export const conferirDocumentos = (
  informados: DocumentosInformados,
): { limpos: DocumentosInformados; problemas: string[] } => {
  const limpos: DocumentosInformados = {};
  const problemas: string[] = [];

  for (const tipo of Object.keys(VALIDADORES) as TipoDeDocumento[]) {
    const bruto = informados[tipo];
    if (bruto === undefined) continue;

    const valor = (bruto ?? "").trim();
    if (!valor) {
      limpos[tipo] = null;
      continue;
    }

    const normalizado = tipo === "rg" ? valor : somenteDigitos(valor);
    if (!VALIDADORES[tipo](normalizado)) {
      problemas.push(`${NOMES[tipo]} não confere — verifique os números digitados.`);
      continue;
    }
    limpos[tipo] = normalizado;
  }

  return { limpos, problemas };
};
