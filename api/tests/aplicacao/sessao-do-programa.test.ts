import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RegistrarSessao } from "../../src/application/programa/RegistrarSessao";
import type { NovaSessao, ProgramaRepository } from "../../src/application/ports/ProgramaRepository";
import type { AuditoriaRepository } from "../../src/application/ports/AuditoriaRepository";

/**
 * O que a sessão recusa antes de virar número no ofício.
 *
 * A periodicidade que o Ministério Público pediu é contada a partir destas
 * linhas. Cada regra aqui existe porque a alternativa produz um número que
 * parece bom e é falso: sessão antes do início apagaria a fila; sessão no
 * futuro contaria atendimento que não houve; e o mesmo dia lançado duas vezes
 * dobraria a frequência de quem foi atendido uma só.
 */

const HOJE = new Date().toISOString().slice(0, 10);

const ONTEM = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const AMANHA = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

type Ajustes = {
  alcance?: { inscricaoId: string; iniciadaEm: string | null } | null;
  /** `null` é o dia repetido: o banco recusou pelo `UNIQUE (indicacao, data)`. */
  idCriado?: string | null;
};

const repositorioFalso = (ajustes: Ajustes = {}) => {
  const registradas: NovaSessao[] = [];
  const repositorio = {
    indicacaoAlcancavel: async () => (
      ajustes.alcance === undefined
        ? { inscricaoId: "i1", iniciadaEm: "2026-01-10" }
        : ajustes.alcance
    ),
    registrarSessao: async (dados: NovaSessao) => {
      registradas.push(dados);
      return ajustes.idCriado === undefined ? "s1" : ajustes.idCriado;
    },
  } as unknown as ProgramaRepository;

  return { repositorio, registradas };
};

const auditoriaFalsa = () => {
  const eventos: string[] = [];
  const auditoria = {
    registrar: async (evento: { tipoEvento: string }) => {
      eventos.push(evento.tipoEvento);
    },
  } as unknown as AuditoriaRepository;
  return { auditoria, eventos };
};

const sessao = (dados: Partial<NovaSessao> = {}): NovaSessao => ({
  indicacaoId: "d1",
  data: ONTEM,
  profissionalId: "u1",
  compareceu: true,
  ...dados,
});

describe("a sessão da terapia", () => {
  it("entra e vai para a auditoria", async () => {
    const { repositorio, registradas } = repositorioFalso();
    const { auditoria, eventos } = auditoriaFalsa();

    const criada = await new RegistrarSessao(repositorio, auditoria)
      .registrar("o1", "u1", sessao());

    assert.equal(criada.id, "s1");
    assert.equal(registradas.length, 1);
    assert.deepEqual(eventos, ["SESSAO_REGISTRADA"]);
  });

  it("a falta também entra — ela explica a diferença entre o combinado e o recebido", async () => {
    const { repositorio, registradas } = repositorioFalso();
    const { auditoria } = auditoriaFalsa();

    await new RegistrarSessao(repositorio, auditoria)
      .registrar("o1", "u1", sessao({ compareceu: false }));

    assert.equal(registradas[0]!.compareceu, false);
  });

  it("indicação de outra prefeitura não vira sessão", async () => {
    const { repositorio } = repositorioFalso({ alcance: null });
    const { auditoria } = auditoriaFalsa();

    await assert.rejects(
      () => new RegistrarSessao(repositorio, auditoria).registrar("o1", "u1", sessao()),
      /não encontrada/i,
    );
  });

  it("sessão antes do início é recusada — ela apagaria a fila", async () => {
    const { repositorio } = repositorioFalso({
      alcance: { inscricaoId: "i1", iniciadaEm: null },
    });
    const { auditoria } = auditoriaFalsa();

    await assert.rejects(
      () => new RegistrarSessao(repositorio, auditoria).registrar("o1", "u1", sessao()),
      /ainda não foi iniciada/i,
    );
  });

  it("sessão no futuro é recusada", async () => {
    const { repositorio } = repositorioFalso();
    const { auditoria } = auditoriaFalsa();

    await assert.rejects(
      () => new RegistrarSessao(repositorio, auditoria)
        .registrar("o1", "u1", sessao({ data: AMANHA })),
      /futuro/i,
    );
  });

  /**
   * O dia repetido chegava ao terapeuta como "Erro interno".
   *
   * Era o `UNIQUE (indicacao_id, data)` vazando pela rota como 500 — o palco
   * do programa pegou. Duas sessões da mesma terapia no mesmo dia quase sempre
   * são a mesma sessão lançada duas vezes, e contá-las dobraria a
   * periodicidade apurada de quem foi atendido uma vez só.
   */
  it("o mesmo dia lançado duas vezes vira frase, e não erro interno", async () => {
    const { repositorio } = repositorioFalso({ idCriado: null });
    const { auditoria, eventos } = auditoriaFalsa();

    await assert.rejects(
      () => new RegistrarSessao(repositorio, auditoria)
        .registrar("o1", "u1", sessao({ data: HOJE })),
      /Já existe sessão desta terapia/i,
    );
    assert.deepEqual(eventos, [], "sessão recusada não entra na auditoria");
  });
});
