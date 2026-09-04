import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  crc32, montarZip, nomeDentroDoPacote, semRepetir,
} from "../../src/domain/shared/Zip";

describe("o pacote dos autos", () => {
  it("o CRC32 bate com o valor conhecido", () => {
    /**
     * "123456789" tem CRC32 `0xCBF43926` — é o vetor de teste que a própria
     * norma usa. Se esta linha passar, o resto do formato pode estar errado;
     * se falhar, nenhum descompactador aceita o pacote.
     */
    assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
    assert.equal(crc32(Buffer.alloc(0)), 0);
  });

  it("nome com barra não vira pasta nem sai dela", () => {
    // `../` no nome é como se escreve fora da pasta de destino na máquina de
    // quem abre o pacote. O ZIP não proíbe; nós proibimos.
    assert.equal(nomeDentroDoPacote("../../etc/passwd"), "etc-passwd");
    assert.equal(nomeDentroDoPacote("pasta\\arquivo.pdf"), "pasta-arquivo.pdf");
    assert.equal(nomeDentroDoPacote("...."), "arquivo");
    assert.equal(nomeDentroDoPacote(""), "arquivo");
  });

  it("nome repetido ganha número, em vez de sobrescrever", () => {
    // Dois anexos "nota fiscal.pdf" é o caso comum, e o descompactador
    // resolveria sobrescrevendo um com o outro em silêncio.
    assert.deepEqual(
      semRepetir(["nota.pdf", "nota.pdf", "nota.pdf", "outro.pdf"]),
      ["nota.pdf", "nota (2).pdf", "nota (3).pdf", "outro.pdf"],
    );
    assert.deepEqual(semRepetir(["sem-extensao", "sem-extensao"]),
      ["sem-extensao", "sem-extensao (2)"]);
  });

  it("o zip abre num descompactador de verdade", () => {
    /**
     * O teste que importa. Montar bytes que *parecem* um zip é fácil; o que
     * decide é o `unzip` do sistema abrir, listar e devolver o conteúdo
     * idêntico ao que entrou.
     */
    const pasta = mkdtempSync(path.join(tmpdir(), "zip-teste-"));
    try {
      const pacote = montarZip([
        { nome: "nota fiscal.pdf", conteudo: Buffer.from("%PDF-1.4 conteúdo") },
        { nome: "parecer.txt", conteudo: Buffer.from("Deferido, com acento: ção") },
        { nome: "vazio.txt", conteudo: Buffer.alloc(0) },
      ]);

      const arquivo = path.join(pasta, "autos.zip");
      writeFileSync(arquivo, pacote);

      const listagem = execFileSync("unzip", ["-l", arquivo], { encoding: "utf8" });
      assert.match(listagem, /nota fiscal\.pdf/);
      assert.match(listagem, /parecer\.txt/);

      // `-t` confere o CRC de cada entrada: é ele que prova que o cabeçalho
      // não mente sobre o conteúdo.
      const teste = execFileSync("unzip", ["-t", arquivo], { encoding: "utf8" });
      assert.match(teste, /No errors detected/);

      execFileSync("unzip", ["-o", "-q", arquivo, "-d", pasta]);
      assert.equal(
        readFileSync(path.join(pasta, "parecer.txt"), "utf8"),
        "Deferido, com acento: ção",
      );
      assert.equal(readFileSync(path.join(pasta, "vazio.txt")).length, 0);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it("a pasta do pacote sobrevive ao saneamento do nome", () => {
    /**
     * O bug que este teste tranca.
     *
     * A primeira versão saneava o caminho inteiro de uma vez, e a barra de
     * `anexos/nota.pdf` virava hífen junto com a barra de quem tenta fugir da
     * pasta: o zip saía plano, com `anexos-nota.pdf`, e ninguém percebia
     * olhando o código — só abrindo o arquivo. Pasta é decisão do código;
     * nome é dado de fora. As duas coisas não podem passar pela mesma peneira.
     */
    const pasta = mkdtempSync(path.join(tmpdir(), "zip-pasta-"));
    try {
      const pacote = montarZip([
        { pasta: "anexos", nome: "nota fiscal.pdf", conteudo: Buffer.from("juntado") },
        { pasta: "pecas", nome: "ABC-123 - Capa.html", conteudo: Buffer.from("emitido") },
        // Fuga tentada pelo nome: continua sem sair da pasta que o código deu.
        { pasta: "anexos", nome: "../../etc/passwd", conteudo: Buffer.from("x") },
      ]);

      const arquivo = path.join(pasta, "autos.zip");
      writeFileSync(arquivo, pacote);

      const listagem = execFileSync("unzip", ["-l", arquivo], { encoding: "utf8" });
      assert.match(listagem, /anexos\/nota fiscal\.pdf/);
      assert.match(listagem, /pecas\/ABC-123 - Capa\.html/);
      assert.match(listagem, /anexos\/etc-passwd/);
      assert.doesNotMatch(listagem, /\.\./, "nada pode subir de pasta");

      execFileSync("unzip", ["-o", "-q", arquivo, "-d", pasta]);
      assert.equal(
        readFileSync(path.join(pasta, "anexos", "nota fiscal.pdf"), "utf8"), "juntado");
      assert.equal(
        readFileSync(path.join(pasta, "pecas", "ABC-123 - Capa.html"), "utf8"), "emitido");
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it("pacote sem arquivo nenhum é um zip vazio, e não lixo", () => {
    /**
     * Processo sem anexo e sem peça emitida.
     *
     * O `unzip` sai com erro diante de um zip vazio — "zipfile is empty" —, e
     * isso é o comportamento **dele**, não defeito do pacote: 22 bytes com a
     * assinatura de fim de índice é exatamente o que a norma manda escrever.
     * Por isso o teste olha os bytes, e não o programa.
     *
     * Quem chama decide o que fazer com o vazio: a rota dos autos recusa antes,
     * porque baixar um pacote sem nada dentro é pior que ouvir que não há nada.
     */
    const vazio = montarZip([]);
    assert.equal(vazio.length, 22);
    assert.equal(vazio.readUInt32LE(0), 0x06054b50);
    assert.equal(vazio.readUInt16LE(8), 0, "não pode anunciar entrada que não existe");
  });
});
