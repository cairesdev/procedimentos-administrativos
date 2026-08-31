import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type {
  QualidadeRepository, RegistroDeQualidade,
} from "../ports/QualidadeRepository";

/**
 * Tipos de acompanhamento, e o que cada um quer dizer.
 *
 * Vocabulário curto de propósito: lista longa vira campo que ninguém preenche
 * direito, e o texto livre ao lado é quem conta a história de verdade.
 */
export const TIPOS_DE_QUALIDADE = [
  "DANO",
  "VALIDADE",
  "ARMAZENAMENTO",
  "CONFORMIDADE",
  "OUTRO",
] as const;

export type TipoDeQualidade = (typeof TIPOS_DE_QUALIDADE)[number];

export type NovoRegistro = {
  orgaoId: string;
  usuarioId: string;
  loteId?: string;
  estoqueLocalId?: string;
  tipo: TipoDeQualidade;
  observacao: string;
  quantidade?: number;
};

/**
 * Registro de qualidade do material armazenado.
 *
 * Opcional em toda parte: a caixa amassada, o lote que vence semana que vem, a
 * câmara fria que oscilou. Ninguém é obrigado a preencher, e é isso que faz o
 * dado ser confiável quando aparece.
 *
 * **Não altera saldo.** Quem tira material do estoque é o ajuste, que já existe
 * e exige motivo. Misturar as duas coisas faria um relato de avaria sumir com o
 * material sem ninguém pedir — e, pior, faria quem só quis anotar hesitar em
 * anotar.
 */
export class RegistrarQualidade {
  constructor(
    private readonly qualidade: QualidadeRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  registrar = async (dados: NovoRegistro): Promise<{ id: string }> => {
    const alvos = [dados.loteId, dados.estoqueLocalId].filter(Boolean);
    if (alvos.length !== 1) {
      throw new ErroDeNegocio(
        "Informe o lote do almoxarifado OU o lote da unidade — nunca os dois",
      );
    }

    if (dados.observacao.trim().length < 3) {
      throw new ErroDeNegocio("Descreva o que foi observado");
    }
    if (dados.quantidade !== undefined && dados.quantidade <= 0) {
      throw new ErroDeNegocio("A quantidade afetada precisa ser maior que zero");
    }

    // A trava do órgão fica aqui: o lote é alcançado por join até o
    // almoxarifado, e um id de outra prefeitura não pode virar registro.
    const alcanca = await this.qualidade.loteDoOrgao(
      dados.orgaoId, dados.loteId, dados.estoqueLocalId,
    );
    if (!alcanca) throw new NaoEncontrado("Lote não encontrado neste órgão");

    const id = await this.qualidade.registrar(dados);

    await this.auditoria.registrar({
      orgaoId: dados.orgaoId,
      usuarioId: dados.usuarioId,
      tipoEvento: "QUALIDADE_REGISTRADA",
      referenciaId: dados.loteId ?? dados.estoqueLocalId,
      detalhes: { tipo: dados.tipo, quantidade: dados.quantidade ?? null },
    });

    return { id };
  };

  listar = (
    orgaoId: string,
    filtros: { lote?: string; estoqueLocal?: string; tipo?: string },
  ): Promise<RegistroDeQualidade[]> => this.qualidade.listar(orgaoId, filtros);
}
