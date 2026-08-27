import { NaoEncontrado, ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import { gerarCodigoVerificador } from "../../domain/documento/CodigoVerificador";
import { limparCorpo } from "../../domain/documento/CorpoSeguro";
import { renderizar, type ContextoDeDocumento } from "../../domain/documento/Marcadores";
import { dataPorExtenso } from "../../domain/documento/PorExtenso";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { DocumentoRepository } from "../ports/DocumentoRepository";
import type { UsuarioRepository } from "../ports/UsuarioRepository";

/**
 * Monta o contexto do documento a partir da entidade referenciada. Fica em
 * porta separada porque cada tipo puxa de uma tabela diferente — e o caso de
 * uso não precisa saber de nenhuma delas.
 */
export interface FonteDeContexto {
  /** `escopo` diz o que buscar; `referenciaId` é a entidade daquele escopo. */
  montar(
    orgaoId: string,
    escopo: string,
    referenciaId: string,
  ): Promise<ContextoDeDocumento | null>;
}

export type EmissaoEntrada = {
  orgaoId: string;
  usuarioId: string;
  tipo: string;
  referenciaId: string;
  /** Lotação ativa, para o cargo impresso no rodapé. */
  lotacaoId?: string;
};

/** Quantas vezes tentar de novo se o código sorteado colidir. */
const TENTATIVAS_DE_CODIGO = 5;

export class EmitirDocumento {
  constructor(
    private readonly documentos: DocumentoRepository,
    private readonly contexto: FonteDeContexto,
    private readonly usuarios: UsuarioRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  /**
   * Monta a peça e a guarda em **rascunho**, com o código já sorteado.
   *
   * O código precisa existir aqui porque o próprio corpo o imprime — e porque
   * o QR da conferência sai impresso na folha. Renderizar depois obrigaria a
   * remendar o texto que o usuário acabou de revisar.
   *
   * Enquanto rascunho, a peça não é conferível nem aparece nas listagens do
   * registro: existe só para quem a está escrevendo.
   */
  executar = async (entrada: EmissaoEntrada): Promise<{ id: string; codigo: string }> => {
    const modelo = await this.documentos.resolverModelo(entrada.orgaoId, entrada.tipo);
    if (!modelo) {
      throw new NaoEncontrado(
        `Não há modelo de documento cadastrado para ${entrada.tipo}`,
      );
    }
    if (!modelo.ativo) {
      throw new ErroDeNegocio("Esta prefeitura desativou este tipo de documento");
    }

    const perfil = await this.usuarios.buscarPerfil(entrada.usuarioId);
    if (!perfil) throw new NaoEncontrado("Usuário não encontrado");

    const dados = await this.contexto.montar(entrada.orgaoId, modelo.escopo, entrada.referenciaId);
    if (!dados) throw new NaoEncontrado("Registro não encontrado para emitir o documento");

    const agora = new Date();
    const cargo = cargoDe(perfil, entrada.lotacaoId);
    const dataDoDocumento = {
      porExtenso: dataPorExtenso(agora),
      curta: formatarData(agora),
      hora: formatarHora(agora),
    };

    // O código entra no corpo (o modelo pode imprimi-lo), então colisão obriga
    // a refazer a renderização inteira — não a remendar o texto já pronto.
    let id = "";
    let codigo = "";
    for (let tentativa = 1; tentativa <= TENTATIVAS_DE_CODIGO; tentativa += 1) {
      codigo = gerarCodigoVerificador();

      const contextoCompleto: ContextoDeDocumento = {
        ...dados,
        data: dataDoDocumento,
        autor: { nome: perfil.nome, cargo },
        documento: { codigo, titulo: modelo.titulo },
      };

      // Marcador desconhecido estoura aqui, com 422 e a lista do que corrigir.
      const corpo = limparCorpo(renderizar(modelo.corpo, contextoCompleto));

      try {
        id = await this.documentos.rascunhar({
          orgaoId: entrada.orgaoId,
          modulo: modelo.modulo,
          tipo: modelo.tipo,
          codigo,
          titulo: modelo.titulo,
          // Guarda o retrato: o corpo já interpolado e os dados que o geraram.
          // Editar o modelo depois não reescreve o que já foi emitido.
          corpo,
          dados: contextoCompleto as Record<string, unknown>,
          referenciaId: entrada.referenciaId,
          modeloId: modelo.id,
          emitidoPorUsuarioId: entrada.usuarioId,
          emitidoPorNome: perfil.nome,
          emitidoPorCargo: cargo,
        });
        break;
      } catch (erro) {
        if (!ehCodigoDuplicado(erro)) throw erro;
        if (tentativa === TENTATIVAS_DE_CODIGO) {
          throw new ErroDeNegocio("Não foi possível gerar um código verificador único");
        }
      }
    }

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "DOCUMENTO_PREPARADO",
      referenciaId: entrada.referenciaId,
      detalhes: { documentoId: id, tipo: modelo.tipo, titulo: modelo.titulo, origem: modelo.origem },
    });

    return { id, codigo };
  };

  /**
   * Grava o texto revisado. Só vale em rascunho: depois de emitida, a peça
   * responde por um código público e mudar o corpo faria a conferência mentir.
   *
   * O corpo passa pelo mesmo sanitizador do modelo. O editor é `contenteditable`
   * e a colagem de um documento do Word traz `<font>`, `<o:p>` e style de mais
   * — nada disso pode chegar à página pública.
   */
  salvarCorpo = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    documentoId: string;
    corpo: string;
  }): Promise<void> => {
    const documento = await this.exigirRascunhoDoAutor(
      entrada.orgaoId, entrada.documentoId, entrada.usuarioId,
    );

    const corpo = limparCorpo(entrada.corpo);
    if (!corpo.trim()) {
      throw new ErroDeNegocio("O documento ficaria vazio — nada foi salvo");
    }

    await this.documentos.salvarCorpo(
      entrada.orgaoId, entrada.documentoId, corpo, entrada.usuarioId,
    );
    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "DOCUMENTO_EDITADO",
      referenciaId: documento.referenciaId,
      detalhes: { documentoId: documento.id, codigo: documento.codigo },
    });
  };

  /** Rascunho vira documento: ganha data e passa a valer na conferência. */
  confirmar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    documentoId: string;
  }): Promise<void> => {
    const documento = await this.exigirRascunhoDoAutor(
      entrada.orgaoId, entrada.documentoId, entrada.usuarioId,
    );

    // A troca de situação é condicional no UPDATE: dois cliques no botão não
    // emitem duas vezes, e o segundo descobre isso pelo banco, não por leitura
    // anterior que já estaria velha.
    const emitiu = await this.documentos.confirmarEmissao(entrada.orgaoId, entrada.documentoId);
    if (!emitiu) throw new ErroDeNegocio("Este documento já foi emitido");

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "DOCUMENTO_EMITIDO",
      referenciaId: documento.referenciaId,
      detalhes: {
        documentoId: documento.id,
        codigo: documento.codigo,
        tipo: documento.tipo,
        titulo: documento.titulo,
        editado: documento.editadoEm !== null,
      },
    });
  };

  /** Rascunho se descarta; o que já circulou se cancela. */
  descartar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    documentoId: string;
  }): Promise<void> => {
    const documento = await this.exigirRascunhoDoAutor(
      entrada.orgaoId, entrada.documentoId, entrada.usuarioId,
    );

    await this.documentos.descartarRascunho(entrada.orgaoId, entrada.documentoId);
    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "DOCUMENTO_DESCARTADO",
      referenciaId: documento.referenciaId,
      detalhes: { documentoId: documento.id, codigo: documento.codigo },
    });
  };

  /**
   * Quem preparou é quem revisa. A peça leva o nome e o cargo do autor
   * impressos: deixar outro servidor reescrever o texto poria a assinatura de
   * um sobre as palavras de outro.
   */
  private exigirRascunhoDoAutor = async (
    orgaoId: string,
    documentoId: string,
    usuarioId: string,
  ) => {
    const documento = await this.documentos.buscarEmitido(orgaoId, documentoId);
    if (!documento) throw new NaoEncontrado("Documento não encontrado");
    if (documento.situacao !== "RASCUNHO") {
      throw new ErroDeNegocio("Documento já emitido não pode mais ser alterado");
    }
    if (documento.emitidoPorUsuarioId !== usuarioId) {
      throw new ErroDeNegocio("Este rascunho é de outro servidor", 403);
    }
    return documento;
  };

  cancelar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    documentoId: string;
    motivo: string;
  }): Promise<void> => {
    const documento = await this.documentos.buscarEmitido(entrada.orgaoId, entrada.documentoId);
    if (!documento) throw new NaoEncontrado("Documento não encontrado");
    if (documento.canceladoEm) throw new ErroDeNegocio("Documento já está cancelado");

    // Cancelar não apaga: a peça continua conferível, marcada como sem efeito.
    // Documento que some deixaria o papel em circulação sem contraparte.
    await this.documentos.cancelar(entrada.orgaoId, entrada.documentoId, entrada.motivo);
    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "DOCUMENTO_CANCELADO",
      referenciaId: documento.referenciaId,
      detalhes: { documentoId: documento.id, codigo: documento.codigo, motivo: entrada.motivo },
    });
  };

}

const ehCodigoDuplicado = (erro: unknown): boolean =>
  typeof erro === "object"
  && erro !== null
  && (erro as { code?: string }).code === "23505"
  && String((erro as { constraint?: string }).constraint ?? "").includes("codigo");

/**
 * Cargo impresso no rodapé. O cadastro não tem cargo nem matrícula, então o
 * que existe de mais próximo é o papel somado ao destino da lotação ativa.
 */
const cargoDe = (
  perfil: { papelBase: string; lotacoes: { id: string; destino: string }[] },
  lotacaoId?: string,
): string => {
  const lotacao = perfil.lotacoes.find((item) => item.id === lotacaoId) ?? perfil.lotacoes[0];
  const papel = perfil.papelBase.charAt(0) + perfil.papelBase.slice(1).toLowerCase();
  return lotacao ? `${papel} — ${lotacao.destino}` : papel;
};

const emSaoPaulo = (momento: Date, opcoes: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opcoes }).format(momento);

const formatarData = (momento: Date) =>
  emSaoPaulo(momento, { day: "2-digit", month: "2-digit", year: "numeric" });

const formatarHora = (momento: Date) =>
  emSaoPaulo(momento, { hour: "2-digit", minute: "2-digit" });
