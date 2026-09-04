import type { Readable } from "node:stream";

export type ArquivoParaLeitura = {
  fluxo: Readable;
  tamanho: number;
  mimeType: string;
};

export interface ArmazenamentoArquivos {
  salvar(caminho: string, conteudo: Buffer, mimeType: string): Promise<void>;
  remover(caminho: string): Promise<void>;
  /**
   * Fluxo de leitura do objeto. O download passa pela API em vez de URL
   * pré-assinada: o armazenamento fica privado, sem precisar de host público.
   */
  abrir(caminho: string): Promise<ArquivoParaLeitura>;
}

export type NovoAnexo = {
  processoId: string;
  despachoId?: string;
  tipoDocumento: string;
  arquivo: string;
  enviadoPorUsuarioId?: string;
  enviadoPorRequerenteId?: string;
  /** Exigência que este documento responde; nulo = envio espontâneo. */
  exigenciaId?: string;
};

export type AnexoDetalhe = {
  id: string;
  processoId: string;
  despachoId: string | null;
  tipoDocumento: string;
  arquivo: string;
  data: string;
  /**
   * Quem juntou o arquivo.
   *
   * A tela precisa saber: o teto de dez conta só o do servidor, e um contador
   * que somasse a resposta do cidadão diria "8/10" onde a API ainda aceita
   * dez. Um número que discorda da regra é pior que nenhum número.
   */
  origem: "SERVIDOR" | "REQUERENTE";
};

export interface AnexoRepository {
  criar(dados: NovoAnexo): Promise<string>;
  listarPorProcesso(processoId: string): Promise<AnexoDetalhe[]>;
  buscar(orgaoId: string, anexoId: string): Promise<AnexoDetalhe | null>;
  remover(anexoId: string): Promise<void>;
  /**
   * Quantos arquivos **o servidor** anexou a este processo.
   *
   * Conta só o que entrou por dentro. O que o cidadão manda respondendo
   * exigência não gasta a cota: ele não enxerga quantos arquivos já existem, e
   * barrá-lo travaria a resposta que o próprio processo pediu.
   */
  contarDoServidor(processoId: string): Promise<number>;
}
