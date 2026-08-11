import { ErroDeNegocio } from "../shared/ErroDeNegocio";

export type ModoMedicao = "UNIDADE" | "PERCENTUAL" | "VALOR";

export type ItemParaCalculo = {
  modoMedicao: ModoMedicao;
  valorUnitario: number;
  valorTotal: number;
  quantidadeTotal: number;
};

export const calcularValorSolicitado = (
  item: ItemParaCalculo,
  quantidadeSolicitada: number,
): number => {
  if (quantidadeSolicitada <= 0) {
    throw new ErroDeNegocio("Quantidade solicitada deve ser maior que zero");
  }

  if (item.modoMedicao === "UNIDADE") {
    return arredondar(quantidadeSolicitada * item.valorUnitario);
  }

  if (item.modoMedicao === "PERCENTUAL") {
    if (quantidadeSolicitada > 100) {
      throw new ErroDeNegocio("Percentual solicitado não pode exceder 100");
    }
    return arredondar((quantidadeSolicitada / 100) * item.valorTotal);
  }

  return arredondar(quantidadeSolicitada);
};

const arredondar = (valor: number): number => Math.round(valor * 100) / 100;
