import type { Response } from "express";
import type { ArquivoParaLeitura } from "../../application/ports/ArmazenamentoArquivos";

/**
 * Despeja um objeto do storage na resposta. Erro no meio do fluxo não vira
 * 500: o cabeçalho já foi enviado, então só resta derrubar a conexão.
 */
export const enviarArquivo = (
  res: Response,
  { fluxo, tamanho, mimeType }: ArquivoParaLeitura,
  opcoes: { nomeParaDownload?: string; cacheSegundos?: number } = {},
): void => {
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", tamanho);
  if (opcoes.nomeParaDownload) {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(opcoes.nomeParaDownload)}`,
    );
  }
  if (opcoes.cacheSegundos) {
    res.setHeader("Cache-Control", `private, max-age=${opcoes.cacheSegundos}`);
  }

  fluxo.on("error", (erro) => {
    console.error("Falha ao ler arquivo do storage", erro);
    res.destroy(erro);
  });
  fluxo.pipe(res);
};
