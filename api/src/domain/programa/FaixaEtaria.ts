/**
 * As faixas etárias do ofício.
 *
 * O Ministério Público pediu "com indicação da faixa etária" e não disse
 * quais. Estas seguem os cortes que a política de saúde usa e que a própria
 * promotoria costuma citar: a primeira infância, onde o diagnóstico precoce é
 * o que muda o prognóstico; a idade escolar; a adolescência; e a vida adulta,
 * que é a faixa que os municípios mais esquecem de contar.
 *
 * **A faixa é calculada na hora da consulta, e não guardada.** Idade gravada
 * envelhece errado: a criança de 5 anos do relatório de março continuaria com
 * 5 anos no relatório de dezembro, e o número que o promotor recebe estaria
 * desatualizado por construção.
 */

import { comoDataLocal } from "./DataDoCalendario";

export type FaixaEtaria = {
  /** Identificador estável — o rótulo pode mudar sem quebrar consulta. */
  chave: string;
  rotulo: string;
  /** Anos completos, inclusivo. `ate` nulo é "daqui para cima". */
  de: number;
  ate: number | null;
};

export const FAIXAS: FaixaEtaria[] = [
  { chave: "ate_3", rotulo: "0 a 3 anos", de: 0, ate: 3 },
  { chave: "de_4_a_6", rotulo: "4 a 6 anos", de: 4, ate: 6 },
  { chave: "de_7_a_11", rotulo: "7 a 11 anos", de: 7, ate: 11 },
  { chave: "de_12_a_17", rotulo: "12 a 17 anos", de: 12, ate: 17 },
  { chave: "adulto", rotulo: "18 anos ou mais", de: 18, ate: null },
];

/**
 * Anos completos entre duas datas.
 *
 * Sem biblioteca e sem dividir por 365,25: quem faz aniversário em 29 de
 * fevereiro e quem nasceu ontem são os dois casos em que a divisão erra, e
 * errar a idade de uma criança de 3 anos e 11 meses a joga na faixa errada do
 * relatório.
 */
export const idadeEmAnos = (
  nascimento: Date | string,
  referencia: Date = new Date(),
): number => {
  // `comoDataLocal` porque "2020-09-09" é data de calendário: lida como UTC,
  // ela vira 8 de setembro num servidor em Brasília, e o aniversário anda.
  const data = comoDataLocal(nascimento);
  let idade = referencia.getFullYear() - data.getFullYear();

  const aindaNaoFezAniversario =
    referencia.getMonth() < data.getMonth()
    || (referencia.getMonth() === data.getMonth() && referencia.getDate() < data.getDate());

  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
};

export const faixaDaIdade = (idade: number): FaixaEtaria | null =>
  FAIXAS.find((faixa) => idade >= faixa.de && (faixa.ate === null || idade <= faixa.ate))
  ?? null;

/**
 * A faixa de quem não tem data de nascimento no cadastro.
 *
 * Existe e vai aparecer: o cadastro do paciente aceita nascimento em branco,
 * porque o pronto atendimento não pode travar por falta dele. No relatório
 * isso vira uma linha própria — **"sem data de nascimento"** —, e não some
 * dentro de outra faixa. Um número que não fecha com o total é o primeiro
 * lugar onde o promotor vai olhar, e a resposta honesta é dizer quantos são.
 */
export const SEM_NASCIMENTO = {
  chave: "sem_nascimento",
  rotulo: "Sem data de nascimento no cadastro",
} as const;

export type ContagemPorFaixa = {
  chave: string;
  rotulo: string;
  quantidade: number;
};

/**
 * Distribui pessoas pelas faixas, mantendo as vazias.
 *
 * Faixa com zero **continua na lista**. Sumir com ela faria o relatório
 * parecer que o município não tem adulto com TEA, quando o que ele não tem é
 * adulto com TEA cadastrado — que são coisas diferentes, e a segunda é a que
 * o promotor está investigando.
 */
export const distribuirPorFaixa = (
  nascimentos: (Date | string | null)[],
  referencia: Date = new Date(),
): ContagemPorFaixa[] => {
  const contagem = new Map<string, number>(FAIXAS.map((faixa) => [faixa.chave, 0]));
  let semNascimento = 0;

  for (const nascimento of nascimentos) {
    if (!nascimento) {
      semNascimento += 1;
      continue;
    }
    const faixa = faixaDaIdade(idadeEmAnos(nascimento, referencia));
    if (!faixa) {
      semNascimento += 1;
      continue;
    }
    contagem.set(faixa.chave, (contagem.get(faixa.chave) ?? 0) + 1);
  }

  const linhas: ContagemPorFaixa[] = FAIXAS.map((faixa) => ({
    chave: faixa.chave,
    rotulo: faixa.rotulo,
    quantidade: contagem.get(faixa.chave) ?? 0,
  }));

  // A linha do sem-nascimento só aparece quando existe: numa prefeitura com o
  // cadastro em dia, ela seria uma linha de zero sem explicar nada.
  if (semNascimento > 0) {
    linhas.push({ ...SEM_NASCIMENTO, quantidade: semNascimento });
  }
  return linhas;
};
