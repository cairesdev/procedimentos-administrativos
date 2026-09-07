import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GuardaDaFicha, carimboDe } from "../../src/application/saude/GuardaDaFicha";
import { FichaDeAtendimento } from "../../src/application/saude/FichaDeAtendimento";
import type {
  AtendimentoResumido, AtendimentoSaudeRepository, CredencialDoProfissional,
} from "../../src/application/ports/AtendimentoSaudeRepository";
import type { AuditoriaRepository } from "../../src/application/ports/AuditoriaRepository";

/**
 * As quatro perguntas que toda escrita no prontuário responde antes de existir.
 *
 * Uma delas esquecida num único caso de uso já é o defeito: prontuário que
 * aceita escrita de outra prefeitura, ou assinatura sem conselho, ou alteração
 * do que já estava assinado. São erros que ninguém percebe até alguém pedir a
 * ficha num processo.
 */

const CREDENCIAL: CredencialDoProfissional = {
  nome: "Ana Souza", conselhoTipo: "COREN", conselhoNumero: "12345", conselhoUf: "MA",
};

const SEM_CONSELHO: CredencialDoProfissional = {
  nome: "Carlos Recepção", conselhoTipo: null, conselhoNumero: null, conselhoUf: null,
};

const ABERTO: AtendimentoResumido = {
  id: "a1", numero: "000001/2026", status: "EM_ANDAMENTO",
  pacienteId: "p1", abertoEm: new Date("2026-09-01T08:00:00Z").toISOString(),
};

type Ajustes = {
  atendimento?: AtendimentoResumido | null;
  credencial?: CredencialDoProfissional | null;
  blocoFechado?: boolean;
};

const repositorioFalso = (ajustes: Ajustes = {}) => {
  const chamadas: string[] = [];
  const repositorio = {
    resumo: async () => (
      ajustes.atendimento === undefined ? ABERTO : ajustes.atendimento
    ),
    credencialDoProfissional: async () => (
      ajustes.credencial === undefined ? CREDENCIAL : ajustes.credencial
    ),
    blocoFechado: async () => ajustes.blocoFechado ?? false,
    salvarTriagem: async () => { chamadas.push("salvarTriagem"); },
    registrarRetificacao: async () => { chamadas.push("retificar"); return "r1"; },
    registrarDesfecho: async () => { chamadas.push("desfecho"); },
    historicoDoPaciente: async () => [],
  } as unknown as AtendimentoSaudeRepository;

  return { repositorio, chamadas };
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

const semTransacao = async <T>(fn: (tx: never) => Promise<T>): Promise<T> =>
  fn(undefined as never);

const montar = (ajustes: Ajustes = {}) => {
  const { repositorio, chamadas } = repositorioFalso(ajustes);
  const { auditoria, eventos } = auditoriaFalsa();
  const guarda = new GuardaDaFicha(repositorio);
  const ficha = new FichaDeAtendimento(repositorio, guarda, auditoria, semTransacao);
  return { ficha, guarda, chamadas, eventos };
};

describe("a trava do órgão", () => {
  it("atendimento de outra prefeitura não existe", async () => {
    // O `resumo` filtra por `orgao_id` no SQL: um id de outra prefeitura não é
    // "sem permissão", é inexistente — e é assim que deve parecer.
    const { ficha } = montar({ atendimento: null });
    await assert.rejects(
      () => ficha.triar("orgao-b", "a1", "u1", { temperatura: 37 }),
      /não encontrado/i,
    );
  });
});

describe("o que já foi encerrado", () => {
  const encerrado: AtendimentoResumido = { ...ABERTO, status: "ENCERRADO" };

  it("não recebe triagem", async () => {
    const { ficha } = montar({ atendimento: encerrado });
    await assert.rejects(
      () => ficha.triar("o1", "a1", "u1", { temperatura: 37 }),
      /já foi encerrado/i,
    );
  });

  it("recebe retificação, que é justamente quando o erro é notado", async () => {
    const { ficha, chamadas } = montar({ atendimento: encerrado });
    await ficha.retificar("o1", "a1", "u1", {
      tabelaOrigem: "evolucao", registroId: "e1", texto: "Leia-se sonolento.",
    });
    assert.ok(chamadas.includes("retificar"));
  });
});

describe("o bloco assinado não se assina duas vezes", () => {
  it("segunda triagem é conflito, e a mensagem manda retificar", async () => {
    const { ficha } = montar({ blocoFechado: true });
    await assert.rejects(
      () => ficha.triar("o1", "a1", "u1", { temperatura: 37 }),
      /retificação/i,
    );
  });
});

describe("o conselho é o carimbo", () => {
  it("sem CRM ou COREN, o bloco não fecha", async () => {
    const { ficha } = montar({ credencial: SEM_CONSELHO });
    await assert.rejects(
      () => ficha.triar("o1", "a1", "u1", { temperatura: 37 }),
      /conselho profissional/i,
    );
  });

  it("a mensagem diz quem resolve, porque quem esbarra está no plantão", async () => {
    const { ficha } = montar({ credencial: SEM_CONSELHO });
    await assert.rejects(
      () => ficha.triar("o1", "a1", "u1", {}),
      /administrador/i,
    );
  });

  it("monta o carimbo como vai impresso na ficha", () => {
    assert.equal(carimboDe(CREDENCIAL), "Ana Souza — COREN 12345/MA");
    assert.equal(carimboDe(SEM_CONSELHO), "Carlos Recepção");
  });
});

describe("os sinais vitais graves passam", () => {
  it("saturação 71% entra e volta como aviso", async () => {
    const { ficha, chamadas } = montar();
    const { avisos } = await ficha.triar("o1", "a1", "u1", { saturacao: 71 });
    assert.ok(chamadas.includes("salvarTriagem"), "a triagem precisava ter sido salva");
    assert.equal(avisos.length, 1);
  });

  it("temperatura de 368 graus não entra", async () => {
    const { ficha, chamadas } = montar();
    await assert.rejects(
      () => ficha.triar("o1", "a1", "u1", { temperatura: 368 }),
      /fora do que é possível/,
    );
    assert.deepEqual(chamadas, []);
  });
});

describe("a saída do paciente", () => {
  it("não fecha ficha sem paciente identificado", async () => {
    /**
     * Ficha sem paciente é ficha que ninguém acha depois. O atendimento abre
     * sem documento — é o inconsciente sem acompanhante —, mas a saída exige
     * que alguém tenha completado a identificação.
     */
    const { ficha } = montar({ atendimento: { ...ABERTO, pacienteId: null } });
    await assert.rejects(
      () => ficha.darSaida("o1", "a1", "u1", { tipo: "ALTA", horario: new Date() }),
      /sem paciente identificado/i,
    );
  });

  it("encaminhamento sem destino não encaminha ninguém", async () => {
    const { ficha } = montar();
    await assert.rejects(
      () => ficha.darSaida("o1", "a1", "u1", {
        tipo: "ENCAMINHAMENTO", horario: new Date(),
      }),
      /para onde/i,
    );
  });

  it("saída anterior à abertura é digitação errada", async () => {
    const { ficha } = montar();
    await assert.rejects(
      () => ficha.darSaida("o1", "a1", "u1", {
        tipo: "ALTA", horario: new Date("2026-08-01T08:00:00Z"),
      }),
      /anterior à abertura/i,
    );
  });
});

describe("a leitura do prontuário entra na auditoria", () => {
  it("abrir o histórico deixa rastro", async () => {
    /**
     * É a única leitura registrada no sistema, e é a contrapartida de deixar o
     * histórico aberto a todo profissional clínico. Sem ela, a decisão 17 do
     * levantamento vira acesso livre sem prestação de contas.
     */
    const { ficha, eventos } = montar();
    await ficha.historico("o1", "p1", "u1", false);
    assert.deepEqual(eventos, ["PRONTUARIO_LIDO"]);
  });
});
