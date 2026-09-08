import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { conferirSinais } from "../../domain/saude/SinaisVitais";
import type { LeituraDeSinais } from "../../domain/saude/SinaisVitais";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type {
  AtendimentoNaLista, AtendimentoSaudeRepository, Ficha, FiltroDeAtendimentos,
} from "../ports/AtendimentoSaudeRepository";
import type { Pagina } from "../shared/Paginacao";
import type { GuardaDaFicha } from "./GuardaDaFicha";

export type TriagemInformada = LeituraDeSinais & {
  queixa?: string | null;
  conduta?: string | null;
  prioridade?: boolean;
};

/**
 * A esteira da ficha: cada bloco, com a mão que o assina.
 *
 * Todo método aqui segue a mesma forma — autorizar, conferir o que é próprio
 * daquele bloco, gravar. A repetição é o ponto: é ela que garante que nenhum
 * bloco escapa do guarda, e um método que não comece por `autorizar` salta aos
 * olhos na revisão.
 */
export class FichaDeAtendimento {
  constructor(
    private readonly atendimentos: AtendimentoSaudeRepository,
    private readonly guarda: GuardaDaFicha,
    private readonly auditoria: AuditoriaRepository,
    private readonly emTransacao: ExecutorDeTransacao,
  ) {}

  listar = (
    orgaoId: string, filtros: FiltroDeAtendimentos,
  ): Promise<Pagina<AtendimentoNaLista>> => this.atendimentos.listar(orgaoId, filtros);

  ver = async (orgaoId: string, atendimentoId: string): Promise<Ficha> => {
    const ficha = await this.atendimentos.ficha(orgaoId, atendimentoId);
    if (!ficha) throw new NaoEncontrado("Atendimento não encontrado");
    return ficha;
  };

  /**
   * O histórico de visitas anteriores — e a única leitura auditada do sistema.
   *
   * O levantamento abriu o histórico a todo profissional clínico, porque
   * continuidade do cuidado depende de ver a visita passada. A contrapartida
   * é esta linha: quem abriu, de quem, e quando. Trilha de leitura é o que
   * inibe a curiosidade sobre a ficha do vizinho, e é o que a controladoria
   * vai pedir para ver.
   */
  historico = async (
    orgaoId: string, pacienteId: string, usuarioId: string, incluirAntigos: boolean,
  ): Promise<AtendimentoNaLista[]> => {
    const visitas = await this.atendimentos.historicoDoPaciente(
      orgaoId, pacienteId, incluirAntigos,
    );

    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "PRONTUARIO_LIDO",
      referenciaId: pacienteId,
      detalhes: { visitas: visitas.length, incluiuAntigos: incluirAntigos },
    });

    return visitas;
  };

  triar = async (
    orgaoId: string, atendimentoId: string, usuarioId: string, dados: TriagemInformada,
  ): Promise<{ avisos: string[] }> => {
    await this.guarda.autorizar(orgaoId, atendimentoId, usuarioId, "TRIAR");

    const { erros, avisos } = conferirSinais(dados);
    if (erros.length > 0) throw new ErroDeNegocio(erros.join(" "));

    await this.atendimentos.salvarTriagem(atendimentoId, {
      glicemia: dados.glicemia ?? null,
      paSistolica: dados.paSistolica ?? null,
      paDiastolica: dados.paDiastolica ?? null,
      pulso: dados.pulso ?? null,
      saturacao: dados.saturacao ?? null,
      temperatura: dados.temperatura ?? null,
      queixa: dados.queixa?.trim() || null,
      conduta: dados.conduta ?? null,
      prioridade: dados.prioridade ?? false,
    }, usuarioId);

    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "TRIAGEM_REGISTRADA", referenciaId: atendimentoId,
      detalhes: { prioridade: dados.prioridade ?? false, conduta: dados.conduta ?? null },
    });

    /**
     * Os avisos voltam para a tela e **não impedem nada**.
     *
     * Saturação 71% e temperatura 41 °C existem, são graves, e são exatamente
     * o paciente que o pronto atendimento precisa registrar depressa. Um
     * formulário que recusasse esses números obrigaria o enfermeiro a escrever
     * um valor falso para conseguir salvar.
     */
    return { avisos };
  };

  avaliar = async (
    orgaoId: string, atendimentoId: string, usuarioId: string, queixaClinica: string,
  ): Promise<void> => {
    await this.guarda.autorizar(orgaoId, atendimentoId, usuarioId, "AVALIAR");
    if (!queixaClinica.trim()) throw new ErroDeNegocio("Escreva a avaliação clínica");

    await this.atendimentos.salvarAvaliacao(atendimentoId, queixaClinica.trim(), usuarioId);
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "AVALIACAO_MEDICA_REGISTRADA",
      referenciaId: atendimentoId,
    });
  };

  evoluir = async (
    orgaoId: string, atendimentoId: string, usuarioId: string,
    tipo: "ENFERMAGEM" | "MEDICA", texto: string,
  ): Promise<{ id: string }> => {
    const ato = tipo === "ENFERMAGEM" ? "EVOLUIR_ENFERMAGEM" : "EVOLUIR_MEDICO";
    await this.guarda.autorizar(orgaoId, atendimentoId, usuarioId, ato);
    if (!texto.trim()) throw new ErroDeNegocio("Escreva a evolução");

    const id = await this.atendimentos.registrarEvolucao(
      atendimentoId, tipo, texto.trim(), usuarioId,
    );
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "EVOLUCAO_REGISTRADA",
      referenciaId: atendimentoId, detalhes: { tipo },
    });
    return { id };
  };

  registrarProcedimento = async (
    orgaoId: string, atendimentoId: string, usuarioId: string,
    tipo: string, descricao: string | null,
  ): Promise<{ id: string }> => {
    await this.guarda.autorizar(orgaoId, atendimentoId, usuarioId, "PROCEDIMENTO");
    if (tipo === "OUTRO" && !descricao?.trim()) {
      throw new ErroDeNegocio(
        "Diga qual foi o procedimento — \"outros\" sem a descrição registra que "
        + "algo foi feito sem dizer o quê.",
      );
    }

    const id = await this.atendimentos.registrarProcedimento(
      atendimentoId, tipo, descricao?.trim() || null, usuarioId,
    );
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "PROCEDIMENTO_REGISTRADO",
      referenciaId: atendimentoId, detalhes: { tipo },
    });
    return { id };
  };

  /**
   * A saída do paciente. Único, terminal, e assinado pelo enfermeiro.
   *
   * O horário é informado, e não `now()`, pelo mesmo motivo da administração
   * de medicamento: quem assina registra depois. Forçar o relógio do servidor
   * transformaria "alta às 22h" em "alta às 23h40".
   */
  darSaida = async (
    orgaoId: string, atendimentoId: string, usuarioId: string,
    dados: { tipo: string; destino?: string | null; horario: Date },
  ): Promise<void> => {
    const { atendimento } = await this.guarda.autorizar(
      orgaoId, atendimentoId, usuarioId, "DESFECHO",
    );

    if (!atendimento.pacienteId) {
      throw new ErroDeNegocio(
        "Este atendimento ainda está sem paciente identificado. Complete a "
        + "identificação antes de dar a saída — ficha sem paciente é ficha que "
        + "ninguém consegue achar depois.",
      );
    }
    if (dados.tipo === "ENCAMINHAMENTO" && !dados.destino?.trim()) {
      throw new ErroDeNegocio("Informe para onde o paciente foi encaminhado");
    }
    /**
     * A comparação é por **minuto**, e não por milissegundo.
     *
     * A abertura vem do banco com precisão de milissegundo; a saída vem do
     * formulário, que oferece hora e minuto. Comparar as duas cruas recusa a
     * ficha aberta às 18:07:44,753 e encerrada "às 18:07" — que é o caso real
     * de quem chega, é triado e é dispensado no mesmo minuto, e foi o que o
     * palco pegou. Precisões diferentes comparadas de frente sempre erram para
     * o mesmo lado: contra quem registrou certo.
     */
    if (dados.horario < inicioDoMinuto(new Date(atendimento.abertoEm))) {
      throw new ErroDeNegocio("A saída não pode ser anterior à abertura do atendimento");
    }

    await this.emTransacao((tx) => this.atendimentos.registrarDesfecho(
      atendimentoId,
      { tipo: dados.tipo, destino: dados.destino?.trim() || null, horario: dados.horario },
      usuarioId,
      tx,
    ));

    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "ATENDIMENTO_ENCERRADO",
      referenciaId: atendimentoId,
      detalhes: { tipo: dados.tipo, destino: dados.destino ?? null },
    });
  };

  /**
   * A rasura datada e rubricada.
   *
   * Corrigir prontuário existe e é bem-vindo; apagar, não. O registro original
   * permanece, a correção entra ao lado com autor e hora próprios, e a ficha
   * impressa mostra as duas. Vale depois da alta, porque é quando o erro
   * costuma ser notado.
   */
  retificar = async (
    orgaoId: string, atendimentoId: string, usuarioId: string,
    dados: { tabelaOrigem: string; registroId: string; texto: string },
  ): Promise<{ id: string }> => {
    await this.guarda.autorizar(orgaoId, atendimentoId, usuarioId, "RETIFICAR");
    if (!dados.texto.trim()) throw new ErroDeNegocio("Escreva a correção");

    const id = await this.atendimentos.registrarRetificacao(
      atendimentoId, { ...dados, texto: dados.texto.trim() }, usuarioId,
    );
    await this.auditoria.registrar({
      orgaoId, usuarioId, tipoEvento: "REGISTRO_CLINICO_RETIFICADO",
      referenciaId: atendimentoId,
      detalhes: { tabela: dados.tabelaOrigem, registro: dados.registroId },
    });
    return { id };
  };
}

/** O instante, truncado ao começo do seu minuto. */
const inicioDoMinuto = (momento: Date): Date =>
  new Date(Math.floor(momento.getTime() / 60_000) * 60_000);
