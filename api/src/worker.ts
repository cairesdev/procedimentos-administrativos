import { chaveDoAmbiente } from "./domain/email/SegredoDoSmtp";
import { intervaloDoAmbiente, loteDoAmbiente } from "./domain/email/RitmoDoWorker";
import { DespacharFilaDeEmails } from "./application/email/DespacharFilaDeEmails";
import { PostgresConfiguracaoEmailRepository } from "./infrastructure/db/PostgresConfiguracaoEmailRepository";
import { PostgresEmailFilaRepository } from "./infrastructure/db/PostgresEmailFilaRepository";
import { SmtpEnviador } from "./infrastructure/email/SmtpEnviador";
import { pool } from "./infrastructure/db/pool";

/**
 * O worker que esvazia a fila de e-mails.
 *
 * Contêiner separado, com a mesma imagem da API e outro comando. Pico de envio
 * não afeta quem está na tela, e reiniciar um não derruba o outro.
 *
 * Duas réplicas podem rodar juntas: a reserva do lote usa `FOR UPDATE SKIP
 * LOCKED`, então a segunda pula o que a primeira já segura, em vez de mandar o
 * mesmo e-mail duas vezes.
 */

const intervalo = intervaloDoAmbiente();
const lote = loteDoAmbiente();

const INTERVALO_MS = intervalo.valor;
const TAMANHO_DO_LOTE = lote.valor;

const main = async (): Promise<void> => {
  /**
   * Sem `EMAIL_CHAVE`, o worker **não sobe**.
   *
   * Ele não teria como decifrar senha nenhuma, e todo envio autenticado
   * falharia — cinco vezes cada, enterrando a fila em FALHOU com um erro do
   * servidor SMTP que não diz qual é o problema de verdade. Melhor não subir e
   * dizer o que falta.
   */
  const chave = chaveDoAmbiente();

  const despachar = new DespacharFilaDeEmails(
    new PostgresEmailFilaRepository(),
    new PostgresConfiguracaoEmailRepository(),
    new SmtpEnviador(),
    chave,
  );

  let rodando = true;
  const parar = (sinal: string) => {
    // Termina a rodada em curso antes de sair: matar no meio deixaria e-mails
    // reservados esperando a espera vencer para serem tentados de novo.
    console.log(`worker de e-mail: ${sinal} recebido, encerrando após esta rodada`);
    rodando = false;
  };
  process.on("SIGTERM", () => parar("SIGTERM"));
  process.on("SIGINT", () => parar("SIGINT"));

  // O valor corrigido é dito em voz alta: o worker rodando num ritmo que
  // ninguém pediu, em silêncio, é pior que a variável errada.
  if (intervalo.aviso) console.warn(`EMAIL_INTERVALO_MS: ${intervalo.aviso}`);
  if (lote.aviso) console.warn(`EMAIL_LOTE: ${lote.aviso}`);

  console.log(
    `worker de e-mail no ar: lote de ${TAMANHO_DO_LOTE} a cada ${INTERVALO_MS / 1000}s`,
  );

  while (rodando) {
    try {
      const resumo = await despachar.executar(TAMANHO_DO_LOTE);
      if (resumo.enviados || resumo.falharam || resumo.semConfiguracao) {
        console.log(
          `enviados=${resumo.enviados} falharam=${resumo.falharam} `
          + `semConfiguracao=${resumo.semConfiguracao}`,
        );
      }
    } catch (erro) {
      /**
       * Banco fora do ar, e nada mais.
       *
       * `executar` já isola o erro de cada mensagem; o que chega aqui é falha
       * de infraestrutura. O laço continua: o worker que morre por causa de um
       * Postgres reiniciando precisaria de alguém para levantá-lo, e ninguém
       * está olhando às três da manhã.
       */
      console.error("rodada do worker falhou:", erro);
    }

    if (rodando) await new Promise((resolve) => setTimeout(resolve, INTERVALO_MS));
  }

  await pool.end();
  console.log("worker de e-mail encerrado");
};

main().catch((erro) => {
  console.error("worker de e-mail não subiu:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
