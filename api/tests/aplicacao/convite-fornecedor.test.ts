import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ConvidarFornecedor, hashDoToken,
} from "../../src/application/fornecedor/ConvidarFornecedor";
import { auditoriaFalsa, filaDeEmailFalsa, recusa, semTransacao } from "../ajudantes/dobras";
import { EnfileirarEmail } from "../../src/application/email/EnfileirarEmail";

/**
 * Link externo do fornecedor.
 *
 * `fornecedor_historico.alterado_por` aceita `link_externo` desde a 0001, e o
 * caminho que produziria esse valor nunca existiu. O cadastro é global e quem
 * o digita hoje é o setor de compras, copiando de um papel.
 */

const ONTEM = new Date(Date.now() - 86_400_000).toISOString();
const DAQUI_A_UM_MES = new Date(Date.now() + 30 * 86_400_000).toISOString();

const montar = () => {
  const gravado = {
    convites: [] as Record<string, unknown>[],
    atualizacoes: [] as { id: string; dados: unknown; autor: string }[],
    usos: [] as string[],
    revogados: [] as string[],
  };
  const auditoria = auditoriaFalsa();

  const convites = {
    criar: async (dados: Record<string, unknown>) => {
      const id = `conv-${gravado.convites.length + 1}`;
      gravado.convites.push({ ...dados, id, revogadoEm: null, orgaoNome: "Prefeitura Teste" });
      return id;
    },
    buscarPorHash: async (hash: string) =>
      gravado.convites.find((convite) => convite.tokenHash === hash) ?? null,
    buscarAberto: async () => gravado.convites.find((c) => c.revogadoEm === null) ?? null,
    registrarUso: async (id: string) => { gravado.usos.push(id); },
    revogarAbertos: async (fornecedorId: string) => {
      gravado.revogados.push(fornecedorId);
      for (const convite of gravado.convites) convite.revogadoEm = new Date().toISOString();
    },
  };

  const fornecedores = {
    buscarPorId: async (id: string) =>
      id === "forn-1"
        ? { id, documento: "11222333000144", razaoSocial: "ACME LTDA", endereco: "Rua A" }
        : null,
    atualizar: async (id: string, dados: unknown, autor: string) => {
      gravado.atualizacoes.push({ id, dados, autor });
    },
  };

  return {
    gravado,
    auditados: auditoria.registros,
    caso: new ConvidarFornecedor(
      convites as never, fornecedores as never, auditoria.porta as never,
      semTransacao, new EnfileirarEmail(filaDeEmailFalsa().porta as never),
      "https://exemplo.gov.br",
    ),
  };
};

const convidar = { orgaoId: "org-1", usuarioId: "u-1", fornecedorId: "forn-1" };

describe("gerar o convite", () => {
  it("devolve o token e guarda só o hash", async () => {
    // Quem lê o banco não pode abrir a página de ninguém — mesma regra da senha.
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convidar);

    assert.ok(token.length >= 40, "token curto demais para ser segredo");
    assert.equal(gravado.convites[0]!.tokenHash, hashDoToken(token));
    assert.ok(!JSON.stringify(gravado.convites[0]).includes(token), "o token foi gravado em texto");
  });

  it("mata o convite anterior ao gerar outro", async () => {
    // Dois links vivos para o mesmo fornecedor tornariam a revogação inútil.
    const { caso, gravado } = montar();
    await caso.convidar(convidar);
    await caso.convidar(convidar);

    assert.equal(gravado.revogados.length, 2);
  });

  it("recusa fornecedor inexistente, sem gravar convite", async () => {
    const { caso, gravado } = montar();
    await recusa(
      () => caso.convidar({ ...convidar, fornecedorId: "nao-existe" }),
      /não encontrado/,
    );
    assert.equal(gravado.convites.length, 0);
  });

  it("registra na auditoria da prefeitura que convidou", async () => {
    const { caso, auditados } = montar();
    await caso.convidar(convidar);

    assert.equal(auditados[0]!.tipoEvento, "FORNECEDOR_CONVIDADO");
    assert.equal(auditados[0]!.orgaoId, "org-1");
  });
});

describe("abrir e salvar pelo link", () => {
  it("mostra o cadastro, e nada além dele", async () => {
    // O convite dá acesso ao próprio cadastro — não à lista de prefeituras que
    // contratam o fornecedor, nem a contrato nenhum.
    const { caso } = montar();
    const { token } = await caso.convidar(convidar);
    const pagina = await caso.abrir(token);

    assert.equal(pagina.razaoSocial, "ACME LTDA");
    assert.equal(pagina.documento, "11222333000144");
    assert.ok(!("contratos" in pagina));
    assert.ok(!("orgaos" in pagina));
  });

  it("grava com o autor link_externo", async () => {
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convidar);
    await caso.salvar(token, { razaoSocial: "ACME COMÉRCIO LTDA", telefone: "9999" });

    assert.equal(gravado.atualizacoes[0]!.autor, "link_externo");
    assert.equal(gravado.usos.length, 1);
  });

  it("a auditoria da alteração fica com a prefeitura convidante", async () => {
    // O fornecedor é global; quem responde pelo cadastro alterado é quem
    // abriu a porta.
    const { caso, auditados } = montar();
    const { token } = await caso.convidar(convidar);
    await caso.salvar(token, { razaoSocial: "ACME COMÉRCIO LTDA" });

    const evento = auditados.at(-1)!;
    assert.equal(evento.tipoEvento, "FORNECEDOR_ATUALIZADO_POR_LINK");
    assert.equal(evento.orgaoId, "org-1");
    assert.equal(evento.usuarioId, undefined);
  });

  it("razão social em branco é recusada, e nada é gravado", async () => {
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convidar);

    await recusa(() => caso.salvar(token, { razaoSocial: "   " }), /em branco/);
    assert.equal(gravado.atualizacoes.length, 0);
  });

  it("continua valendo depois do primeiro uso", async () => {
    // O fornecedor volta para corrigir o que digitou errado.
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convidar);
    await caso.salvar(token, { razaoSocial: "PRIMEIRA" });
    await caso.salvar(token, { razaoSocial: "SEGUNDA" });

    assert.equal(gravado.atualizacoes.length, 2);
  });
});

describe("link que não vale mais", () => {
  const mesmaMensagem = /não é válido ou já expirou/;

  it("token inexistente", async () => {
    const { caso } = montar();
    await recusa(() => caso.abrir("inventado"), mesmaMensagem);
  });

  it("token expirado", async () => {
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convidar);
    gravado.convites[0]!.expiraEm = ONTEM;

    await recusa(() => caso.abrir(token), mesmaMensagem);
    await recusa(() => caso.salvar(token, { razaoSocial: "X" }), mesmaMensagem);
  });

  it("token revogado", async () => {
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convidar);
    await caso.revogar(convidar);

    assert.ok(gravado.convites[0]!.revogadoEm);
    await recusa(() => caso.abrir(token), mesmaMensagem);
  });

  it("os três dão a MESMA mensagem", async () => {
    // Distinguir contaria a quem tem um link velho que ele existiu, e a quem
    // tenta adivinhar que chegou perto.
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convidar);

    const erroInexistente = await caso.abrir("outro").catch((erro) => erro.message);
    gravado.convites[0]!.expiraEm = ONTEM;
    const erroExpirado = await caso.abrir(token).catch((erro) => erro.message);

    assert.equal(erroInexistente, erroExpirado);
  });

  it("convite válido não é recusado por engano", async () => {
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convidar);
    gravado.convites[0]!.expiraEm = DAQUI_A_UM_MES;

    const pagina = await caso.abrir(token);
    assert.equal(pagina.razaoSocial, "ACME LTDA");
  });
});

describe("o documento não se altera pelo link", () => {
  it("o tipo do caso de uso exclui `documento`", () => {
    // A garantia real é do tipo `DadosDoConvite`, que é `Omit<…, "documento">`,
    // e do schema da rota pública, que não declara o campo. Este teste guarda
    // a intenção: CNPJ é a identidade, e trocá-lo transformaria o fornecedor
    // em outro, levando junto contratos de todas as prefeituras.
    const rota = readFileSync(
      path.join(__dirname, "..", "..", "src", "interface", "http", "routes",
        "fornecedorPublico.ts"),
      "utf8",
    );
    const schema = /dadosSchema = z\.object\(\{([\s\S]*?)\}\);/.exec(rota)![1]!;
    assert.ok(!/documento/.test(schema), "a rota pública aceita `documento`");
  });
});
