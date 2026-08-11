export interface ArmazenamentoArquivos {
  salvar(caminho: string, conteudo: Buffer, mimeType: string): Promise<void>;
  remover(caminho: string): Promise<void>;
  urlTemporaria(caminho: string, expiraEmSegundos: number): Promise<string>;
}

export type NovoAnexo = {
  processoId: string;
  despachoId?: string;
  tipoDocumento: string;
  arquivo: string;
  enviadoPorUsuarioId?: string;
  enviadoPorRequerenteId?: string;
};

export type AnexoDetalhe = {
  id: string;
  processoId: string;
  despachoId: string | null;
  tipoDocumento: string;
  arquivo: string;
  data: string;
};

export interface AnexoRepository {
  criar(dados: NovoAnexo): Promise<string>;
  listarPorProcesso(processoId: string): Promise<AnexoDetalhe[]>;
  buscar(orgaoId: string, anexoId: string): Promise<AnexoDetalhe | null>;
  remover(anexoId: string): Promise<void>;
}
