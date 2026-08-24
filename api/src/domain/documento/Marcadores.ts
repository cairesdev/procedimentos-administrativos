import { ErroDeNegocio } from "../shared/ErroDeNegocio";

/**
 * Interpolação dos modelos de documento.
 *
 * Não é linguagem de template: são duas construções, de propósito.
 *
 *   {{contrato.numero}}                    valor simples
 *   {{#itens}} <tr>{{produto}}</tr> {{/itens}}   repete por item da lista
 *
 * Sem condicional, sem laço aninhado, sem expressão. Modelo de documento
 * oficial é preenchimento de lacuna — quanto menos poder, menos chance de a
 * prefeitura produzir uma peça quebrada que só aparece na hora de imprimir.
 */

export type ValorDeContexto = string | number | boolean | null | undefined;

export type ContextoDeDocumento = {
  // `unknown` na folha: o contexto nasce de linha do banco, e apertar o tipo
  // aqui só empurraria um `as` para cada consulta. O que garante o resultado é
  // `formatar`, que trata qualquer valor, e o catálogo, que limita o que o
  // modelo pode pedir.
  [chave: string]: unknown;
};

const MARCADOR = /\{\{\s*([#/]?)([\w.]+)\s*\}\}/g;

/** Escapa o valor interpolado: dado de cadastro nunca vira marcação. */
const escapar = (texto: string): string =>
  texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const ehLista = (valor: unknown): valor is ContextoDeDocumento[] => Array.isArray(valor);

const ehObjeto = (valor: unknown): valor is ContextoDeDocumento =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

/** Navega `a.b.c` no contexto. `undefined` = caminho inexistente. */
const buscar = (contexto: ContextoDeDocumento, caminho: string): unknown => {
  let atual: unknown = contexto;
  for (const parte of caminho.split(".")) {
    if (!ehObjeto(atual)) return undefined;
    atual = (atual as Record<string, unknown>)[parte];
  }
  return atual;
};

const formatar = (valor: unknown): string => {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  return escapar(String(valor));
};

/** Marcadores usados por um modelo, separados por construção. */
export type MarcadoresDoModelo = {
  valores: string[];
  listas: string[];
};

export const marcadoresDe = (corpo: string): MarcadoresDoModelo => {
  const valores = new Set<string>();
  const listas = new Set<string>();

  for (const [, prefixo, caminho] of corpo.matchAll(MARCADOR)) {
    if (prefixo === "#" || prefixo === "/") listas.add(caminho!);
    else valores.add(caminho!);
  }
  return { valores: [...valores], listas: [...listas] };
};

/**
 * Blocos de repetição, na ordem em que aparecem. Um bloco aberto e não fechado
 * é erro de modelo, não texto solto — sairia marcação crua no documento.
 */
const separarBlocos = (corpo: string): { antes: string; lista: string; interno: string }[] => {
  const blocos: { antes: string; lista: string; interno: string }[] = [];
  const abertura = /\{\{\s*#\s*([\w.]+)\s*\}\}/g;

  let cursor = 0;
  let achado: RegExpExecArray | null;
  while ((achado = abertura.exec(corpo)) !== null) {
    const lista = achado[1]!;
    const fechamento = new RegExp(`\\{\\{\\s*/\\s*${lista.replace(".", "\\.")}\\s*\\}\\}`, "g");
    fechamento.lastIndex = achado.index + achado[0].length;

    const fim = fechamento.exec(corpo);
    if (!fim) {
      throw new ErroDeNegocio(`O bloco {{#${lista}}} foi aberto e não foi fechado com {{/${lista}}}`);
    }

    blocos.push({
      antes: corpo.slice(cursor, achado.index),
      lista,
      interno: corpo.slice(achado.index + achado[0].length, fim.index),
    });
    cursor = fim.index + fim[0].length;
    abertura.lastIndex = cursor;
  }

  if (cursor < corpo.length) blocos.push({ antes: corpo.slice(cursor), lista: "", interno: "" });
  return blocos;
};

/** Substitui os marcadores simples, anotando os que o contexto não conhece. */
const interpolarValores = (
  trecho: string,
  contexto: ContextoDeDocumento,
  desconhecidos: Set<string>,
): string =>
  trecho.replace(MARCADOR, (original, prefixo: string, caminho: string) => {
    if (prefixo) return original; // bloco: tratado fora daqui
    const valor = buscar(contexto, caminho);
    if (valor === undefined) {
      desconhecidos.add(caminho);
      return original;
    }
    return formatar(valor);
  });

/**
 * Monta o corpo final. Marcador que o contexto não conhece **derruba a
 * emissão**: documento oficial com lacuna em branco é pior que documento que
 * não saiu, e a mensagem diz exatamente qual marcador corrigir no modelo.
 */
export const renderizar = (corpo: string, contexto: ContextoDeDocumento): string => {
  const desconhecidos = new Set<string>();
  const partes: string[] = [];

  for (const bloco of separarBlocos(corpo)) {
    partes.push(interpolarValores(bloco.antes, contexto, desconhecidos));
    if (!bloco.lista) continue;

    const itens = buscar(contexto, bloco.lista);
    if (itens === undefined) {
      desconhecidos.add(bloco.lista);
      continue;
    }
    if (!ehLista(itens)) {
      throw new ErroDeNegocio(`O marcador {{#${bloco.lista}}} não é uma lista de itens`);
    }

    for (const [indice, item] of itens.entries()) {
      // `indice` deixa o modelo numerar as linhas, como nas ordens do legado.
      partes.push(interpolarValores(bloco.interno, { ...item, indice: indice + 1 }, desconhecidos));
    }
  }

  if (desconhecidos.size > 0) {
    throw new ErroDeNegocio(
      `O modelo usa marcador que não existe neste documento: ${[...desconhecidos]
        .map((nome) => `{{${nome}}}`)
        .join(", ")}`,
      422,
      { marcadoresDesconhecidos: [...desconhecidos] },
    );
  }
  return partes.join("");
};

/**
 * Confere o modelo contra o catálogo do tipo, na hora de salvar — para o erro
 * aparecer para quem edita, e não para quem tenta emitir.
 */
export const validarContraCatalogo = (
  corpo: string,
  catalogo: { valores: string[]; listas: Record<string, string[]> },
): void => {
  const usados = marcadoresDe(corpo);
  const problemas: string[] = [];

  const dentroDeLista = new Set<string>();
  for (const bloco of separarBlocos(corpo)) {
    if (!bloco.lista) continue;

    // O que está dentro do bloco sai da conferência de topo mesmo quando a
    // lista é inválida: senão um `{{#itens}}` errado geraria uma reclamação
    // por coluna da tabela, escondendo a causa real no meio do ruído.
    const internos = marcadoresDe(bloco.interno).valores;
    for (const marcador of internos) dentroDeLista.add(marcador);

    if (!(bloco.lista in catalogo.listas)) {
      problemas.push(
        `{{#${bloco.lista}}} não é uma lista deste documento`
        + (Object.keys(catalogo.listas).length > 0
          ? ` (aqui existe: ${Object.keys(catalogo.listas).map((nome) => `{{#${nome}}}`).join(", ")})`
          : " — este documento não tem lista nenhuma"),
      );
      continue;
    }

    const permitidos = catalogo.listas[bloco.lista]!;
    for (const marcador of internos) {
      if (marcador !== "indice" && !permitidos.includes(marcador)) {
        problemas.push(`{{${marcador}}} não existe dentro de {{#${bloco.lista}}}`);
      }
    }
  }

  for (const marcador of usados.valores) {
    if (dentroDeLista.has(marcador)) continue;
    if (!catalogo.valores.includes(marcador)) {
      problemas.push(`{{${marcador}}} não existe neste documento`);
    }
  }

  if (problemas.length > 0) {
    throw new ErroDeNegocio(`Modelo com marcador inválido: ${problemas.join("; ")}`, 422, {
      problemas,
    });
  }
};
