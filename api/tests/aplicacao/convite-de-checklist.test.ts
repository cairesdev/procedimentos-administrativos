import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ConvidarParaChecklist, hashDoToken,
} from "../../src/application/checklist/ConvidarParaChecklist";

const recusa = async (acao: () => Promise<unknown>, mensagem: RegExp) => {
  await assert.rejects(acao, (erro: Error) => {
    assert.match(erro.message, mensagem);
    return true;
  });
};

const AMANHA = new Date(Date.now() + 86_400_000).toISOString();
const ONTEM = new Date(Date.now() - 86_400_000).toISOString();

const ITEM_FORNECEDOR = {
  id: "item-f", ordem: 1, titulo: "Certidão", descricao: null, exigeAnexo: true,
  prazoLimite: null, recorrente: false, periodicidadeDias: null,
  setorId: null, setorNome: null, departamentoId: null, departamentoNome: null,
  paraFornecedor: true, dispensadoEm: null, dispensaMotivo: null,
  dispensadoPorNome: null, ultimoCiclo: null, historico: [],
};

const ITEM_INTERNO = {
  ...ITEM_FORNECEDOR, id: "item-i", titulo: "Parecer da Controladoria",
  paraFornecedor: false,
};

const montar = (opcoes: {
  convite?: Record<string, unknown> | null;
  itensDoFornecedor?: boolean;
} = {}) => {
  const gravado = { criados: [] as unknown[], ciclos: [] as unknown[], usos: [] as string[] };

  const caso = new ConvidarParaChecklist(
    {
      criar: async (dados: unknown) => { gravado.criados.push(dados); return "cv-1"; },
      buscarPorHash: async () => (opcoes.convite === undefined
        ? {
          id: "cv-1", checklistId: "ck-1", orgaoId: "org-1",
          orgaoNome: "Prefeitura", expiraEm: AMANHA, revogadoEm: null,
        }
        : opcoes.convite),
      buscarAberto: async () => null,
      revogarAbertos: async () => undefined,
      registrarUso: async (id: string) => { gravado.usos.push(id); },
      itemEhDoFornecedor: async (id: string) => id === "item-f",
      cicloPertenceAoChecklist: async () => true,
    } as never,
    {
      buscar: async () => ({
        id: "ck-1", titulo: "Habilitação", descricao: null,
        itens: opcoes.itensDoFornecedor === false
          ? [ITEM_INTERNO]
          : [ITEM_FORNECEDOR, ITEM_INTERNO],
      }),
      buscarItemParaCumprir: async (_o: string, id: string) => ({
        id, checklistId: "ck-1", titulo: "Certidão", exigeAnexo: true,
        recorrente: false, periodicidadeDias: null, dispensadoEm: null,
        ultimoCicloId: null, ultimoCicloSituacao: null,
        ultimoCicloVigenciaAte: null, ultimoCiclo: 0,
      }),
      abrirCiclo: async (dados: unknown) => { gravado.ciclos.push(dados); return "ciclo-1"; },
    } as never,
    { registrar: async () => undefined } as never,
    (async (fn: (tx: unknown) => unknown) => fn({})) as never,
  );

  return { caso, gravado };
};

const convite = { orgaoId: "org-1", usuarioId: "u-1", checklistId: "ck-1" };

describe("gerar o link", () => {
  it("devolve o token e guarda só o hash", async () => {
    const { caso, gravado } = montar();
    const { token } = await caso.convidar(convite);

    const criado = gravado.criados[0] as { tokenHash: string };
    assert.equal(criado.tokenHash, hashDoToken(token));
    assert.notEqual(criado.tokenHash, token);
    assert.equal(criado.tokenHash.length, 64);
  });

  it("dois convites nunca dão o mesmo token", async () => {
    const { caso } = montar();
    const primeiro = await caso.convidar(convite);
    const segundo = await caso.convidar(convite);
    assert.notEqual(primeiro.token, segundo.token);
  });

  it("checklist sem item do fornecedor não gera link", async () => {
    // O link abriria uma página vazia, e quem recebesse não saberia por quê.
    const { caso, gravado } = montar({ itensDoFornecedor: false });
    await recusa(() => caso.convidar(convite), /Nenhum item deste checklist é do fornecedor/);
    assert.equal(gravado.criados.length, 0);
  });
});

describe("abrir pelo link", () => {
  it("mostra só os itens do fornecedor", async () => {
    /**
     * O checklist mistura exigências de vários setores. Mandar a lista inteira
     * contaria a quem está de fora o que a prefeitura exige de si mesma.
     */
    const { caso } = montar();
    const pagina = await caso.abrir("token-qualquer");

    assert.equal(pagina.itens.length, 1);
    assert.equal(pagina.itens[0]!.titulo, "Certidão");
  });

  it("token inexistente, expirado e revogado dão a mesma resposta", async () => {
    // Distinguir contaria a quem tem um link velho que ele existiu, e a quem
    // tenta adivinhar que chegou perto.
    const mensagem = /não é válido ou já expirou/;

    await recusa(() => montar({ convite: null }).caso.abrir("x"), mensagem);
    await recusa(
      () => montar({
        convite: {
          id: "cv-1", checklistId: "ck-1", orgaoId: "org-1", orgaoNome: "P",
          expiraEm: ONTEM, revogadoEm: null,
        },
      }).caso.abrir("x"),
      mensagem,
    );
    await recusa(
      () => montar({
        convite: {
          id: "cv-1", checklistId: "ck-1", orgaoId: "org-1", orgaoNome: "P",
          expiraEm: AMANHA, revogadoEm: ONTEM,
        },
      }).caso.abrir("x"),
      mensagem,
    );
  });
});

describe("cumprir pelo link", () => {
  it("abre o ciclo marcado como externo", async () => {
    const { caso, gravado } = montar();
    await caso.cumprir({ token: "t", itemId: "item-f" });

    const ciclo = gravado.ciclos[0] as { cumpridoPorExterno: boolean; cumpridoPor: null };
    assert.equal(ciclo.cumpridoPorExterno, true);
    assert.equal(ciclo.cumpridoPor, null);
    assert.deepEqual(gravado.usos, ["cv-1"]);
  });

  it("item que não é do fornecedor não é alcançado", async () => {
    /**
     * A tela dele nem mostra que este item existe — mas um id colado na
     * requisição chegaria aqui. Sem esta trava, o fornecedor cumpriria a
     * exigência interna da Controladoria.
     */
    const { caso, gravado } = montar();
    await recusa(
      () => caso.cumprir({ token: "t", itemId: "item-i" }),
      /não encontrado/,
    );
    assert.equal(gravado.ciclos.length, 0);
  });

  it("com token inválido não cumpre nada", async () => {
    const { caso, gravado } = montar({ convite: null });
    await recusa(
      () => caso.cumprir({ token: "t", itemId: "item-f" }),
      /não é válido ou já expirou/,
    );
    assert.equal(gravado.ciclos.length, 0);
  });
});
