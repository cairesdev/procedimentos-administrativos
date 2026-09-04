import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import { BaixarOsAutos, TETO_DO_PACOTE } from "../../src/application/anexo/BaixarOsAutos";
import { recusa } from "../ajudantes/dobras";

const ORGAO = "11111111-1111-1111-1111-111111111111";
const PROCESSO = "99999999-0000-0000-0000-000000000001";

type AnexoFalso = { id: string; arquivo: string; tamanho: number };

/**
 * O palco cobre o caminho feliz com Postgres e MinIO de mentira; aqui ficam os
 * cenários que exigiriam gigabytes de verdade para reproduzir — o teto do
 * pacote e a ordem em que ele é conferido.
 */
const montar = (anexos: AnexoFalso[], pecas: unknown[] = []) => {
  const abertos: string[] = [];

  const caso = new BaixarOsAutos(
    { listarPorProcesso: async () => anexos } as never,
    { listarPorReferencia: async () => pecas } as never,
    {
      buscarProcesso: async () => ({ id: PROCESSO, numeroProcessoAdm: "2026/0001" }),
    } as never,
    {
      abrir: async (caminho: string) => {
        abertos.push(caminho);
        const anexo = anexos.find((a) => a.arquivo === caminho)!;
        return {
          // Nada de alocar o arquivo inteiro: o teste é sobre o tamanho
          // anunciado, e alocar 200 MB de verdade só tornaria o teste lento.
          fluxo: Readable.from([Buffer.alloc(Math.min(anexo.tamanho, 16))]),
          tamanho: anexo.tamanho,
          mimeType: "application/pdf",
        };
      },
    } as never,
  );

  return { caso, abertos };
};

const anexo = (nome: string, tamanho: number): AnexoFalso => ({
  id: nome,
  arquivo: `${ORGAO}/processos/${PROCESSO}/00000000-0000-0000-0000-000000000000-${nome}`,
  tamanho,
});

describe("o pacote dos autos", () => {
  it("recusa quando os arquivos somados passam do teto", async () => {
    /**
     * O pacote é montado inteiro na memória.
     *
     * Sem teto, um processo com dez anexos gordos derruba a API da prefeitura
     * — e o download que derruba o sistema é pior que o download negado. A
     * recusa diz o número em megabytes e aponta a saída que continua de pé:
     * baixar um por um.
     */
    const { caso } = montar([
      anexo("um.pdf", TETO_DO_PACOTE / 2),
      anexo("dois.pdf", TETO_DO_PACOTE / 2),
      anexo("tres.pdf", 1),
    ]);

    await recusa(
      () => caso.montar(ORGAO, PROCESSO, "https://exemplo.gov.br"),
      /200 MB somados.*limite do pacote/s,
      422,
    );
  });

  it("para de ler assim que estoura, em vez de carregar o resto", async () => {
    /**
     * A ordem importa.
     *
     * Somar tudo primeiro exigiria uma consulta de tamanho que o armazenamento
     * não dá de graça; ler tudo e conferir no fim traria para a memória
     * exatamente o que não cabe nela. Conferir a cada arquivo é o que faz a
     * defesa defender.
     */
    const { caso, abertos } = montar([
      anexo("um.pdf", TETO_DO_PACOTE + 1),
      anexo("dois.pdf", 10),
      anexo("tres.pdf", 10),
    ]);

    await recusa(
      () => caso.montar(ORGAO, PROCESSO, "https://exemplo.gov.br"),
      /limite do pacote/,
      422,
    );
    assert.equal(abertos.length, 1, "o segundo e o terceiro não deviam nem ser abertos");
  });

  it("um pacote no limite exato ainda desce", async () => {
    // O teto é "passa de", não "chega em": recusar o que cabe é recusar sem
    // motivo, e o usuário não tem como saber que faltou um byte.
    const { caso } = montar([anexo("no-limite.pdf", TETO_DO_PACOTE)]);
    const { nomeArquivo, conteudo } = await caso.montar(
      ORGAO, PROCESSO, "https://exemplo.gov.br");

    assert.equal(nomeArquivo, "processo-2026-0001.zip");
    assert.ok(conteudo.length > 22, "o pacote não pode sair vazio");
  });

  it("processo sem anexo e sem peça recusa em vez de entregar zip vazio", async () => {
    const { caso } = montar([]);
    await recusa(
      () => caso.montar(ORGAO, PROCESSO, "https://exemplo.gov.br"),
      /ainda não tem anexos nem peças emitidas/,
      422,
    );
  });

  it("a barra no número do processo não vira pasta no nome do arquivo", async () => {
    /**
     * `2026/0001` é como a prefeitura numera o processo, e uma barra no
     * `Content-Disposition` faria o navegador salvar com nome truncado — ou
     * criar pasta, dependendo de quem abre.
     */
    const { caso } = montar([anexo("unico.pdf", 10)]);
    const { nomeArquivo } = await caso.montar(ORGAO, PROCESSO, "https://exemplo.gov.br");
    assert.equal(nomeArquivo, "processo-2026-0001.zip");
    assert.doesNotMatch(nomeArquivo, /\//);
  });
});
