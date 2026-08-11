import { Conflito, ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste, garantirSemVinculos } from "../shared/ExclusaoSegura";
import type { EdicaoLicitacao, LicitacaoRepository } from "../ports/LicitacaoRepository";

// Licitação que já gerou contrato ou ata só aceita ajuste de texto
// (resumo e objeto); número, modalidade, data e valor ficam travados.
const CAMPOS_TRAVADOS: (keyof EdicaoLicitacao)[] = [
  "numero",
  "modalidade",
  "dataAssinatura",
  "valorTotal",
  "unidadesDestinadas",
];

export class EditarLicitacao {
  constructor(private readonly licitacoes: LicitacaoRepository) {}

  executar = async (orgaoId: string, id: string, dados: EdicaoLicitacao): Promise<void> => {
    const atual = garantirExiste(await this.licitacoes.buscarPorId(orgaoId, id), "Licitação");

    const vinculos = await this.licitacoes.contarVinculos(orgaoId, id);
    if (Object.keys(vinculos).length > 0) {
      const travado = CAMPOS_TRAVADOS.find((campo) => dados[campo] !== undefined);
      if (travado) {
        throw new ErroDeNegocio(
          "Licitação já originou contrato ou ata: só resumo e objeto podem ser alterados",
          422,
          vinculos,
        );
      }
    }

    if (dados.numero && dados.numero !== atual.numero) {
      const duplicada = await this.licitacoes.existeNumero(orgaoId, dados.numero, id);
      if (duplicada) throw new Conflito(`Já existe licitação com o número ${dados.numero}`);
    }

    await this.licitacoes.atualizar(orgaoId, id, dados);
  };

  remover = async (orgaoId: string, id: string): Promise<void> => {
    garantirExiste(await this.licitacoes.buscarPorId(orgaoId, id), "Licitação");
    garantirSemVinculos(await this.licitacoes.contarVinculos(orgaoId, id), "Licitação");
    await this.licitacoes.remover(orgaoId, id);
  };
}
