import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { MODALIDADES, IDS_DE_MODALIDADE } from "../../src/domain/licitacao/Modalidades";

/**
 * As modalidades vivem em três lugares, e os três precisam concordar.
 *
 * O catálogo do domínio é a fonte; o CHECK do banco é quem recusa de verdade; e
 * o web tem a própria cópia, porque não alcança o código da API. Espelho sem
 * teste dura até a primeira pressa: alguém acrescenta uma modalidade na tela,
 * ela passa no typecheck, e o `INSERT` falha em produção com "violates check
 * constraint" — mensagem que não diz a ninguém o que fazer.
 */

const raiz = path.join(__dirname, "..", "..");
const migrations = path.join(raiz, "db", "migrations");

const sqlDasModalidades = () => {
  const arquivo = readdirSync(migrations).find((nome) => nome.includes("modalidades"));
  assert.ok(arquivo, "a migration das modalidades sumiu");
  return readFileSync(path.join(migrations, arquivo!), "utf8");
};

/** O CHECK que vale é o da **última** migration que o define. */
const modalidadesDoCheck = () => {
  const arquivos = readdirSync(migrations).sort().reverse();
  for (const nome of arquivos) {
    const sql = readFileSync(path.join(migrations, nome), "utf8");
    const bloco = sql.match(/CHECK \(modalidade IN \(([\s\S]*?)\)\)/);
    if (bloco) return [...bloco[1]!.matchAll(/'([A-Z_0-9]+)'/g)].map((achado) => achado[1]!);
  }
  assert.fail("nenhuma migration define o CHECK de modalidade");
};

const modalidadesDoWeb = () => {
  const arquivo = readFileSync(
    path.join(raiz, "..", "web", "src", "features", "bids", "types.ts"), "utf8",
  );
  const bloco = arquivo.match(/export const BID_MODALITIES = \[([\s\S]*?)\n\] as const;/);
  assert.ok(bloco, "não achei BID_MODALITIES no web");
  return [...bloco![1]!.matchAll(/\{ id: "([A-Z_0-9]+)", sigla: (?:"(\w{2})"|null)/g)]
    .map((achado) => ({ id: achado[1]!, sigla: achado[2] ?? null }));
};

describe("as modalidades de contratação", () => {
  it("o CHECK do banco aceita exatamente o que o catálogo tem", () => {
    assert.deepEqual(modalidadesDoCheck().sort(), [...IDS_DE_MODALIDADE].sort());
  });

  it("o web espelha o catálogo, id por id e sigla por sigla", () => {
    assert.deepEqual(
      modalidadesDoWeb(),
      MODALIDADES.map((modalidade) => ({ id: modalidade.id, sigla: modalidade.sigla })),
    );
  });

  it("as oito modalidades antigas sobrevivem com o mesmo identificador", () => {
    // Há licitação gravada com cada uma delas. Renomear seria reescrever
    // histórico — o registro passaria a apontar para um valor que não existe.
    for (const antiga of [
      "PREGAO_ELETRONICO", "PREGAO_PRESENCIAL", "CONCORRENCIA", "DISPENSA",
      "INEXIGIBILIDADE", "CHAMADA_PUBLICA", "LEILAO", "DIALOGO_COMPETITIVO",
    ]) {
      assert.ok(
        (IDS_DE_MODALIDADE as readonly string[]).includes(antiga),
        `a modalidade ${antiga} sumiu do catálogo`,
      );
    }
  });

  it("nenhuma sigla se repete", () => {
    // A sigla é o que identifica a modalidade na exportação para o Tribunal;
    // duas iguais tornariam a ida ambígua.
    const siglas = MODALIDADES.map((m) => m.sigla).filter((sigla) => sigla !== null);
    assert.equal(new Set(siglas).size, siglas.length, "há sigla repetida");
  });

  it("as dezoito do layout do Tribunal estão todas lá", () => {
    const siglas = MODALIDADES.map((m) => m.sigla).filter(Boolean);
    assert.deepEqual(siglas.sort(), [
      "AA", "CC", "CO", "CP", "CR", "DC", "DE", "DP", "IN",
      "LI", "LL", "OT", "PE", "PL", "PP", "RE", "RP", "TP",
    ]);
  });

  it("a migration explica cada sigla ao lado do valor", () => {
    // O CHECK é lido por quem debuga um erro de constraint, e "PL" não diz nada
    // sem o comentário.
    const sql = sqlDasModalidades();
    for (const modalidade of MODALIDADES) {
      if (!modalidade.sigla) continue;
      assert.match(
        sql,
        new RegExp(`'${modalidade.id}',?\\s*--\\s*${modalidade.sigla}`),
        `falta o comentário da sigla de ${modalidade.id}`,
      );
    }
  });
});
