import { ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste, garantirSemVinculos } from "../shared/ExclusaoSegura";
import type { ContratoRepository, EdicaoContrato } from "../ports/ContratoRepository";
import type { ProcessoRepository } from "../ports/ProcessoRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

// Contrato em uso não muda de valor nem de item: a reserva de saldo das
// solicitações depende deles. Só datas, fiscal e unidades são editáveis.
export class EditarContrato {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly processos: ProcessoRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (orgaoId: string, id: string, dados: EdicaoContrato): Promise<void> => {
    const atual = garantirExiste(await this.contratos.buscar(orgaoId, id), "Contrato");

    const inicio = dados.dataInicio ?? atual.dataInicio;
    const fim = dados.dataFim ?? atual.dataFim;
    if (new Date(fim) < new Date(inicio)) {
      throw new ErroDeNegocio("Fim da vigência não pode ser anterior ao início");
    }

    await this.contratos.atualizar(orgaoId, id, dados);
  };

  // Some com o contrato e cancela o processo administrativo que nasceu com ele.
  remover = async (orgaoId: string, id: string): Promise<void> => {
    const atual = garantirExiste(await this.contratos.buscar(orgaoId, id), "Contrato");
    garantirSemVinculos(await this.contratos.contarVinculos(orgaoId, id), "Contrato");

    await this.transacao(async (tx) => {
      await this.contratos.remover(orgaoId, id, tx);
      await this.processos.cancelar(orgaoId, atual.processoId, tx);
    });
  };
}
