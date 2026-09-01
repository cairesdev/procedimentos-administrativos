import { exigirCaberNaLicitacao } from "./TetoDaLicitacao";
import { ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste, garantirSemVinculos } from "../shared/ExclusaoSegura";
import type { ContratoRepository, EdicaoContrato } from "../ports/ContratoRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

// Contrato em uso não muda de valor nem de item: a reserva de saldo das
// solicitações depende deles. Só datas, fiscal e unidades são editáveis.
export class EditarContrato {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (orgaoId: string, id: string, dados: EdicaoContrato): Promise<void> => {
    const atual = garantirExiste(await this.contratos.buscar(orgaoId, id), "Contrato");

    const inicio = dados.dataInicio ?? atual.dataInicio;
    const fim = dados.dataFim === undefined ? atual.dataFim : dados.dataFim;
    if (fim && new Date(fim) < new Date(inicio)) {
      throw new ErroDeNegocio("Fim da vigência não pode ser anterior ao início");
    }

    /**
     * O teto vale na edição também.
     *
     * Sem isto, a trava da criação seria contornável em dois passos: cria-se o
     * contrato dentro do limite e aumenta-se o valor depois.
     */
    if (dados.valorTotal !== undefined && atual.licitacaoId) {
      await exigirCaberNaLicitacao(this.contratos, {
        orgaoId,
        licitacaoId: atual.licitacaoId,
        valorTotal: dados.valorTotal,
        // Fora da soma: senão o próprio contrato entraria nela duas vezes, e
        // qualquer edição de um contrato no teto seria recusada.
        exceto: id,
      });
    }

    await this.contratos.atualizar(orgaoId, id, dados);
  };

  remover = async (orgaoId: string, id: string): Promise<void> => {
    garantirExiste(await this.contratos.buscar(orgaoId, id), "Contrato");
    garantirSemVinculos(await this.contratos.contarVinculos(orgaoId, id), "Contrato");
    await this.transacao((tx) => this.contratos.remover(orgaoId, id, tx));
  };
}
