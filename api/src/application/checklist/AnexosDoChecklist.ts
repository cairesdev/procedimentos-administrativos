import { randomUUID } from "node:crypto";
import { NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { sanitizarNomeDeArquivo } from "../shared/NomeDeArquivo";
import type { ChecklistRepository } from "../ports/ChecklistRepository";
import type { ArmazenamentoArquivos } from "../ports/ArmazenamentoArquivos";

/**
 * O documento que comprova o cumprimento.
 *
 * Pende do **ciclo**, e não do item: cada volta tem o seu documento, e é o do
 * ciclo certo que a prestação de contas precisa mostrar.
 */
export class AnexosDoChecklist {
  constructor(
    private readonly checklists: ChecklistRepository,
    private readonly storage: ArmazenamentoArquivos,
  ) {}

  anexar = async (dados: {
    orgaoId: string;
    cumprimentoId: string;
    nomeOriginal: string;
    conteudo: Buffer;
    mimeType: string;
  }): Promise<{ id: string }> => {
    const caminho = `${dados.orgaoId}/checklist/${dados.cumprimentoId}`
      + `/${randomUUID()}-${sanitizarNomeDeArquivo(dados.nomeOriginal)}`;

    // Mesma compensação dos anexos de processo: sobe o arquivo, grava a linha,
    // e apaga o arquivo se a linha falhar. Sem isso, o insert recusado
    // deixaria lixo no MinIO que ninguém mais alcança.
    await this.storage.salvar(caminho, dados.conteudo, dados.mimeType);
    try {
      const id = await this.checklists.registrarAnexo({
        cumprimentoId: dados.cumprimentoId,
        arquivo: caminho,
        nomeOriginal: dados.nomeOriginal,
        tamanhoBytes: dados.conteudo.length,
      });
      return { id };
    } catch (erro) {
      await this.storage.remover(caminho).catch(() => undefined);
      throw erro;
    }
  };

  baixar = async (orgaoId: string, anexoId: string) => {
    const anexo = await this.checklists.buscarAnexo(orgaoId, anexoId);
    if (!anexo) throw new NaoEncontrado("Anexo não encontrado");

    // O download passa pela API, como o dos anexos de processo: o
    // armazenamento fica privado, sem URL pré-assinada nem host público.
    return { nomeOriginal: anexo.nomeOriginal, arquivo: await this.storage.abrir(anexo.arquivo) };
  };
}
