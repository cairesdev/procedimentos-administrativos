/**
 * O erro do servidor de e-mail, traduzido para quem vai consertar.
 *
 * O que o nodemailer devolve é o que o OpenSSL ou o servidor SMTP disse — e
 * essas duas coisas falam com quem escreve código, não com quem administra uma
 * prefeitura. Um administrador que recebe
 *
 *     58B21C639A770000:error:0A00010B:SSL routines:
 *     tls_validate_record_header:wrong version number:
 *     ../deps/openssl/openssl/ssl/record/methods/tlsany_meth.c:77
 *
 * não tem como adivinhar que marcou "TLS direto" numa porta de STARTTLS. E é
 * exatamente isso que a mensagem significa: o cliente começou o aperto de mão
 * cifrado, o servidor respondeu em texto puro, e o OpenSSL leu o "220 " da
 * saudação SMTP como se fosse cabeçalho TLS.
 *
 * **A mensagem original nunca é jogada fora.** Ela fica no fim, entre
 * parênteses: a tradução resolve o caso conhecido, e o texto cru é o que
 * salva quando o caso não é nenhum dos previstos. Trocar um pelo outro seria
 * repetir o erro que esta função existe para corrigir.
 */

export type ContextoDoErro = {
  porta: number;
  tlsDireto: boolean;
};

type Traducao = {
  /** Reconhece o erro no texto que veio. */
  quando: RegExp;
  /** O que dizer. Recebe o contexto para apontar o campo errado pelo nome. */
  diga: (contexto: ContextoDoErro) => string;
};

const TRADUCOES: Traducao[] = [
  {
    /**
     * O caso que motivou este arquivo.
     *
     * TLS contra porta em texto puro. Quase sempre "TLS direto" marcado numa
     * porta 587 — mas o inverso (STARTTLS numa 465) dá outro erro, então aqui
     * a orientação é sempre a mesma direção.
     */
    quando: /wrong version number|packet length too long/i,
    diga: ({ porta, tlsDireto }) =>
      tlsDireto
        ? "A criptografia está como **TLS direto**, mas a porta "
          + `${porta} responde em texto puro. Troque para **STARTTLS** — ou, se o `
          + "provedor exige TLS direto, use a porta 465."
        : `A porta ${porta} parece esperar TLS desde o início. Troque a `
          + "criptografia para **TLS direto**, ou use a porta 587 com STARTTLS.",
  },
  {
    // O contrário: texto puro esperado, servidor só fala TLS. Costuma vir como
    // tempo esgotado na saudação, porque o servidor espera o ClientHello.
    quando: /greeting never received|Greeting never received/i,
    diga: ({ porta, tlsDireto }) =>
      tlsDireto
        ? `O servidor não respondeu na porta ${porta}. Confira o endereço e a porta.`
        : `A porta ${porta} não devolveu a saudação SMTP. Se for 465, ela exige `
          + "**TLS direto** — troque a criptografia. Se não for, confira o endereço.",
  },
  {
    quando: /ECONNREFUSED/i,
    diga: ({ porta }) =>
      `Nada atende na porta ${porta} desse servidor. Confira o endereço e a `
      + "porta com o provedor — e, se o servidor for interno, se o firewall "
      + "libera a saída.",
  },
  {
    quando: /ETIMEDOUT|ESOCKETTIMEDOUT|Connection timeout/i,
    diga: ({ porta }) =>
      `A conexão com a porta ${porta} esgotou o tempo. Costuma ser firewall `
      + "bloqueando a saída do servidor, ou endereço errado.",
  },
  {
    quando: /ENOTFOUND|EAI_AGAIN|getaddrinfo/i,
    diga: () =>
      "O endereço do servidor não foi encontrado. Confira se não há erro de "
      + "digitação no campo do servidor.",
  },
  {
    // 535 é senha; 534/535 com "application-specific" é conta com verificação
    // em duas etapas pedindo senha de aplicativo.
    quando: /\b53[45]\b|authentication failed|Username and Password not accepted/i,
    diga: () =>
      "O servidor recusou o usuário e a senha. Confira os dois — e, se a conta "
      + "tiver verificação em duas etapas, use uma **senha de aplicativo** em "
      + "vez da senha normal.",
  },
  {
    quando: /\b530\b|authentication required/i,
    diga: () =>
      "O servidor exige autenticação e nenhum usuário foi informado. Preencha "
      + "usuário e senha.",
  },
  {
    quando: /\b55[0-3]\b|relay|not permitted|sender address rejected/i,
    diga: () =>
      "O servidor recusou o remetente. Ele costuma exigir que o endereço no "
      + "campo **Remetente** seja o mesmo da conta autenticada, ou de um "
      + "domínio que ele aceite.",
  },
  {
    quando: /self.signed certificate|unable to verify the first certificate|CERT_/i,
    diga: () =>
      "O certificado do servidor não pôde ser verificado. É comum em servidor "
      + "interno com certificado próprio — nesse caso, use a porta 25 sem "
      + "criptografia dentro da rede, ou instale um certificado válido.",
  },
];

/**
 * A frase para a tela.
 *
 * Devolve a tradução quando reconhece, e o texto cru quando não reconhece —
 * nunca um "falha no envio" genérico, que apagaria a única pista existente.
 */
export const explicarErroDoSmtp = (erro: unknown, contexto: ContextoDoErro): string => {
  const original = (erro instanceof Error ? erro.message : String(erro)).trim();

  const traducao = TRADUCOES.find(({ quando }) => quando.test(original));
  if (!traducao) return original;

  // O original entre parênteses, cortado: alguns servidores devolvem
  // parágrafos, e a coluna da fila é lida numa tela.
  return `${traducao.diga(contexto)} (o servidor disse: ${original.slice(0, 200)})`;
};

/**
 * A combinação de porta e criptografia que quase sempre está errada.
 *
 * Serve de aviso na tela **antes** de o teste falhar, e não de trava: há
 * servidor interno em porta não convencional, e recusar o cadastro por causa
 * de um palpite seria pior que o aviso. Devolve `null` quando não há o que
 * dizer.
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
