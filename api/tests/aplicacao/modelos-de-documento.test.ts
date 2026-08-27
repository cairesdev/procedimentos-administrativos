import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EmitirDocumento } from "../../src/application/documento/EmitirDocumento";
import { ManterModelos } from "../../src/application/documento/ManterModelos";
import { CATALOGO_POR_ESCOPO } from "../../src/domain/documento/Catalogo";
import { auditoriaFalsa, recusa } from "../ajudantes/dobras";

type Modelo = Record<string, unknown> & { id: string; tipo: string; orgaoId: string | null };

const montar = () => {
  const gravado = {
    modelos: [] as Modelo[],
    emitidos: [] as Record<string, unknown>[],
    escoposPedidos: [] as string[],
    sequencia: 0,
  };
  const auditoria = auditoriaFalsa();

  const documentos = {
    resolverModelo: async (orgaoId: string, tipo: string) => {
      const doOrgao = gravado.modelos.find((m) => m.orgaoId === orgaoId && m.tipo === tipo);
      if (doOrgao) return { ...doOrgao, origem: "PREFEITURA" };
      const global = gravado.modelos.find((m) => m.orgaoId === null && m.tipo === tipo);
      return global ? { ...global, origem: "GLOBAL" } : null;
    },
    listarModelosGlobais: async () => gravado.modelos.filter((m) => m.orgaoId === null),
    tipoEmUso: async (orgaoId: string | null, tipo: string) =>
      gravado.modelos.some((m) => m.tipo === tipo && (m.orgaoId === orgaoId || m.orgaoId === null)),
    criarModelo: async (dados: Record<string, unknown>) => {
      const id = `mod-${++gravado.sequencia}`;
      gravado.modelos.push({ id, ...dados } as Modelo);
      return id;
    },
    atualizarModelo: async (id: string, dados: Record<string, unknown>) => {
      Object.assign(gravado.modelos.find((m) => m.id === id)!, dados);
    },
    removerModelo: async (id: string) => {
      gravado.modelos.splice(gravado.modelos.findIndex((m) => m.id === id), 1);
    },
    rascunhar: async (dados: Record<string, unknown>) => {
      const id = `doc-${gravado.emitidos.length + 1}`;
      // O falso guarda o que a tabela guarda: rascunho nasce sem data, com o
      // corpo repetido em `corpoOriginal`.
      gravado.emitidos.push({
        ...dados, id, situacao: "RASCUNHO", data: null,
        corpoOriginal: dados.corpo, editadoEm: null, canceladoEm: null,
        emitidoPorUsuarioId: dados.emitidoPorUsuarioId,
      });
      return id;
    },
    salvarCorpo: async (_orgao: string, id: string, corpo: string, usuarioId: string) => {
      const doc = gravado.emitidos.find((item) => item.id === id)!;
      Object.assign(doc, { corpo, editadoEm: "2026-08-26T12:00:00Z", editadoPor: usuarioId });
    },
    confirmarEmissao: async (_orgao: string, id: string) => {
      const doc = gravado.emitidos.find((item) => item.id === id)!;
      if (doc.situacao !== "RASCUNHO") return false;
      Object.assign(doc, { situacao: "EMITIDO", data: "2026-08-26T12:00:00Z" });
      return true;
    },
    descartarRascunho: async (_orgao: string, id: string) => {
      gravado.emitidos.splice(gravado.emitidos.findIndex((item) => item.id === id), 1);
    },
    buscarEmitido: async (_orgao: string, id: string) =>
      gravado.emitidos.find((doc) => doc.id === id) ?? null,
  };

  const usuarios = {
    buscarPerfil: async () => ({
      nome: "Maria Souza", papelBase: "ADMIN",
      lotacoes: [{ id: "lot-1", destino: "Protocolo" }],
    }),
  };

  /** Contexto cheio: todo marcador do escopo com valor. */
  const contexto = {
    montar: async (_orgao: string, escopo: string) => {
      gravado.escoposPedidos.push(escopo);
      const catalogo = CATALOGO_POR_ESCOPO[escopo as keyof typeof CATALOGO_POR_ESCOPO];
      if (!catalogo) return null;

      const dados: Record<string, unknown> = {};
      for (const caminho of catalogo.valores) {
        const [raiz, folha] = caminho.split(".");
        if (!folha) {
          dados[raiz!] = "x";
          continue;
        }
        dados[raiz!] ??= {};
        (dados[raiz!] as Record<string, string>)[folha] = "x";
      }
      for (const [lista, campos] of Object.entries(catalogo.listas)) {
        dados[lista] = [Object.fromEntries(campos.map((campo) => [campo, "x"]))];
      }
      return dados;
    },
  };

  return {
    gravado,
    auditados: auditoria.registros,
    modelos: new ManterModelos(documentos as never),
    emissao: new EmitirDocumento(
      documentos as never, contexto as never, usuarios as never, auditoria.porta as never,
    ),
  };
};

describe("modelo padrão e personalização", () => {
  it("prefeitura sem versão própria usa o modelo global", async () => {
    const { modelos, emissao, gravado, auditados } = montar();
    await modelos.criarPersonalizado(null, {
      escopo: "PROCESSO", nome: "Despacho", titulo: "DESPACHO",
      corpo: "<p>{{processo.numeroProtocolo}} — {{autor.nome}}</p>", ativo: true,
    });

    const { codigo } = await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });

    assert.match(codigo, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal((auditados[0]!.detalhes as { origem: string }).origem, "GLOBAL");
    assert.ok(String(gravado.emitidos[0]!.corpo).includes("Maria Souza"));
  });

  it("editar o modelo não reescreve documento já emitido", async () => {
    // É a decisão central do motor: a peça guarda o retrato do momento.
    const { modelos, emissao, gravado } = montar();
    await modelos.criarPersonalizado(null, {
      escopo: "PROCESSO", nome: "Despacho", titulo: "DESPACHO",
      corpo: "<p>Versão um</p>", ativo: true,
    });
    await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });
    const antes = String(gravado.emitidos[0]!.corpo);

    await modelos.salvarDaPrefeitura("org-1", "DESPACHO", {
      nome: "Despacho", titulo: "OUTRO TÍTULO", corpo: "<p>Versão dois</p>", ativo: true,
    });

    assert.equal(String(gravado.emitidos[0]!.corpo), antes, "documento emitido foi reescrito");
    assert.ok(antes.includes("Versão um"));

    await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });
    assert.ok(String(gravado.emitidos[1]!.corpo).includes("Versão dois"));
    assert.equal(gravado.emitidos[1]!.titulo, "OUTRO TÍTULO");
  });

  it("a cópia da prefeitura sempre tem padrão atrás dela", async () => {
    // Herdar `personalizado` do global tiraria o "restaurar padrão" e
    // ofereceria "excluir" no lugar, sem caminho de volta.
    const { modelos, gravado } = montar();
    await modelos.criarPersonalizado(null, {
      escopo: "PROCESSO", nome: "Despacho", titulo: "D", corpo: "<p>global</p>", ativo: true,
    });
    await modelos.salvarDaPrefeitura("org-1", "DESPACHO", {
      nome: "Despacho", titulo: "D", corpo: "<p>própria</p>", ativo: true,
    });

    const daPrefeitura = gravado.modelos.find((m) => m.orgaoId === "org-1")!;
    assert.equal(daPrefeitura.escopo, "PROCESSO", "escopo não foi herdado do global");
    assert.equal(daPrefeitura.personalizado, false);

    await modelos.restaurarPadrao("org-1", "DESPACHO");
    assert.equal((await modelos.resolver("org-1", "DESPACHO")).origem, "GLOBAL");
    assert.equal(gravado.modelos.length, 1, "restaurar levou o global junto");
  });

  it("peça criada pela prefeitura exclui; padrão restaura", async () => {
    const { modelos, gravado } = montar();
    await modelos.criarPersonalizado("org-1", {
      escopo: "PROCESSO", nome: "Peça própria", titulo: "P",
      corpo: "<p>{{orgao.nome}}</p>", ativo: true,
    });

    await recusa(() => modelos.restaurarPadrao("org-1", "PECA_PROPRIA"), /não tem modelo padrão/);
    assert.equal(gravado.modelos.length, 1);

    await modelos.excluirPersonalizado("org-1", "PECA_PROPRIA");
    assert.equal(gravado.modelos.length, 0);
  });

  it("prefeitura não apaga o padrão do produto", async () => {
    const { modelos, gravado } = montar();
    await modelos.criarPersonalizado(null, {
      escopo: "PROCESSO", nome: "Despacho", titulo: "D", corpo: "<p>x</p>", ativo: true,
    });
    await recusa(
      () => modelos.excluirPersonalizado("org-1", "DESPACHO"),
      /Só documento criado por esta prefeitura/,
    );
    assert.equal(gravado.modelos.length, 1);
  });

  it("recusa nome repetido e nome sem letras", async () => {
    const { modelos } = montar();
    await modelos.criarPersonalizado("org-1", {
      escopo: "PROCESSO", nome: "Termo de posse", titulo: "T",
      corpo: "<p>{{orgao.nome}}</p>", ativo: true,
    });
    await recusa(
      () => modelos.criarPersonalizado("org-1", {
        escopo: "PROCESSO", nome: "termo de posse", titulo: "T",
        corpo: "<p>{{orgao.nome}}</p>", ativo: true,
      }),
      /Já existe um documento/,
    );
    await recusa(
      () => modelos.criarPersonalizado("org-1", {
        escopo: "PROCESSO", nome: "!!", titulo: "T", corpo: "<p>{{orgao.nome}}</p>", ativo: true,
      }),
      /três letras/,
    );
  });

  it("o módulo da peça nova sai do escopo", async () => {
    // O botão de emissão pede os modelos por módulo. Com um default fixo em
    // PROCESSOS, a peça de frotas nascia no módulo errado e nunca aparecia na
    // tela que deveria oferecê-la — criada, salva e invisível.
    const { modelos, gravado } = montar();

    for (const [escopo, esperado] of [
      ["VIAGEM", "FROTAS"],
      ["MANUTENCAO", "FROTAS"],
      ["TRANSFERENCIA_BEM", "PATRIMONIO"],
      ["INVENTARIO", "PATRIMONIO"],
      ["PROCESSO", "PROCESSOS"],
    ] as const) {
      await modelos.criarPersonalizado("org-1", {
        escopo, nome: `Peça de ${escopo}`, titulo: "T",
        corpo: "<p>{{orgao.nome}}</p>", ativo: true,
      });
    }

    assert.deepEqual(
      gravado.modelos.map((modelo) => modelo.modulo),
      ["FROTAS", "FROTAS", "PATRIMONIO", "PATRIMONIO", "PROCESSOS"],
    );
  });

  it("barra marcador fora do escopo já na hora de salvar", async () => {
    // O erro aparece para quem edita, não para quem tenta imprimir.
    const { modelos, gravado } = montar();
    await recusa(
      () => modelos.criarPersonalizado("org-1", {
        escopo: "PROCESSO", nome: "Peça errada", titulo: "X",
        corpo: "<p>{{contrato.numero}}</p>", ativo: true,
      }),
      /não existe neste documento/,
    );
    assert.equal(gravado.modelos.length, 0);
  });
});

describe("emissão", () => {
  it("busca os dados pelo escopo do modelo, não pelo tipo", async () => {
    // É o que permite peça nova sem código: o tipo virou só a identidade.
    const { modelos, emissao, gravado } = montar();
    await modelos.criarPersonalizado("org-1", {
      escopo: "SOLICITACAO", nome: "Recibo do pedido", titulo: "RECIBO",
      corpo: "<p>{{solicitacao.valorTotalPorExtenso}}</p><ul>{{#itens}}<li>{{produto}}</li>{{/itens}}</ul>",
      ativo: true,
    });
    await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "RECIBO_DO_PEDIDO", referenciaId: "sol-9",
    });

    assert.deepEqual(gravado.escoposPedidos, ["SOLICITACAO"]);
    assert.ok(String(gravado.emitidos[0]!.corpo).includes("<li>x</li>"));
  });

  it("recusa sem modelo, com modelo desativado e sem registro", async () => {
    const { modelos, emissao, gravado } = montar();
    await recusa(
      () => emissao.executar({
        orgaoId: "org-1", usuarioId: "u-1", tipo: "INEXISTENTE", referenciaId: "proc-1",
      }),
      /Não há modelo/,
    );

    await modelos.criarPersonalizado(null, {
      escopo: "PROCESSO", nome: "Despacho", titulo: "D", corpo: "<p>x</p>", ativo: false,
    });
    await recusa(
      () => emissao.executar({
        orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
      }),
      /desativou/,
    );

    assert.equal(gravado.emitidos.length, 0);
  });
});

/**
 * O cliente pediu para ajustar texto e datas antes de a peca sair. A edicao
 * fica ANTES da emissao: depois, o documento responde por um codigo publico em
 * /conferencia, e mudar o corpo faria a conferencia mentir sobre o papel que
 * ja circulou.
 */
describe("rascunho: revisar antes de emitir", () => {
  const comModelo = async () => {
    const ambiente = montar();
    await ambiente.modelos.criarPersonalizado(null, {
      escopo: "PROCESSO", nome: "Despacho", titulo: "DESPACHO",
      corpo: "<p>Prazo de 5 dias.</p>", ativo: true,
    });
    return ambiente;
  };

  it("nasce em rascunho, sem data de emissao", async () => {
    const { emissao, gravado, auditados } = await comModelo();
    await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });

    assert.equal(gravado.emitidos[0]!.situacao, "RASCUNHO");
    assert.equal(gravado.emitidos[0]!.data, null);
    assert.equal(auditados[0]!.tipoEvento, "DOCUMENTO_PREPARADO");
  });

  it("o texto revisado substitui o do modelo, e o original fica guardado", async () => {
    const { emissao, gravado } = await comModelo();
    const { id } = await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });

    await emissao.salvarCorpo({
      orgaoId: "org-1", usuarioId: "u-1", documentoId: id,
      corpo: "<p>Prazo de 10 dias.</p>",
    });

    assert.match(String(gravado.emitidos[0]!.corpo), /10 dias/);
    assert.match(String(gravado.emitidos[0]!.corpoOriginal), /5 dias/);
    assert.ok(gravado.emitidos[0]!.editadoEm, "a edicao nao registrou quando");
  });

  it("o texto colado passa pelo sanitizador", async () => {
    // Colar do Word traz <script>, <font> e style de mais. A pagina de
    // conferencia e publica: nada disso pode chegar la.
    const { emissao, gravado } = await comModelo();
    const { id } = await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });

    await emissao.salvarCorpo({
      orgaoId: "org-1", usuarioId: "u-1", documentoId: id,
      corpo: '<p onclick="roubar()">Texto</p><script>alert(1)</script><font>x</font>',
    });

    const corpo = String(gravado.emitidos[0]!.corpo);
    assert.ok(!corpo.includes("script"), "script sobreviveu ao sanitizador");
    assert.ok(!corpo.includes("onclick"), "handler inline sobreviveu");
    assert.match(corpo, /Texto/, "o texto legitimo se perdeu");
  });

  it("recusa corpo que ficaria vazio depois de limpo", async () => {
    const { emissao, gravado } = await comModelo();
    const { id } = await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });
    const antes = String(gravado.emitidos[0]!.corpo);

    await recusa(
      () => emissao.salvarCorpo({
        orgaoId: "org-1", usuarioId: "u-1", documentoId: id, corpo: "<script>só isso</script>",
      }),
      /vazio/,
    );
    assert.equal(gravado.emitidos[0]!.corpo, antes, "o corpo foi alterado apesar da recusa");
  });

  it("emitir carimba a data e o rascunho deixa de ser editavel", async () => {
    const { emissao, gravado, auditados } = await comModelo();
    const { id } = await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });

    await emissao.confirmar({ orgaoId: "org-1", usuarioId: "u-1", documentoId: id });

    assert.equal(gravado.emitidos[0]!.situacao, "EMITIDO");
    assert.ok(gravado.emitidos[0]!.data, "documento emitido sem data");
    assert.equal(auditados.at(-1)!.tipoEvento, "DOCUMENTO_EMITIDO");

    await recusa(
      () => emissao.salvarCorpo({
        orgaoId: "org-1", usuarioId: "u-1", documentoId: id, corpo: "<p>tarde demais</p>",
      }),
      /nao pode mais ser alterado|não pode mais ser alterado/,
    );
  });

  it("emitir duas vezes e recusado", async () => {
    const { emissao } = await comModelo();
    const { id } = await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });
    await emissao.confirmar({ orgaoId: "org-1", usuarioId: "u-1", documentoId: id });

    await recusa(
      () => emissao.confirmar({ orgaoId: "org-1", usuarioId: "u-1", documentoId: id }),
      /ja foi emitido|já foi emitido|nao pode mais|não pode mais/,
    );
  });

  it("o rascunho e de quem o preparou", async () => {
    // A peca leva o nome e o cargo do autor impressos: outro servidor
    // reescrever o texto poria a assinatura de um sobre as palavras de outro.
    const { emissao, gravado } = await comModelo();
    const { id } = await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });
    const antes = String(gravado.emitidos[0]!.corpo);

    await recusa(
      () => emissao.salvarCorpo({
        orgaoId: "org-1", usuarioId: "outro", documentoId: id, corpo: "<p>invadi</p>",
      }),
      /outro servidor/,
    );
    await recusa(
      () => emissao.confirmar({ orgaoId: "org-1", usuarioId: "outro", documentoId: id }),
      /outro servidor/,
    );
    assert.equal(gravado.emitidos[0]!.corpo, antes);
  });

  it("descartar apaga o rascunho", async () => {
    const { emissao, gravado, auditados } = await comModelo();
    const { id } = await emissao.executar({
      orgaoId: "org-1", usuarioId: "u-1", tipo: "DESPACHO", referenciaId: "proc-1",
    });

    await emissao.descartar({ orgaoId: "org-1", usuarioId: "u-1", documentoId: id });

    assert.equal(gravado.emitidos.length, 0);
    assert.equal(auditados.at(-1)!.tipoEvento, "DOCUMENTO_DESCARTADO");
  });
});
