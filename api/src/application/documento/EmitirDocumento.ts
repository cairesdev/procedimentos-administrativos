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
  montar(
    orgaoId: string,
    tipo: string,
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

    const dados = await this.contexto.montar(entrada.orgaoId, entrada.tipo, entrada.referenciaId);
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
        id = await this.documentos.emitir({
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
      tipoEvento: "DOCUMENTO_EMITIDO",
      referenciaId: entrada.referenciaId,
      detalhes: { documentoId: id, tipo: modelo.tipo, titulo: modelo.titulo, origem: modelo.origem },
    });

    return { id, codigo };
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
