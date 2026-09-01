import {
  cabeNaLicitacao, disponivelNaLicitacao,
} from "../../domain/contrato/TetoDaLicitacao";
import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { ContratoRepository } from "../ports/ContratoRepository";

/**
 * A licitação autoriza um valor; os contratos dela, somados, não passam disso.
 *
 * Bloqueio, e não aviso: o aviso que se pode ignorar é o aviso que se ignora
 * sempre, e o número aqui é o que a licitação autorizou gastar.
 *
 * **Contrato de ata não entra.** A ata tem saldo próprio, por item, e somar
 * valores de atas diferentes não diria nada sobre o que ainda cabe.
 */
export const exigirCaberNaLicitacao = async (
  contratos: ContratoRepository,
  entrada: {
    orgaoId: string;
    licitacaoId?: string | null;
    valorTotal: number;
    exceto?: string;
  },
): Promise<void> => {
  if (!entrada.licitacaoId) return;

  const teto = await contratos.tetoDaLicitacao(
    entrada.orgaoId, entrada.licitacaoId, entrada.exceto,
  );
  if (!teto) throw new NaoEncontrado("Licitação não encontrada");

  if (cabeNaLicitacao(teto, entrada.valorTotal)) return;

  const disponivel = disponivelNaLicitacao(teto);
  throw new ErroDeNegocio(
    `A licitação autorizou ${moeda(teto.valorLicitacao)} e já tem `
    + `${moeda(teto.jaContratado)} em contratos. `
    + (disponivel > 0
      ? `Ainda cabem ${moeda(disponivel)}, e este contrato é de ${moeda(entrada.valorTotal)}.`
      : `Não há saldo: o valor da licitação já foi todo contratado.`),
    422,
  );
};

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
