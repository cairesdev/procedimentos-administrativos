import { Conflito } from "../../domain/shared/ErroDeNegocio";
import type { LicitacaoRepository, NovaLicitacao } from "../ports/LicitacaoRepository";

export class CriarLicitacao {
  constructor(private readonly licitacoes: LicitacaoRepository) {}

  executar = async (dados: NovaLicitacao): Promise<{ id: string }> => {
    const duplicada = await this.licitacoes.existeNumero(dados.orgaoId, dados.numero);
    if (duplicada) {
      throw new Conflito(`Já existe licitação com o número ${dados.numero}`, { numero: dados.numero });
    }
    const id = await this.licitacoes.criar(dados);
    return { id };
  };
}
