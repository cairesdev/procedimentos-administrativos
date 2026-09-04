import { createTransport, type Transporter } from "nodemailer";
import type {
  ConfiguracaoDeEnvio, EmailAEnviar, EnviadorDeEmail,
} from "../../application/ports/EnviadorDeEmail";

/**
 * O envio por SMTP.
 *
 * A configuração chega por parâmetro porque cada e-mail pode sair por um
 * servidor diferente — a prefeitura com domínio próprio manda pelo dela.
 * Montar um transporte por mensagem abriria uma conexão TCP e um handshake TLS
 * a cada envio, então eles ficam guardados por configuração.
 */

/** Chave do transporte guardado. A senha entra para o cache trocar quando ela gira. */
const chaveDo = (c: ConfiguracaoDeEnvio): string =>
  [c.host, c.porta, c.usuario ?? "", c.senha ?? "", c.tlsDireto].join("|");

export class SmtpEnviador implements EnviadorDeEmail {
  /**
   * Transportes vivos, um por configuração.
   *
   * O mapa é pequeno por natureza — uma entrada por prefeitura que configurou
   * SMTP próprio, mais a global — e o processo é o worker, que só faz isto.
   * Uma configuração alterada gera chave nova e o transporte antigo fica
   * ocioso até o processo reiniciar; fechar o antigo exigiria saber que ele
   * não está no meio de um envio, e o ganho não paga a complicação.
   */
  private readonly transportes = new Map<string, Transporter>();

  private transporte = (configuracao: ConfiguracaoDeEnvio): Transporter => {
    const chave = chaveDo(configuracao);
    const guardado = this.transportes.get(chave);
    if (guardado) return guardado;

    const transporte = createTransport({
      host: configuracao.host,
      port: configuracao.porta,
      // 465 é TLS desde o aperto de mão; 587 sobe para TLS com STARTTLS.
      secure: configuracao.tlsDireto,
      ...(configuracao.usuario && configuracao.senha
        ? { auth: { user: configuracao.usuario, pass: configuracao.senha } }
        : {}),
      /**
       * Tempos curtos, de propósito.
       *
       * O worker tem uma fila para andar. Um servidor que não responde em
       * quinze segundos não vai responder, e esperar o padrão do nodemailer
       * (dois minutos) deixaria a fila parada atrás de um único endereço
       * ruim. A tentativa volta com espera crescente, que é o lugar certo de
       * insistir.
       */
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    this.transportes.set(chave, transporte);
    return transporte;
  };

  enviar = async (
    configuracao: ConfiguracaoDeEnvio,
    email: EmailAEnviar,
  ): Promise<void> => {
    await this.transporte(configuracao).sendMail({
      from: email.remetente,
      to: email.destinatario,
      subject: email.assunto,
      // `text` e não `html`: o que estas mensagens têm a dizer cabe em texto, e
      // texto é lido em qualquer cliente, no leitor de tela e no celular velho
      // da repartição.
      text: email.corpo,
    });
  };
}
