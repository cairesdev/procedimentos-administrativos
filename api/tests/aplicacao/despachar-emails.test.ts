import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import {
  DespacharFilaDeEmails, TETO_DE_TENTATIVAS,
} from "../../src/application/email/DespacharFilaDeEmails";
import { cifrar } from "../../src/domain/email/SegredoDoSmtp";
import type { EmailParaEnviar } from "../../src/application/ports/EmailFilaRepository";

const CHAVE = randomBytes(32);

const emailNaFila = (sobrescrever: Partial<EmailParaEnviar> = {}): EmailParaEnviar => ({
  id: "e-1",
  orgaoId: "org-1",
  orgaoNome: "Prefeitura de Monção",
  tipo: "EXIGENCIA_AO_REQUERENTE",
  destinatario: "cidadao@exemplo.com",
  assunto: "Pendência no protocolo",
  corpo: "Falta o comprovante.",
  referenciaId: null,
  status: "PENDENTE",
  // Já vem incrementado: a reserva conta a tentativa antes de tentar.
  tentativas: 1,
  ultimoErro: null,
  agendadoPara: new Date().toISOString(),
  enviadoEm: null,
  criadoEm: new Date().toISOString(),
  ...sobrescrever,
});

const montar = (opcoes: {
  lote?: EmailParaEnviar[];
  configuracao?: Record<string, unknown> | null;
  falharEnvio?: string;
} = {}) => {
  const registro = {
    enviados: [] as string[],
    falhas: [] as { id: string; erro: string; proxima: Date | null }[],
    mandados: [] as Record<string, unknown>[],
  };

  const configuracao = opcoes.configuracao === undefined
    ? {
      id: "c-1", orgaoId: null, host: "smtp.exemplo.com", porta: 587,
      usuario: "conta", senhaCifrada: cifrar("segredo", CHAVE),
      remetente: "naoresponda@exemplo.com", tlsDireto: false, ativo: true,
      atualizadoEm: "2026-09-04", origem: "GLOBAL",
    }
    : opcoes.configuracao;

  const caso = new DespacharFilaDeEmails(
    {
      reservarLote: async () => opcoes.lote ?? [emailNaFila()],
      marcarEnviado: async (id: string) => { registro.enviados.push(id); },
      marcarFalha: async (id: string, erro: string, proxima: Date | null) => {
        registro.falhas.push({ id, erro, proxima });
      },
    } as never,
    { resolver: async () => configuracao } as never,
    {
      enviar: async (config: Record<string, unknown>, email: Record<string, unknown>) => {
        if (opcoes.falharEnvio) throw new Error(opcoes.falharEnvio);
        registro.mandados.push({ ...config, ...email });
      },
    } as never,
    CHAVE,
  );

  return { caso, registro };
};

describe("o despacho da fila de e-mails", () => {
  it("manda com o remetente da prefeitura e a senha decifrada", async () => {
    const { caso, registro } = montar();
    const resumo = await caso.executar();

    assert.equal(resumo.enviados, 1);
    assert.deepEqual(registro.enviados, ["e-1"]);

    const mandado = registro.mandados[0];
    // A senha chega em texto ao enviador, e só aqui: nunca sai da API nem
    // entra em log.
    assert.equal(mandado?.senha, "segredo");
    assert.equal(mandado?.remetente, '"Prefeitura de Monção" <naoresponda@exemplo.com>');
    assert.equal(mandado?.destinatario, "cidadao@exemplo.com");
  });

  it("sem SMTP configurado, o e-mail fica na fila em vez de morrer", async () => {
    /**
     * Não é falha da mensagem.
     *
     * Contar isto como tentativa gastaria as cinco em meia hora, enterrando
     * como FALHOU um e-mail que sairia perfeitamente assim que alguém
     * cadastrasse o SMTP.
     */
    const { caso, registro } = montar({ configuracao: null });
    const resumo = await caso.executar();

    assert.equal(resumo.semConfiguracao, 1);
    assert.equal(resumo.falharam, 0);
    assert.match(registro.falhas[0]?.erro ?? "", /Nenhum SMTP configurado/);
    assert.ok(registro.falhas[0]?.proxima, "volta para a fila, e não morre");
  });

  it("SMTP desligado não cai na global", async () => {
    // Desligar a sua é dizer "não quero mandar", não "mande por outro".
    const { caso, registro } = montar({
      configuracao: {
        id: "c-2", orgaoId: "org-1", host: "smtp.moncao.ma.gov.br", porta: 465,
        usuario: null, senhaCifrada: null, remetente: "x@moncao.ma.gov.br",
        tlsDireto: true, ativo: false, atualizadoEm: "2026-09-04", origem: "PREFEITURA",
      },
    });
    const resumo = await caso.executar();

    assert.equal(resumo.semConfiguracao, 1);
    assert.match(registro.falhas[0]?.erro ?? "", /desativado/);
  });

  it("falha guarda o erro do servidor como ele veio, e reagenda", async () => {
    // "535 authentication failed" diz o que corrigir; "falha no envio" não diz
    // nada a quem for consertar.
    const { caso, registro } = montar({ falharEnvio: "535 5.7.8 authentication failed" });
    const resumo = await caso.executar();

    assert.equal(resumo.falharam, 1);
    assert.match(registro.falhas[0]?.erro ?? "", /535 5\.7\.8 authentication failed/);
    assert.ok(registro.falhas[0]?.proxima, "ainda há tentativa sobrando");
  });

  it("no teto de tentativas, desiste e não reagenda", async () => {
    const { caso, registro } = montar({
      lote: [emailNaFila({ tentativas: TETO_DE_TENTATIVAS })],
      falharEnvio: "connect ECONNREFUSED",
    });
    await caso.executar();

    assert.equal(registro.falhas[0]?.proxima, null, "sem próxima = vira FALHOU");
  });

  it("um e-mail ruim não derruba o resto do lote", async () => {
    /**
     * O worker roda em laço.
     *
     * Uma exceção que subisse daqui mataria a rodada inteira por causa de uma
     * mensagem — as outras do lote ficariam reservadas até a espera vencer,
     * sem que ninguém tivesse tentado mandá-las.
     */
    let chamada = 0;
    const registro: string[] = [];

    const caso = new DespacharFilaDeEmails(
      {
        reservarLote: async () => [
          emailNaFila({ id: "e-1" }),
          emailNaFila({ id: "e-2" }),
          emailNaFila({ id: "e-3" }),
        ],
        marcarEnviado: async (id: string) => { registro.push(id); },
        marcarFalha: async () => {},
      } as never,
      {
        resolver: async () => ({
          id: "c-1", orgaoId: null, host: "h", porta: 25, usuario: null,
          senhaCifrada: null, remetente: "x@y.com", tlsDireto: false, ativo: true,
          atualizadoEm: "2026-09-04", origem: "GLOBAL",
        }),
      } as never,
      {
        enviar: async () => {
          chamada += 1;
          if (chamada === 2) throw new Error("caiu no meio");
        },
      } as never,
      CHAVE,
    );

    const resumo = await caso.executar();
    assert.deepEqual(registro, ["e-1", "e-3"]);
    assert.equal(resumo.enviados, 2);
    assert.equal(resumo.falharam, 1);
  });

  it("SMTP sem autenticação envia com senha nula", async () => {
    // Servidor interno de prefeitura costuma aceitar sem autenticar.
    const { caso, registro } = montar({
      configuracao: {
        id: "c-3", orgaoId: null, host: "smtp.interno.local", porta: 25,
        usuario: null, senhaCifrada: null, remetente: "sistema@interno.local",
        tlsDireto: false, ativo: true, atualizadoEm: "2026-09-04", origem: "GLOBAL",
      },
    });
    await caso.executar();
    assert.equal(registro.mandados[0]?.senha, null);
  });
});
