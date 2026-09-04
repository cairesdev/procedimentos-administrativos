import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { somenteDigitos } from "../../domain/protocolo/Documento";
import type { AnexoRepository, ArmazenamentoArquivos } from "../ports/ArmazenamentoArquivos";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import { sanitizarNomeDeArquivo } from "../shared/NomeDeArquivo";
import { randomUUID } from "node:crypto";
import type { Exigencia, ProtocoloRepository } from "../ports/ProtocoloRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import { exigenciaAoRequerente } from "../../domain/email/Mensagens";
import type { EnfileirarEmail, ResultadoDoEnfileiramento } from "../email/EnfileirarEmail";

/** O que o requerente pode juntar. Nada executável, nada de arquivo enorme. */
const TIPOS_ACEITOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export type NovaExigenciaEntrada = {
  orgaoId: string;
  processoId: string;
  usuarioId: string;
  texto: string;
  prazoDias?: number;
  /** Nome da prefeitura, para o remetente e o corpo do e-mail. */
  orgaoNome?: string;
};

export type RespostaDoRequerente = {
  numeroProtocolo: string;
  documento: string;
  texto: string;
};

export type AnexoDoRequerente = {
  numeroProtocolo: string;
  documento: string;
  nomeOriginal: string;
  conteudo: Buffer;
  mimeType: string;
  /** Exigência que este documento responde; ausente = envio por iniciativa própria. */
  exigenciaId?: string;
};

/**
 * Ciclo de exigência: o setor pergunta, o requerente responde.
 *
 * O canal do requerente não tem sessão. A credencial é o par protocolo +
 * documento, conferido a cada chamada — o mesmo par que abre o acompanhamento.
 * Guardar um token de sessão para o cidadão traria recuperação de acesso,
 * expiração e suporte, tudo por causa de duas ou três interações.
 */
export class ExigirDoRequerente {
  constructor(
    private readonly protocolo: ProtocoloRepository,
    private readonly anexos: AnexoRepository,
    private readonly armazenamento: ArmazenamentoArquivos,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
    private readonly emails: EnfileirarEmail,
    /** Endereço público do sistema, para o link de acompanhamento. */
    private readonly appUrl: string,
  ) {}

  // ---- Lado da prefeitura ---------------------------------------------------

  exigir = async (
    entrada: NovaExigenciaEntrada,
  ): Promise<{ id: string; email: ResultadoDoEnfileiramento }> => {
    if (entrada.texto.trim().length < 10) {
      throw new ErroDeNegocio("Descreva a exigência com pelo menos dez caracteres");
    }

    const abertas = await this.protocolo.listarExigencias(entrada.orgaoId, entrada.processoId);
    if (abertas.some((exigencia) => exigencia.status === "PENDENTE")) {
      throw new ErroDeNegocio(
        "Já existe uma exigência aguardando resposta neste processo. Cancele-a antes de abrir "
        + "outra — duas perguntas em aberto deixam o requerente sem saber a qual responder.",
      );
    }

    // O prazo é congelado na criação: mudar o padrão do assunto depois não pode
    // encurtar retroativamente o prazo de quem já foi notificado.
    const prazoLimite = entrada.prazoDias
      ? new Date(Date.now() + entrada.prazoDias * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      : null;

    /**
     * O aviso ao requerente é o ponto da exigência.
     *
     * Sem ele, o cidadão só descobre que o processo dele parou se voltar ao
     * portal por conta própria — e o prazo corre enquanto isso. É a mensagem
     * que mais justifica esta fatia inteira.
     *
     * O atendimento é buscado **antes** da transação: é leitura, e prendê-la
     * junto só alongaria o tempo em que a linha fica travada.
     */
    const atendimento = await this.protocolo.buscarAtendimento(
      entrada.orgaoId, entrada.processoId,
    );

    const { id, email } = await this.transacao(async (tx) => {
      const criada = await this.protocolo.criarExigencia({
        orgaoId: entrada.orgaoId,
        processoId: entrada.processoId,
        texto: entrada.texto.trim(),
        prazoDias: entrada.prazoDias,
        criadaPorUsuarioId: entrada.usuarioId,
      }, prazoLimite, tx);

      const enviado = await this.emails.executar(tx, {
        orgaoId: entrada.orgaoId,
        tipo: "EXIGENCIA_AO_REQUERENTE",
        destinatario: atendimento?.requerenteEmail,
        referenciaId: entrada.processoId,
        chave: `EXIGENCIA:${criada}`,
        mensagem: exigenciaAoRequerente({
          orgao: entrada.orgaoNome ?? "Prefeitura",
          requerente: atendimento?.requerenteNome ?? "Prezado(a)",
          numeroProtocolo: atendimento?.numeroProtocolo ?? "",
          descricao: entrada.texto.trim(),
          link: `${this.appUrl}/acompanhar`,
          prazoEm: prazoLimite,
        }),
      });

      return { id: criada, email: enviado };
    });

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "EXIGENCIA_REGISTRADA",
      referenciaId: entrada.processoId,
      detalhes: { exigenciaId: id, prazoDias: entrada.prazoDias ?? null, email },
    });

    return { id, email };
  };

  cancelarExigencia = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    exigenciaId: string;
    motivo: string;
  }): Promise<void> => {
    const exigencia = await this.protocolo.buscarExigencia(entrada.exigenciaId);
    if (!exigencia) throw new NaoEncontrado("Exigência não encontrada");
    if (exigencia.status !== "PENDENTE") {
      throw new ErroDeNegocio("Só exigência pendente pode ser cancelada");
    }

    await this.protocolo.cancelarExigencia(entrada.orgaoId, entrada.exigenciaId, entrada.motivo);
    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "EXIGENCIA_CANCELADA",
      referenciaId: exigencia.processoId,
      detalhes: { exigenciaId: exigencia.id, motivo: entrada.motivo },
    });
  };

  listar = (orgaoId: string, processoId: string) =>
    this.protocolo.listarExigencias(orgaoId, processoId);

  // ---- Lado do requerente, sem sessão ---------------------------------------

  /** Exigências que o requerente vê ao acompanhar, já autorizado pelo par. */
  exigenciasDoRequerente = async (
    numeroProtocolo: string,
    documento: string,
  ): Promise<Exigencia[]> => {
    const processo = await this.autorizar(numeroProtocolo, documento);
    return this.protocolo.exigenciasDoRequerente(processo.processoId);
  };

  responder = async (entrada: RespostaDoRequerente): Promise<void> => {
    const processo = await this.autorizar(entrada.numeroProtocolo, entrada.documento);
    if (entrada.texto.trim().length < 5) {
      throw new ErroDeNegocio("Escreva sua resposta");
    }

    const exigencias = await this.protocolo.exigenciasDoRequerente(processo.processoId);
    const pendente = exigencias.find((exigencia) => exigencia.status === "PENDENTE");
    if (!pendente) {
      throw new ErroDeNegocio("Não há exigência aguardando resposta neste protocolo");
    }

    await this.protocolo.responderExigencia(pendente.id, entrada.texto.trim());
    await this.auditoria.registrar({
      orgaoId: processo.orgaoId,
      // Sem usuário: quem respondeu foi o requerente, não um servidor.
      tipoEvento: "EXIGENCIA_RESPONDIDA",
      referenciaId: processo.processoId,
      detalhes: { exigenciaId: pendente.id, protocolo: entrada.numeroProtocolo },
    });
  };

  anexar = async (entrada: AnexoDoRequerente): Promise<{ id: string }> => {
    const processo = await this.autorizar(entrada.numeroProtocolo, entrada.documento);

    if (!TIPOS_ACEITOS.includes(entrada.mimeType)) {
      throw new ErroDeNegocio("Envie o documento em PDF, PNG, JPEG ou WEBP");
    }
    if (entrada.conteudo.length > TAMANHO_MAXIMO) {
      throw new ErroDeNegocio("Arquivo acima de 10 MB");
    }

    const caminho = `${processo.orgaoId}/processos/${processo.processoId}`
      + `/${randomUUID()}-${sanitizarNomeDeArquivo(entrada.nomeOriginal)}`;

    // Grava o arquivo antes do registro e desfaz se o insert falhar — mesma
    // compensação do anexo de servidor.
    await this.armazenamento.salvar(caminho, entrada.conteudo, entrada.mimeType);
    try {
      const id = await this.anexos.criar({
        processoId: processo.processoId,
        tipoDocumento: "REQUERENTE",
        arquivo: caminho,
        enviadoPorRequerenteId: processo.requerenteId,
        exigenciaId: entrada.exigenciaId,
      });

      await this.auditoria.registrar({
        orgaoId: processo.orgaoId,
        tipoEvento: "ANEXO_ADICIONADO",
        referenciaId: processo.processoId,
        detalhes: {
          anexoId: id,
          origem: "REQUERENTE",
          nomeOriginal: entrada.nomeOriginal,
          tamanhoBytes: entrada.conteudo.length,
        },
      });
      return { id };
    } catch (erro) {
      await this.armazenamento.remover(caminho);
      throw erro;
    }
  };

  /**
   * Porta única do canal público. Protocolo encerrado ou cancelado não recebe
   * mais nada: o cidadão que mandar documento ali acharia que foi juntado aos
   * autos, e ninguém leria.
   */
  private autorizar = async (numeroProtocolo: string, documento: string) => {
    const processo = await this.protocolo.processoDoRequerente(
      numeroProtocolo.trim(),
      somenteDigitos(documento),
    );
    // Mesma resposta para par que não casa e protocolo inexistente: distinguir
    // os dois diria a quem varre qual protocolo existe.
    if (!processo) {
      throw new NaoEncontrado(
        "Não encontramos protocolo com esse número para o documento informado",
      );
    }
    if (processo.status === "ENCERRADO" || processo.status === "CANCELADO") {
      throw new ErroDeNegocio(
        "Este protocolo já foi concluído e não recebe mais documentos. Abra um novo pedido ou "
        + "procure a prefeitura.",
      );
    }
    return processo;
  };
}
