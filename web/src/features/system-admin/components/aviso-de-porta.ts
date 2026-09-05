/**
 * A combinação de porta e criptografia que quase sempre está errada.
 *
 * Espelha `api/src/domain/email/ErroDoSmtp.ts` — e é uma cópia consciente. O
 * texto precisa aparecer enquanto a pessoa digita, sem ida ao servidor, e são
 * três regras que cabem em dez linhas. Trazer o domínio da API para o bundle do
 * web por causa disto custaria mais do que a duplicação.
 *
 * Aviso, e não trava: existe servidor interno em porta fora do convencional, e
 * recusar o cadastro por causa de um palpite seria pior que o aviso.
 */
export const avisoDePortaETls = (porta: number, tlsDireto: boolean): string | null => {
  if (porta === 587 && tlsDireto) {
    return "A porta 587 quase sempre usa STARTTLS, não TLS direto. "
      + "Com TLS direto o envio falha com \"wrong version number\".";
  }
  if (porta === 465 && !tlsDireto) {
    return "A porta 465 quase sempre exige TLS direto desde o início.";
  }
  if (porta === 25 && tlsDireto) {
    return "A porta 25 quase nunca fala TLS direto.";
  }
  return null;
};
