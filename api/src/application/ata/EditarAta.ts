import { ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste, garantirSemVinculos } from "../shared/ExclusaoSegura";
import type { AtaRepository, EdicaoAta } from "../ports/AtaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

// Ata que já originou contrato vira somente leitura: mexer nos itens
// depois disso desalinharia o saldo já contratado.
export class EditarAta {
  constructor(
    private readonly atas: AtaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (orgaoId: string, id: string, dados: EdicaoAta): Promise<void> => {
    const atual = garantirExiste(await this.atas.buscar(orgaoId, id), "Ata");

    const vinculos = await this.atas.contarVinculos(orgaoId, id);
    if (Object.keys(vinculos).length > 0 && dados.itens) {
      throw new ErroDeNegocio(
        "Ata já utilizada em contrato: os itens não podem mais ser alterados",
        422,
        vinculos,
      );
    }

    const assinatura = dados.dataAssinatura ?? atual.dataAssinatura;
    const vigencia = dados.dataVigencia ?? atual.dataVigencia;
    if (new Date(vigencia) < new Date(assinatura)) {
      throw new ErroDeNegocio("Vigência não pode ser anterior à data de assinatura");
    }

    await this.transacao((tx) => this.atas.atualizar(orgaoId, id, dados, tx));
  };

  remover = async (orgaoId: string, id: string): Promise<void> => {
    garantirExiste(await this.atas.buscar(orgaoId, id), "Ata");
    garantirSemVinculos(await this.atas.contarVinculos(orgaoId, id), "Ata");
    await this.transacao((tx) => this.atas.remover(orgaoId, id, tx));
  };
}
