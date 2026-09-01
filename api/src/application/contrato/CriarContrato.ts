import { exigirCaberNaLicitacao } from "./TetoDaLicitacao";
import { Conflito, ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ContratoRepository, NovoContrato } from "../ports/ContratoRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

export type CriarContratoEntrada = NovoContrato & { usuarioId?: string };

// Contrato é cadastro de base: não abre processo administrativo.
// Protocolo e processo só nascem quando a unidade envia uma solicitação.
export class CriarContrato {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: CriarContratoEntrada): Promise<{ id: string }> => {
    if (!dados.licitacaoId && !dados.ataId) {
      throw new ErroDeNegocio("Contrato precisa nascer de uma licitação ou de uma ata de registro de preços");
    }
    // Sem data de fim, o contrato vale por prazo indeterminado.
    if (dados.dataFim && new Date(dados.dataFim) < new Date(dados.dataInicio)) {
      throw new ErroDeNegocio("Data de fim não pode ser anterior à data de início");
    }
    if (dados.itens.length === 0) {
      throw new ErroDeNegocio("Contrato precisa de ao menos um item");
    }

    await exigirCaberNaLicitacao(this.contratos, {
      orgaoId: dados.orgaoId,
      licitacaoId: dados.licitacaoId,
      valorTotal: dados.valorTotal,
    });

    const duplicado = await this.contratos.existeNumero(dados.orgaoId, dados.numero);
    if (duplicado) {
      throw new Conflito(`Já existe contrato com o número ${dados.numero}`, { numero: dados.numero });
    }

    return this.transacao(async (tx) => {
      const id = await this.contratos.criar(dados, tx);
      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "CONTRATO_CRIADO",
        referenciaId: id,
        detalhes: {
          numero: dados.numero,
          fornecedorId: dados.fornecedorId,
          origem: dados.ataId ? "ATA" : "LICITACAO",
          valorTotal: dados.valorTotal,
          quantidadeItens: dados.itens.length,
        },
      }, tx);
      return { id };
    });
  };
}
