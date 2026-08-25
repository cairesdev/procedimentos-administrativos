import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { somenteDigitos, documentoValido } from "../../domain/protocolo/Documento";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { FluxoRepository } from "../ports/UsuarioRepository";
import type { GeradorNumeroProcesso } from "../shared/GeradorNumeroProcesso";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type {
  ProtocoloRepository, TipoDeRequerente,
} from "../ports/ProtocoloRepository";

export type AberturaDeAtendimento = {
  orgaoId: string;
  assuntoId: string;
  descricaoPedido: string;
  origem: "BALCAO" | "PORTAL";
  requerente: {
    tipo: TipoDeRequerente;
    documento: string;
    nome: string;
    contatoEmail?: string;
    contatoTelefone?: string;
  };
  /** Servidor que atendeu; ausente quando o próprio cidadão abriu. */
  usuarioId?: string;
};

/**
 * Quantos pedidos o mesmo documento pode abrir pelo portal em 24 horas.
 *
 * O limite por IP sozinho não segura robô que troca de saída; o documento
 * segura, porque CPF válido não é infinito nem barato de girar. O número é
 * folgado de propósito: pessoa de verdade dificilmente abre mais que isto no
 * mesmo dia, e travar quem tem pressa é pior que aceitar um pedido a mais.
 */
const ABERTURAS_POR_DOCUMENTO_AO_DIA = 5;

/**
 * Abertura de atendimento externo — balcão e portal usam o mesmo caminho.
 *
 * O que muda entre os dois é só a origem registrada e quem está autenticado;
 * a regra de negócio é idêntica, e duplicá-la faria as duas portas divergirem
 * com o tempo.
 */
export class AtenderProtocolo {
  constructor(
    private readonly protocolo: ProtocoloRepository,
    private readonly fluxos: FluxoRepository,
    private readonly numeracao: GeradorNumeroProcesso,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  abrir = async (
    dados: AberturaDeAtendimento,
  ): Promise<{ id: string; protocolo: string; processoAdm: string }> => {
    const assunto = await this.protocolo.buscarAssunto(dados.orgaoId, dados.assuntoId);
    if (!assunto) throw new NaoEncontrado("Assunto não encontrado");
    if (!assunto.ativo) {
      throw new ErroDeNegocio("Esta prefeitura não está atendendo este assunto no momento");
    }

    const documento = somenteDigitos(dados.requerente.documento);
    if (!documentoValido(documento)) {
      throw new ErroDeNegocio("CPF ou CNPJ inválido");
    }
    if (dados.descricaoPedido.trim().length < 10) {
      throw new ErroDeNegocio("Descreva o pedido com pelo menos dez caracteres");
    }

    // Só o portal tem freio: no balcão há um servidor olhando quem está na
    // frente dele, e travar o atendimento presencial seria pior que o abuso.
    if (dados.origem === "PORTAL") {
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentes = await this.protocolo.contarAberturasRecentes(documento, ontem);
      if (recentes >= ABERTURAS_POR_DOCUMENTO_AO_DIA) {
        throw new ErroDeNegocio(
          "Este documento já abriu vários pedidos hoje. Aguarde 24 horas ou procure a prefeitura "
          + "presencialmente.",
          429,
        );
      }
    }

    // O setor do assunto manda; sem ele, cai na primeira etapa do fluxo de
    // atendimento externo. Sem nenhum dos dois, o processo nasce sem destino e
    // ficaria invisível em toda fila — melhor recusar e mandar configurar.
    const destino = assunto.setorId
      ? { setorId: assunto.setorId, departamentoId: null }
      : await this.fluxos.primeiraEtapa(dados.orgaoId, "ATENDIMENTO_EXTERNO");

    if (!destino) {
      throw new ErroDeNegocio(
        `O assunto "${assunto.nome}" não tem setor responsável e não há fluxo de atendimento `
        + "externo configurado. O processo ficaria sem fila; defina o setor no cadastro do assunto.",
      );
    }

    const resultado = await this.transacao(async (tx) => {
      // Requerente é reaproveitado pelo documento: o mesmo cidadão volta, e
      // dois cadastros dele partiriam o histórico em dois.
      const existente = await this.protocolo.buscarRequerentePorDocumento(
        dados.orgaoId, documento,
      );

      const requerenteId = existente
        ? existente.id
        : await this.protocolo.criarRequerente({
            orgaoId: dados.orgaoId,
            tipo: dados.requerente.tipo,
            documento,
            nome: dados.requerente.nome,
            contatoEmail: dados.requerente.contatoEmail,
            contatoTelefone: dados.requerente.contatoTelefone,
          }, tx);

      if (existente) {
        // Contato muda com o tempo; o cadastro acompanha o último atendimento.
        await this.protocolo.atualizarContato(existente.id, {
          nome: dados.requerente.nome,
          contatoEmail: dados.requerente.contatoEmail,
          contatoTelefone: dados.requerente.contatoTelefone,
        }, tx);
      }

      const numeros = await this.numeracao.gerarPar(dados.orgaoId, tx);
      const id = await this.protocolo.criarAtendimento({
        orgaoId: dados.orgaoId,
        requerenteId,
        assuntoId: assunto.id,
        descricaoPedido: dados.descricaoPedido.trim(),
        origem: dados.origem,
        numeroProtocolo: numeros.protocolo,
        numeroProcessoAdm: numeros.processoAdm,
        setorAtualId: destino.setorId,
        departamentoAtualId: destino.departamentoId ?? undefined,
      }, tx);

      return { id, ...numeros };
    });

    await this.auditoria.registrar({
      orgaoId: dados.orgaoId,
      // Sem usuário quando o cidadão abriu pelo portal: a coluna aceita nulo e
      // a origem no detalhe diz de onde veio.
      usuarioId: dados.usuarioId,
      tipoEvento: "ATENDIMENTO_ABERTO",
      referenciaId: resultado.id,
      detalhes: {
        protocolo: resultado.protocolo,
        assunto: assunto.nome,
        origem: dados.origem,
        requerente: dados.requerente.nome,
        documento,
      },
    });

    return resultado;
  };

  /** Consulta pública: normaliza o documento antes de casar com o cadastro. */
  acompanhar = async (numeroProtocolo: string, documento: string) =>
    this.protocolo.acompanhar(numeroProtocolo.trim(), somenteDigitos(documento));
}
