import { Conflito, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { DadosFornecedor, FornecedorRepository } from "../ports/FornecedorRepository";

// Cadastro global: criar exige documento inédito; atualizar registra histórico
// com quem alterou (proteção entre prefeituras que compartilham o registro).
export class ManterFornecedor {
  constructor(private readonly fornecedores: FornecedorRepository) {}

  criar = async (dados: DadosFornecedor): Promise<{ id: string }> => {
    const existente = await this.fornecedores.buscarPorDocumento(dados.documento);
    if (existente) {
      throw new Conflito("Fornecedor já cadastrado com este documento", { id: existente.id });
    }
    const id = await this.fornecedores.criar(dados);
    return { id };
  };

  atualizar = async (
    id: string,
    dados: Partial<Omit<DadosFornecedor, "documento">>,
    alteradoPor: string,
  ): Promise<void> => {
    const existente = await this.fornecedores.buscarPorId(id);
    if (!existente) throw new NaoEncontrado("Fornecedor não encontrado");
    await this.fornecedores.atualizar(id, dados, alteradoPor);
  };
}
