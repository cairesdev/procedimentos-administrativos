/**
 * Quem o destinatário vê no "De:".
 *
 * O endereço é o do SMTP configurado; o nome de exibição leva a prefeitura.
 * Isso importa mais do que parece: quando a prefeitura não tem domínio próprio,
 * o e-mail sai pelo remetente do produto, e o cidadão receberia uma exigência
 * de um endereço que ele nunca ouviu falar. O e-mail que mais importa é
 * justamente o que mais pareceria golpe.
 *
 * Com domínio próprio o nome também vai: `"Prefeitura de Monção"
 * <naoresponda@moncao.ma.gov.br>` lê melhor que o endereço sozinho.
 */

/**
 * O nome do órgão entra num cabeçalho, e cabeçalho quebra em quebra de linha.
 *
 * `nome` vem do cadastro, que um administrador digita. Um `\r\n` ali dentro
 * encerraria o `From:` e o que viesse depois seria lido como cabeçalho novo —
 * um `Bcc:` inventado, por exemplo. É injeção de cabeçalho, e a defesa é não
 * deixar caractere de controle chegar ao header.
 *
 * As aspas saem junto: o nome vai entre aspas, e uma aspa no meio fecharia o
 * campo mais cedo. Ponto e vírgula e vírgula separam endereços em alguns
 * servidores e também saem.
 */
const nomeParaCabecalho = (nome: string): string =>
  nome
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["\\<>;,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 78);

/**
 * `"Prefeitura de Monção" <naoresponda@dominio>`.
 *
 * Sem nome utilizável — órgão só com pontuação, por exemplo — devolve o
 * endereço puro. Um `From:` com aspas vazias é pior que um sem nome: alguns
 * clientes mostram a linha crua.
 */
export const remetenteComNome = (nomeDoOrgao: string, endereco: string): string => {
  const nome = nomeParaCabecalho(nomeDoOrgao ?? "");
  return nome ? `"${nome}" <${endereco}>` : endereco;
};

/**
 * Endereço que vale a pena tentar.
 *
 * Deliberadamente frouxo. Validar e-mail por regex "completa" é folclore: a
 * norma aceita coisas que nenhuma regex curta cobre, e toda tentativa acaba
 * recusando endereço de gente de verdade. O que se quer aqui é só barrar o que
 * **certamente** não é endereço — nome digitado no campo errado, campo vazio,
 * espaço no meio —, porque isso é erro de digitação e o lugar de pegá-lo é
 * antes de entrar na fila, não na quinta tentativa de entrega.
 *
 * Quem decide de verdade se o endereço existe é o servidor do destinatário.
 */
export const enderecoValido = (endereco: string): boolean => {
  const limpo = (endereco ?? "").trim();
  if (limpo.length < 6 || limpo.length > 200) return false;
  if (/[\s<>",;\\]/.test(limpo)) return false;

  const partes = limpo.split("@");
  if (partes.length !== 2) return false;

  const [local, dominio] = partes as [string, string];
  if (!local || !dominio) return false;
  // Domínio sem ponto é `algo@localhost`: legítimo em rede interna, e nunca no
  // cadastro de um fornecedor ou de um cidadão.
  if (!dominio.includes(".")) return false;
  if (dominio.startsWith(".") || dominio.endsWith(".") || dominio.includes("..")) return false;

  return true;
};
