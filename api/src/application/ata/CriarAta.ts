import { ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import type { AtaRepository, NovaAta } from "../ports/AtaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

export class CriarAta {
  constructor(
    private readonly atas: AtaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: NovaAta): Promise<{ id: string }> => {
    if (new Date(dados.dataVigencia) < new Date(dados.dataAssinatura)) {
      throw new ErroDeNegocio("Vigência não pode ser anterior à data de assinatura");
    }
    if (dados.itens.length === 0) {
      throw new ErroDeNegocio("Ata precisa de ao menos um item");
    }

    // O número **pode repetir**: a numeração reinicia a cada exercício, e o
    // número de uma ata carrega o do órgão de origem. Quem identifica é o id.

    const id = await this.transacao((tx) => this.atas.criar(dados, tx));
    return { id };
  };
}
