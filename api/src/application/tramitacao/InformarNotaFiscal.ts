import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { TramitacaoRepository } from "../ports/TramitacaoRepository";

/**
 * O número da nota fiscal, informado depois da ordem.
 *
 * A ordem de fornecimento é emitida quando a compra é autorizada; a nota chega
 * junto com a mercadoria, dias depois. Exigi-la na emissão obrigaria a inventar
 * um número — e número inventado em documento oficial é pior que campo vazio.
 *
 * Quem informa é quem tem a nota em mãos: compras e **controladoria**. É a
 * primeira escrita da controladoria no sistema, e é deliberada — conferir a
 * nota é o trabalho dela.
 */
export class InformarNotaFiscal {
  constructor(
    private readonly tramitacao: TramitacaoRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  executar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    ordemId: string;
    numero: string | null;
  }): Promise<void> => {
    const ordem = await this.tramitacao.buscarOrdem(entrada.orgaoId, entrada.ordemId);
    if (!ordem) throw new NaoEncontrado("Ordem de fornecimento não encontrada");

    // Vazio é `null`, e não `""`: o índice de unicidade aceita vários nulos e
    // recusaria a segunda ordem com string vazia do mesmo fornecedor.
    const numero = entrada.numero?.trim() || null;

    if (numero && numero.length > 40) {
      throw new ErroDeNegocio("Número de nota fiscal longo demais");
    }

    await this.tramitacao.informarNotaFiscal(entrada.orgaoId, entrada.ordemId, numero);

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "NOTA_FISCAL_INFORMADA",
      referenciaId: ordem.processoId,
      // O antes entra na trilha: correção de nota é o que a controladoria vai
      // querer explicar depois.
      detalhes: { ordem: ordem.numero, de: ordem.numeroNotaFiscal, para: numero },
    });
  };
}
