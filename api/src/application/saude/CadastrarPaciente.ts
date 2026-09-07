import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { conferirDocumentos } from "../../domain/saude/DocumentosDoPaciente";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type {
  DadosDoPaciente, PacienteCompleto, PacienteNaLista, PacienteRepository,
} from "../ports/PacienteRepository";
import type { Pagina, Paginacao } from "../shared/Paginacao";

/**
 * O cadastro do paciente, e o prontuário que ele carrega para sempre.
 *
 * Duas coisas moldam este caso de uso, e as duas vêm do balcão e não do
 * modelo:
 *
 * **Ninguém é obrigado a ter documento.** Cinco campos, todos opcionais, e o
 * atendimento abre sem nenhum deles. Exigir CNS antes de atender não produz
 * dado limpo — produz número inventado, digitado pela atendente para conseguir
 * salvar a tela com o paciente esperando em pé.
 *
 * **O segundo cadastro da mesma pessoa é o defeito clássico.** Por isso a
 * busca por documento vem antes da criação: quem já esteve aqui reaproveita o
 * prontuário. Sem ela o índice único devolveria erro de banco no meio do
 * atendimento, e a atendente concluiria que o sistema quebrou.
 */
export class CadastrarPaciente {
  constructor(
    private readonly pacientes: PacienteRepository,
    private readonly emTransacao: ExecutorDeTransacao,
  ) {}

  cadastrar = async (
    orgaoId: string, dados: DadosDoPaciente, autorId: string,
  ): Promise<{ id: string; prontuario: number; reaproveitado: boolean }> => {
    if (!dados.nome?.trim()) throw new ErroDeNegocio("Informe o nome do paciente");

    const { limpos, problemas } = conferirDocumentos(dados);
    if (problemas.length > 0) throw new ErroDeNegocio(problemas.join(" "));

    const jaExiste = await this.pacientes.porDocumento(orgaoId, limpos);
    if (jaExiste) {
      /**
       * Conflito, e não erro: **este é o caminho feliz do balcão**.
       *
       * A tela usa a resposta para abrir o cadastro que já existe, em vez de
       * mandar a atendente procurar de novo. O contexto leva o prontuário
       * porque é o número que ela vai falar em voz alta para conferir com o
       * paciente.
       */
      throw new Conflito(
        `${jaExiste.nome} já tem cadastro nesta prefeitura, com o prontuário `
        + `${jaExiste.prontuario}. Abra o cadastro existente em vez de criar outro.`,
        { pacienteId: jaExiste.id, prontuario: jaExiste.prontuario, nome: jaExiste.nome },
      );
    }

    return this.emTransacao(async (tx) => {
      const prontuario = await this.pacientes.proximoProntuario(orgaoId, tx);
      const id = await this.pacientes.criar(
        orgaoId, prontuario, { ...dados, ...limpos }, autorId, tx,
      );
      return { id, prontuario, reaproveitado: false };
    });
  };

  atualizar = async (
    orgaoId: string, id: string, dados: DadosDoPaciente,
  ): Promise<void> => {
    const { limpos, problemas } = conferirDocumentos(dados);
    if (problemas.length > 0) throw new ErroDeNegocio(problemas.join(" "));

    /**
     * A conferência de duplicidade também vale na edição.
     *
     * É aqui que o CPF de um paciente vai parar no cadastro de outro: a
     * atendente abre a ficha errada e digita o documento certo. O índice único
     * pegaria, mas com uma mensagem de banco.
     */
    const conflitante = await this.pacientes.porDocumento(orgaoId, limpos);
    if (conflitante && conflitante.id !== id) {
      throw new Conflito(
        `Um destes documentos já pertence a ${conflitante.nome} `
        + `(prontuário ${conflitante.prontuario}).`,
        { pacienteId: conflitante.id },
      );
    }

    const mudou = await this.pacientes.atualizar(orgaoId, id, { ...dados, ...limpos });
    if (!mudou) throw new NaoEncontrado("Paciente não encontrado");
  };

  ver = async (orgaoId: string, id: string): Promise<PacienteCompleto> => {
    const paciente = await this.pacientes.porId(orgaoId, id);
    if (!paciente) throw new NaoEncontrado("Paciente não encontrado");
    return paciente;
  };

  buscar = (
    orgaoId: string, termo: string, paginacao: Paginacao,
  ): Promise<Pagina<PacienteNaLista>> => this.pacientes.buscar(orgaoId, termo, paginacao);

  /**
   * Alergia e crônicas: do paciente, não da visita.
   *
   * No papel, "Portador: HAS / DM / Alergia / Outros" é reescrito a cada
   * atendimento e some quando alguém esquece. Aqui persiste, e é o que permite
   * avisar antes da prescrição.
   */
  registrarCondicao = async (
    orgaoId: string, pacienteId: string,
    condicao: { tipo: string; descricao?: string | null },
    autorId: string,
  ): Promise<{ id: string }> => {
    if (condicao.tipo === "ALERGIA" && !condicao.descricao?.trim()) {
      throw new ErroDeNegocio(
        "Diga a que o paciente é alérgico — alergia sem o agente não ajuda "
        + "ninguém na hora de prescrever.",
      );
    }
    const id = await this.pacientes.registrarCondicao(orgaoId, pacienteId, condicao, autorId);
    if (!id) throw new NaoEncontrado("Paciente não encontrado");
    return { id };
  };

  removerCondicao = async (
    orgaoId: string, pacienteId: string, condicaoId: string,
  ): Promise<void> => {
    const removeu = await this.pacientes.removerCondicao(orgaoId, pacienteId, condicaoId);
    if (!removeu) throw new NaoEncontrado("Registro não encontrado");
  };
}
