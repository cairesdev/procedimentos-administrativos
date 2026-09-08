/**
 * "2020-09-09" é uma data do calendário, e não um instante.
 *
 * `new Date("2020-09-09")` é interpretado como **meia-noite UTC**. Num
 * servidor em `America/Sao_Paulo` isso vira 8 de setembro às 21h no horário
 * local, e `getDate()` devolve 8. Data de nascimento, data de indicação e data
 * de sessão andam todas um dia para trás.
 *
 * O efeito não é cosmético: quem nasceu em 9 de setembro passa a ter feito
 * aniversário um dia antes, e a criança de 3 anos e 364 dias entra na faixa
 * dos 4 no relatório que vai para a Promotoria. Foi o que este arquivo existe
 * para consertar, e foi um teste de fuso que o pegou.
 *
 * A regra: quando o valor é `YYYY-MM-DD`, monta-se a data no fuso local. Um
 * `Date` que já veio do `pg` (com hora) é usado como está.
 */

const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export const comoDataLocal = (valor: Date | string): Date => {
  if (valor instanceof Date) return valor;

  const achado = SO_DATA.exec(valor.trim());
  if (!achado) return new Date(valor);

  const [, ano, mes, dia] = achado;
  return new Date(Number(ano), Number(mes) - 1, Number(dia));
};

/**
 * O dia do calendário local, sem hora.
 *
 * É o que permite contar dias sem que 22h de terça e 1h de quarta virem o
 * mesmo dia — ou dois, dependendo do fuso. O dia é o local porque a prefeitura
 * é local: a sessão das 22h de terça aconteceu na terça, para todo mundo que
 * estava lá.
 */
export const diaLocal = (valor: Date | string): number => {
  const data = comoDataLocal(valor);
  return Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
};
