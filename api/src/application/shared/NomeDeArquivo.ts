/**
 * Nome seguro para chave de objeto no storage: sem acento, sem espaço, sem
 * barra — o que chega do navegador não pode virar caminho.
 */
export const sanitizarNomeDeArquivo = (nome: string): string =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
