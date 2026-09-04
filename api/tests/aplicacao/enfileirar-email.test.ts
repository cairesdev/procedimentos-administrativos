import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EnfileirarEmail } from "../../src/application/email/EnfileirarEmail";
import { protocoloAberto } from "../../src/domain/email/Mensagens";

const mensagem = protocoloAberto({
  orgao: "Prefeitura de Monção",
  requerente: "José",
  numeroProtocolo: "PROT-1",
  assuntoDoPedido: "Poda de árvore",
  link: "https://x.gov.br/acompanhar",
});

const montar = (jaExistia = false) => {
  const fila: unknown[] = [];
  const caso = new EnfileirarEmail({
    enfileirar: async (_tx: unknown, dados: unknown) => {
      fila.push(dados);
      return !jaExistia;
    },
  } as never);
  return { caso, fila };
};

const pedido = (destinatario: string | null | undefined) => ({
  orgaoId: "org-1",
  tipo: "PROTOCOLO_ABERTO" as const,
  destinatario,
  mensagem,
  chave: "PROTOCOLO_ABERTO:p-1",
});

describe("enfileirar o e-mail", () => {
  it("o caminho feliz põe na fila", async () => {
    const { caso, fila } = montar();
    assert.equal(await caso.executar({} as never, pedido("jose@exemplo.com")), "enfileirado");
    assert.equal(fila.length, 1);
  });

  it("sem endereço, não é erro — é convite sem e-mail", async () => {
    /**
     * O caso comum, e não uma exceção.
     *
     * Convite de checklist para um engenheiro cujo e-mail ninguém cadastrou;
     * cidadão que abriu protocolo no balcão sem deixar contato. O ato
     * continua, o link fica na tela, e alguém manda à mão.
     */
    for (const vazio of [null, undefined, "", "   "]) {
      const { caso, fila } = montar();
      assert.equal(await caso.executar({} as never, pedido(vazio)), "sem-endereco");
      assert.equal(fila.length, 0, "nada entra na fila sem para quem mandar");
    }
  });

  it("endereço inválido é barrado na entrada, não na quinta tentativa", async () => {
    /**
     * O guarda que importa.
     *
     * Um nome digitado no campo de e-mail nunca vira entrega: ficaria cinco
     * rodadas ocupando o worker para terminar em FALHOU com uma mensagem do
     * servidor SMTP que não diz "alguém digitou errado". Barrar aqui é o que
     * transforma isso num aviso corrigível — e é a única chance de corrigir,
     * porque quem gerou o convite ainda está na tela.
     */
    for (const ruim of ["Engenheiro da obra", "sem-arroba.com", "a@b", "dois@@x.com"]) {
      const { caso, fila } = montar();
      assert.equal(
        await caso.executar({} as never, pedido(ruim)),
        "endereco-invalido",
        `"${ruim}" deveria ser barrado`,
      );
      assert.equal(fila.length, 0, `"${ruim}" não pode chegar à fila`);
    }
  });

  it("a mesma chave duas vezes é um clique a mais, não um erro", async () => {
    // O `ON CONFLICT DO NOTHING` do repositório devolve `false`; aqui isso
    // vira "repetido", que o chamador não trata como falha.
    const { caso } = montar(true);
    assert.equal(await caso.executar({} as never, pedido("jose@exemplo.com")), "repetido");
  });

  it("o endereço vai para a fila sem espaço em volta", async () => {
    const { caso, fila } = montar();
    await caso.executar({} as never, pedido("  jose@exemplo.com  "));
    assert.equal((fila[0] as { destinatario: string }).destinatario, "jose@exemplo.com");
  });

  it("leva assunto e corpo da mensagem, e a chave de idempotência", async () => {
    const { caso, fila } = montar();
    await caso.executar({} as never, pedido("jose@exemplo.com"));

    const gravado = fila[0] as Record<string, string>;
    assert.match(gravado.assunto ?? "", /PROT-1/);
    assert.match(gravado.corpo ?? "", /Poda de árvore/);
    assert.equal(gravado.chaveIdempotencia, "PROTOCOLO_ABERTO:p-1");
  });
});
