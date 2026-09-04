/**
 * A peça emitida como arquivo que se abre e se imprime.
 *
 * O sistema guarda a peça como HTML congelado na emissão — é o que a tela
 * mostra dentro da folha timbrada. Para ir no pacote dos autos ela precisa
 * virar arquivo, e o arquivo precisa se bastar: abrir com dois cliques, sem
 * servidor no ar, e imprimir parecido com o que a tela imprime.
 *
 * O estilo vai embutido e mínimo, de propósito. Copiar o CSS do web para cá
 * criaria duas verdades sobre a mesma folha, e a daqui envelheceria calada.
 */

export type PecaParaArquivo = {
  codigo: string;
  titulo: string;
  corpo: string;
  /**
   * O tipo do repositório diz `string`, e o driver entrega `Date`.
   *
   * `pg` converte `TIMESTAMPTZ` em `Date` por padrão, e nenhuma camada entre o
   * banco e aqui desfaz isso — o `string` do tipo é uma promessa que ninguém
   * cumpre. Chamar `.replace()` nesse valor derrubava o pacote inteiro com
   * "Erro interno". Declarar os dois é dizer a verdade sobre o que chega.
   */
  data: string | Date | null;
  emitidoPorNome: string;
  emitidoPorCargo: string;
};

/**
 * `<` e `&` no título viram entidade: título é dado, não marcação.
 *
 * Aceita o que vier e converte: o valor nasce no banco, e uma coluna que muda
 * de tipo não pode virar página de erro.
 */
const escapar = (texto: unknown): string =>
  String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Data por extenso curto, para o rodapé: "04/09/2026 às 14:32". */
const quando = (data: string | Date | null): string => {
  if (!data) return "";
  const momento = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(momento.getTime())) return "";
  return momento.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza",
  }).replace(", ", " às ");
};

export const pecaEmHtml = (peca: PecaParaArquivo, baseUrl: string): string => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapar(peca.titulo)} — ${escapar(peca.codigo)}</title>
<style>
  @page { size: A4; margin: 25mm 20mm; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #15181d;
    max-width: 170mm;
    margin: 0 auto;
    padding: 16mm 8mm;
  }
  h1 { font-size: 14pt; text-align: center; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #999; padding: 5px 8px; text-align: left; }
  .rodape {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #999;
    font-size: 9pt;
    color: #444;
  }
  .codigo { font-family: ui-monospace, monospace; font-size: 11pt; }
</style>
</head>
<body>
<h1>${escapar(peca.titulo)}</h1>
${peca.corpo}
<div class="rodape">
  <p>Emitido por ${escapar(peca.emitidoPorNome)}${
  peca.emitidoPorCargo ? ` — ${escapar(peca.emitidoPorCargo)}` : ""
}${quando(peca.data) ? ` em ${quando(peca.data)}` : ""}.</p>
  <p>Código de conferência: <span class="codigo">${escapar(peca.codigo)}</span></p>
  <p>Confira a autenticidade em ${escapar(baseUrl)}/conferencia informando o código acima.</p>
</div>
</body>
</html>
`;
