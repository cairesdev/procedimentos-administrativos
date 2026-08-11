import { Conflito, ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ContratoRepository, NovoContrato } from "../ports/ContratoRepository";
import type { ProcessoRepository } from "../ports/ProcessoRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { GeradorNumeroProcesso } from "../shared/GeradorNumeroProcesso";

export type CriarContratoEntrada = Omit<NovoContrato, "processoId"> & { usuarioId?: string };

export class CriarContrato {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly processos: ProcessoRepository,
    private readonly numeracao: GeradorNumeroProcesso,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: CriarContratoEntrada): Promise<{ id: string; numeroProtocolo: string; numeroProcessoAdm: string }> => {
    if (!dados.licitacaoId && !dados.ataId) {
      throw new ErroDeNegocio("Contrato precisa nascer de uma licitação ou de uma ata de registro de preços");
    }
    if (new Date(dados.dataFim) < new Date(dados.dataInicio)) {
      throw new ErroDeNegocio("Data de fim não pode ser anterior à data de início");
    }
    if (dados.itens.length === 0) {
      throw new ErroDeNegocio("Contrato precisa de ao menos um item");
    }

    const duplicado = await this.contratos.existeNumero(dados.orgaoId, dados.numero);
    if (duplicado) {
      throw new Conflito(`Já existe contrato com o número ${dados.numero}`, { numero: dados.numero });
    }

    return this.transacao(async (tx) => {
      const numeros = await this.numeracao.gerarPar(dados.orgaoId, tx);
      const processoId = await this.processos.criar(
        {
          orgaoId: dados.orgaoId,
          numeroProtocolo: numeros.protocolo,
          numeroProcessoAdm: numeros.processoAdm,
          tipoProcesso: "CONTRATO",
        },
        tx,
      );
      const id = await this.contratos.criar({ ...dados, processoId }, tx);
      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "CONTRATO_CRIADO",
        referenciaId: processoId,
        detalhes: {
          contratoId: id,
          numero: dados.numero,
          fornecedorId: dados.fornecedorId,
          valorTotal: dados.valorTotal,
          quantidadeItens: dados.itens.length,
          numeroProtocolo: numeros.protocolo,
        },
      }, tx);
      return { id, numeroProtocolo: numeros.protocolo, numeroProcessoAdm: numeros.processoAdm };
    });
  };
}
