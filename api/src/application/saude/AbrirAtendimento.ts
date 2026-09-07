import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { AtendimentoSaudeRepository } from "../ports/AtendimentoSaudeRepository";
import type { PacienteRepository } from "../ports/PacienteRepository";
import type { UnidadeSaudeRepository } from "../ports/UnidadeSaudeRepository";

/**
 * A porta de entrada: a recepção abre a ficha.
 *
 * **O paciente pode ser nulo, e é a decisão mais importante deste arquivo.**
 * Inconsciente, sem acompanhante e sem documento: registra-se a hora e o
 * socorro começa. A ficha nasce marcada como incompleta, a lista mostra isso,
 * e o desfecho não fecha sem identificação — mas ninguém espera um cadastro
 * para ser atendido.
 */
export class AbrirAtendimento {
  constructor(
    private readonly atendimentos: AtendimentoSaudeRepository,
    private readonly pacientes: PacienteRepository,
    private readonly unidades: UnidadeSaudeRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly emTransacao: ExecutorDeTransacao,
  ) {}

  abrir = async (
    orgaoId: string, usuarioId: string,
    dados: { unidadeSaudeId: string; pacienteId?: string | null },
  ): Promise<{ id: string; numero: string; identificacaoPendente: boolean }> => {
    const unidade = await this.unidades.porId(orgaoId, dados.unidadeSaudeId);
    if (!unidade) throw new NaoEncontrado("Unidade de saúde não encontrada");
    if (!unidade.ativo) {
      throw new ErroDeNegocio(
        `${unidade.nome} está inativa e não recebe atendimento novo.`,
      );
    }

    if (dados.pacienteId) {
      const paciente = await this.pacientes.porId(orgaoId, dados.pacienteId);
      if (!paciente) throw new NaoEncontrado("Paciente não encontrado");
    }

    const ano = new Date().getFullYear();
    const { id, numero } = await this.emTransacao(async (tx) => {
      const sequencial = await this.atendimentos.proximoNumero(orgaoId, ano, tx);
      const numeroFormatado = `${String(sequencial).padStart(6, "0")}/${ano}`;
      const novoId = await this.atendimentos.abrir({
        orgaoId,
        unidadeSaudeId: dados.unidadeSaudeId,
        numero: numeroFormatado,
        pacienteId: dados.pacienteId ?? null,
        abertoPor: usuarioId,
      }, tx);
      return { id: novoId, numero: numeroFormatado };
    });

    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "FICHA_ABERTA",
      referenciaId: id,
      detalhes: { numero, identificado: Boolean(dados.pacienteId) },
    });

    return { id, numero, identificacaoPendente: !dados.pacienteId };
  };

  /**
   * Amarrar o paciente a uma ficha que abriu sem identificação.
   *
   * É o segundo tempo do atendimento sem documento: o acompanhante chega, o
   * paciente acorda, alguém reconhece. Só preenche o vazio — trocar o paciente
   * de uma ficha já identificada seria mover registro clínico de uma pessoa
   * para outra, e nenhuma tela deste sistema vai fazer isso.
   */
  identificar = async (
    orgaoId: string, atendimentoId: string, usuarioId: string, pacienteId: string,
  ): Promise<void> => {
    const atendimento = await this.atendimentos.resumo(orgaoId, atendimentoId);
    if (!atendimento) throw new NaoEncontrado("Atendimento não encontrado");
    if (atendimento.pacienteId) {
      throw new ErroDeNegocio(
        "Este atendimento já está identificado. Se o paciente estiver errado, "
        + "registre uma retificação — trocar o paciente moveria o registro "
        + "clínico de uma pessoa para outra.",
      );
    }

    const paciente = await this.pacientes.porId(orgaoId, pacienteId);
    if (!paciente) throw new NaoEncontrado("Paciente não encontrado");

    await this.atendimentos.identificar(orgaoId, atendimentoId, pacienteId);
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "FICHA_IDENTIFICADA",
      referenciaId: atendimentoId, detalhes: { pacienteId, prontuario: paciente.prontuario },
    });
  };
}
