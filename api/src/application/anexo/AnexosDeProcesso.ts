import { randomUUID } from "node:crypto";
import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AnexoDetalhe, AnexoRepository, ArmazenamentoArquivos } from "../ports/ArmazenamentoArquivos";
import type { TramitacaoRepository } from "../ports/TramitacaoRepository";

export type AnexarEntrada = {
  orgaoId: string;
  processoId: string;
  usuarioId: string;
  tipoDocumento: string;
  nomeOriginal: string;
  conteudo: Buffer;
  mimeType: string;
  despachoId?: string;
};

export class AnexosDeProcesso {
  constructor(
    private readonly anexos: AnexoRepository,
    private readonly tramitacao: TramitacaoRepository,
    private readonly storage: ArmazenamentoArquivos,
  ) {}

  anexar = async (dados: AnexarEntrada): Promise<{ id: string }> => {
    const processo = await this.tramitacao.buscarProcesso(dados.orgaoId, dados.processoId);
    if (!processo) throw new NaoEncontrado("Processo não encontrado");
    if (processo.status === "ENCERRADO" || processo.status === "CANCELADO") {
      throw new ErroDeNegocio("Processo concluído não recebe anexos");
    }

    const caminho = `${dados.orgaoId}/processos/${dados.processoId}/${randomUUID()}-${sanitizar(dados.nomeOriginal)}`;

    // Compensação: upload primeiro, insert depois, remove o arquivo se o insert falhar.
    await this.storage.salvar(caminho, dados.conteudo, dados.mimeType);
    try {
      const id = await this.anexos.criar({
        processoId: dados.processoId,
        despachoId: dados.despachoId,
        tipoDocumento: dados.tipoDocumento,
        arquivo: caminho,
        enviadoPorUsuarioId: dados.usuarioId,
      });
      return { id };
    } catch (error) {
      await this.storage.remover(caminho);
      throw error;
    }
  };

  listar = async (orgaoId: string, processoId: string): Promise<AnexoDetalhe[]> => {
    const processo = await this.tramitacao.buscarProcesso(orgaoId, processoId);
    if (!processo) throw new NaoEncontrado("Processo não encontrado");
    return this.anexos.listarPorProcesso(processoId);
  };

  linkDownload = async (orgaoId: string, anexoId: string): Promise<{ url: string }> => {
    const anexo = await this.anexos.buscar(orgaoId, anexoId);
    if (!anexo) throw new NaoEncontrado("Anexo não encontrado");
    const url = await this.storage.urlTemporaria(anexo.arquivo, 600);
    return { url };
  };

  remover = async (orgaoId: string, anexoId: string): Promise<void> => {
    // Nome do arquivo sempre resolvido pelo id no banco — nunca vem pela URL.
    const anexo = await this.anexos.buscar(orgaoId, anexoId);
    if (!anexo) throw new NaoEncontrado("Anexo não encontrado");
    await this.anexos.remover(anexoId);
    await this.storage.remover(anexo.arquivo);
  };
}

const sanitizar = (nome: string): string =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
