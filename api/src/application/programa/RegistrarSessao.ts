import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { NovaSessao, ProgramaRepository } from "../ports/ProgramaRepository";
import { hoje } from "./GerenciarPrograma";

/**
 * A sessão: frequência, não evolução clínica.
 *
 * Data, terapia, profissional e se a pessoa compareceu. É o que responde
 * "periodicidade das terapias ofertadas" e "quem atendeu" sem o aparato de
 * assinatura e imutabilidade da ficha hospitalar — a evolução de cada
 * terapeuta vem noutra fatia, quando a assinatura passar a valer alguma coisa.
 *
 * **A falta é registrada, e não apagada.** Sessão marcada e não realizada
 * explica boa parte da diferença entre o que foi combinado e o que a família
 * recebeu. Apagá-la faria o município parecer melhor ou pior do que é,
 * dependendo do lado de quem apaga — e as duas coisas são mentira.
 */
export class RegistrarSessao {
  constructor(
    private readonly programas: ProgramaRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  registrar = async (
    orgaoId: string, usuarioId: string, dados: NovaSessao,
  ): Promise<{ id: string }> => {
    // A indicação alcança a prefeitura por dois joins — inscrição e programa.
    // Sem esta consulta, um id de outra prefeitura viraria sessão.
    const alcance = await this.programas.indicacaoAlcancavel(orgaoId, dados.indicacaoId);
    if (!alcance) throw new NaoEncontrado("Terapia indicada não encontrada");

    /**
     * Sessão antes de a terapia começar é o registro que apaga a fila.
     *
     * Se ela entrasse, a espera continuaria aberta no relatório enquanto a
     * pessoa já está sendo atendida — ou, pior, alguém "resolveria" a fila
     * lançando sessões sem nunca marcar o início. O caminho é iniciar a
     * terapia, que é o registro que fecha a espera.
     */
    if (!alcance.iniciadaEm) {
      throw new ErroDeNegocio(
        "Esta terapia ainda não foi iniciada. Registre o início antes da "
        + "primeira sessão — é ele que encerra a espera na fila.",
      );
    }
    if (dados.data < alcance.iniciadaEm) {
      throw new ErroDeNegocio(
        `A sessão é anterior ao início da terapia (${alcance.iniciadaEm}).`,
      );
    }
    if (dados.data > hoje()) {
      throw new ErroDeNegocio(
        "A sessão está no futuro — registre depois de atender, não antes.",
      );
    }

    /**
     * Dia repetido é digitação repetida, e não erro de banco.
     *
     * O `UNIQUE (indicacao_id, data)` chegava ao terapeuta como "Erro
     * interno". Duas sessões da mesma terapia no mesmo dia quase sempre são a
     * mesma sessão lançada duas vezes — e se de fato foram duas, a segunda
     * entra como observação da primeira, não como outro atendimento contado
     * na periodicidade.
     */
    const id = await this.programas.registrarSessao(dados);
    if (!id) {
      throw new ErroDeNegocio(
        `Já existe sessão desta terapia em ${dados.data}. Se houve mesmo dois `
        + "atendimentos no dia, registre o segundo na observação do primeiro.",
      );
    }
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "SESSAO_REGISTRADA",
      referenciaId: dados.indicacaoId,
      detalhes: { data: dados.data, compareceu: dados.compareceu },
    });
    return { id };
  };

  listar = (orgaoId: string, indicacaoId: string, limite = 60) =>
    this.programas.sessoesDaIndicacao(orgaoId, indicacaoId, limite);
}
