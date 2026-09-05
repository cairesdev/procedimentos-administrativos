import { decifrar } from "../../domain/email/SegredoDoSmtp";
import { remetenteComNome } from "../../domain/email/Remetente";
import { explicarErroDoSmtp } from "../../domain/email/ErroDoSmtp";
import type { ConfiguracaoEmailRepository } from "../ports/ConfiguracaoEmailRepository";
import type { EmailFilaRepository, EmailParaEnviar } from "../ports/EmailFilaRepository";
import type { EnviadorDeEmail } from "../ports/EnviadorDeEmail";

/**
 * Quantas vezes insistir antes de desistir.
 *
 * Cinco tentativas cobrem o caso comum — SMTP reiniciando, rede da prefeitura
 * oscilando, provedor com fila cheia. Depois disso o problema não é passageiro:
 * é endereço que não existe, credencial errada ou remetente bloqueado, e
 * insistir só queima reputação do domínio. O e-mail vira FALHOU, aparece na
 * tela com o motivo, e alguém decide o que fazer.
 */
export const TETO_DE_TENTATIVAS = 5;

/**
 * Espera crescente entre tentativas: 1, 4, 9 e 16 minutos.
 *
 * Insistir de minuto em minuto contra um servidor fora do ar não entrega
 * antes e ainda parece ataque para quem está do outro lado.
 */
const esperaEmMinutos = (tentativas: number): number => tentativas * tentativas;

export type ResumoDoDespacho = {
  enviados: number;
  falharam: number;
  semConfiguracao: number;
};

export class DespacharFilaDeEmails {
  constructor(
    private readonly fila: EmailFilaRepository,
    private readonly configuracoes: ConfiguracaoEmailRepository,
    private readonly enviador: EnviadorDeEmail,
    /** Chave que decifra a senha do SMTP; vem de `EMAIL_CHAVE`. */
    private readonly chave: Buffer,
  ) {}

  /**
   * Uma rodada: pega um lote, tenta mandar cada um, marca o resultado.
   *
   * **Não lança.** O worker roda em laço, e uma exceção que suba daqui mataria
   * a rodada inteira por causa de um e-mail — os outros do lote ficariam
   * reservados até a espera vencer, sem que ninguém tivesse tentado mandá-los.
   * Cada mensagem é isolada e o erro dela vai para a coluna, que é onde alguém
   * consegue ler.
   */
  executar = async (tamanhoDoLote = 20): Promise<ResumoDoDespacho> => {
    const lote = await this.fila.reservarLote(tamanhoDoLote);
    const resumo: ResumoDoDespacho = { enviados: 0, falharam: 0, semConfiguracao: 0 };

    for (const email of lote) {
      const resultado = await this.despachar(email);
      resumo[resultado] += 1;
    }
    return resumo;
  };

  private despachar = async (
    email: EmailParaEnviar,
  ): Promise<keyof ResumoDoDespacho> => {
    const configuracao = await this.configuracoes.resolver(email.orgaoId);

    /**
     * Sem configuração, ou com ela desligada, o e-mail **fica na fila**.
     *
     * Não é falha da mensagem, e contá-la como tentativa gastaria as cinco em
     * meia hora, enterrando como FALHOU um e-mail que sairia perfeitamente
     * assim que alguém cadastrasse o SMTP. Volta para PENDENTE com espera
     * longa; a tela mostra o motivo.
     */
    if (!configuracao || !configuracao.ativo) {
      const motivo = configuracao
        ? "O SMTP desta prefeitura está desativado. Reative-o na tela de e-mail."
        : "Nenhum SMTP configurado. Cadastre um no administrativo geral.";
      await this.fila.marcarFalha(
        email.id, motivo, new Date(Date.now() + 30 * 60 * 1000),
      );
      return "semConfiguracao";
    }

    try {
      // A senha só existe em texto aqui dentro, entre decifrar e enviar. Nunca
      // volta em resposta da API e nunca entra em log.
      const senha = configuracao.senhaCifrada
        ? decifrar(configuracao.senhaCifrada, this.chave)
        : null;

      await this.enviador.enviar(
        {
          host: configuracao.host,
          porta: configuracao.porta,
          usuario: configuracao.usuario,
          senha,
          tlsDireto: configuracao.tlsDireto,
        },
        {
          remetente: remetenteComNome(email.orgaoNome, configuracao.remetente),
          destinatario: email.destinatario,
          assunto: email.assunto,
          corpo: email.corpo,
        },
      );

      await this.fila.marcarEnviado(email.id);
      return "enviados";
    } catch (erro) {
      /**
       * `email.tentativas` já vem incrementado pela reserva.
       *
       * A reserva conta a tentativa antes de tentar, de propósito: se o
       * processo morrer no meio do envio, a linha volta para a fila com a
       * tentativa contada, em vez de tentar para sempre.
       */
      const acabou = email.tentativas >= TETO_DE_TENTATIVAS;
      const proxima = acabou
        ? null
        : new Date(Date.now() + esperaEmMinutos(email.tentativas) * 60 * 1000);

      await this.fila.marcarFalha(
        email.id,
        // Traduzido também aqui: é este texto que a tela de e-mails mostra
        // embaixo do assunto, e é por ele que alguém vai consertar.
        explicarErroDoSmtp(erro, {
          porta: configuracao.porta,
          tlsDireto: configuracao.tlsDireto,
        }).slice(0, 500),
        proxima,
      );
      return "falharam";
    }
  };
}
