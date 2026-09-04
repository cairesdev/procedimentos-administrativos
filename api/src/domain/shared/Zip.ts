/**
 * Um `.zip` montado à mão, sem dependência nova.
 *
 * Por que não `archiver` ou `jszip`: o pacote traria compressão, criptografia,
 * multi-volume e um punhado de transitivas para um uso só — juntar arquivos
 * num pacote. O formato ZIP tem trinta anos e a parte que interessa cabe aqui,
 * com o CRC32 que a norma exige.
 *
 * **Sem compressão, de propósito** (método 0, "guardado"). O que sai num
 * processo é PDF, JPEG e PNG — todos já comprimidos, onde o deflate rende
 * quase nada e custa CPU no servidor da prefeitura. O ganho seria ilusão; o
 * custo, real.
 *
 * O que este módulo **não** faz, e é preciso saber: nada aqui transmite em
 * fluxo. O pacote inteiro passa pela memória, e é o chamador quem decide o teto
 * de tamanho. Para os autos de um processo — dez anexos e as peças emitidas —
 * isso é dezenas de megabytes; para um acervo, seria a escolha errada.
 */

export type ArquivoDoPacote = {
  /**
   * Como o arquivo se chama dentro do pacote.
   *
   * É dado de fora — o nome que alguém deu ao arquivo ao enviá-lo —, e por
   * isso passa pelo saneamento: barra vira hífen, `..` desaparece.
   */
  nome: string;
  /**
   * A pasta onde ele fica, escolhida pelo código, não pelo usuário.
   *
   * Existe porque as duas coisas precisam ser separadas: uma barra em `nome`
   * é tentativa de fuga e vira hífen; uma barra aqui é a organização que o
   * pacote quer ter — `anexos/` e `pecas/`, para quem abre o zip entender o
   * que está vendo. Um só segmento, também saneado: o teste da pasta é ser
   * uma constante no código, e o saneamento garante que continue sendo.
   */
  pasta?: string;
  conteudo: Buffer;
};

/**
 * CRC-32 (IEEE 802.3), que o cabeçalho de cada entrada exige.
 *
 * A tabela é construída na primeira chamada e reaproveitada: são 256 entradas,
 * e recalculá-las por arquivo seria trabalho repetido sem motivo.
 */
const tabelaDeCrc = (() => {
  let tabela: Uint32Array | null = null;
  return () => {
    if (tabela) return tabela;
    tabela = new Uint32Array(256);
    for (let indice = 0; indice < 256; indice += 1) {
      let valor = indice;
      for (let bit = 0; bit < 8; bit += 1) {
        valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1;
      }
      tabela[indice] = valor >>> 0;
    }
    return tabela;
  };
})();

export const crc32 = (dados: Buffer): number => {
  const tabela = tabelaDeCrc();
  let resultado = 0xffffffff;
  for (const byte of dados) {
    resultado = tabela[(resultado ^ byte) & 0xff]! ^ (resultado >>> 8);
  }
  return (resultado ^ 0xffffffff) >>> 0;
};

/**
 * Data e hora no formato MS-DOS, que o ZIP herdou de 1980.
 *
 * Segundos têm resolução de dois em dois, e o ano começa em 1980 — data
 * anterior não cabe, e o descompactador mostra lixo. Como o pacote é montado
 * agora, isso nunca acontece na prática; o limite fica registrado para quem
 * um dia quiser preservar a data original de cada arquivo.
 */
const dataDosDos = (quando: Date) => ({
  hora: (quando.getHours() << 11) | (quando.getMinutes() << 5)
    | (Math.floor(quando.getSeconds() / 2)),
  data: ((quando.getFullYear() - 1980) << 9) | ((quando.getMonth() + 1) << 5)
    | quando.getDate(),
});

/**
 * Nome de arquivo que sobrevive a qualquer descompactador.
 *
 * Barra e contrabarra criariam pasta — ou, pior, sairiam da pasta de destino.
 * O ZIP não proíbe `../` no nome, e é assim que se escreve fora do lugar na
 * máquina de quem abre o pacote.
 */
export const nomeDentroDoPacote = (nome: string): string =>
  nome
    /**
     * Os pedaços de caminho são separados e os de subida, descartados.
     *
     * Trocar barra por hífen antes de tirar os pontos deixava `../../etc/passwd`
     * virar `-..-etc-passwd`: o traço no começo escondia os pontos de quem
     * viesse limpar depois. Descartar segmento a segmento não tem essa ordem
     * frágil.
     */
    .split(/[/\\]+/)
    // Só ponto não é nome: `.`, `..` e `....` viram nada, e o `|| "arquivo"`
    // lá embaixo dá um nome a quem ficou sem.
    .filter((pedaco) => pedaco !== "" && !/^\.+$/.test(pedaco))
    .join("-")
    /**
     * Caracteres de controle quebram descompactador antigo.
     *
     * O intervalo vai escrito por código de propósito: no editor, um
     * intervalo de espaço a hífen apaga metade do nome. Foi exatamente o
     * que o teste pegou na primeira versão disto.
     */
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180) || "arquivo";

/**
 * Nome repetido dentro do pacote vira "nome (2)".
 *
 * Dois anexos chamados "nota fiscal.pdf" é o caso comum, e o descompactador
 * resolveria sobrescrevendo um com o outro — em silêncio.
 */
export const semRepetir = (nomes: string[]): string[] => {
  const usados = new Map<string, number>();

  return nomes.map((nome) => {
    const chave = nome.toLowerCase();
    const vezes = usados.get(chave) ?? 0;
    usados.set(chave, vezes + 1);
    if (vezes === 0) return nome;

    const ponto = nome.lastIndexOf(".");
    return ponto > 0
      ? `${nome.slice(0, ponto)} (${vezes + 1})${nome.slice(ponto)}`
      : `${nome} (${vezes + 1})`;
  });
};

export const montarZip = (arquivos: ArquivoDoPacote[], agora = new Date()): Buffer => {
  const { hora, data } = dataDosDos(agora);
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;

  /**
   * Pasta e nome são saneados **separadamente** e só depois juntados.
   *
   * Sanear o caminho inteiro trocaria a barra da pasta por hífen — foi o que
   * aconteceu na primeira versão: o zip saía com `anexos-nota.pdf` no lugar de
   * `anexos/nota.pdf`, sem pasta nenhuma, e ninguém notaria olhando o código.
   * Quem abre o pacote perde a separação entre o que foi juntado e o que foi
   * emitido, que é metade do serviço.
   */
  const nomes = semRepetir(arquivos.map((arquivo) => {
    const nome = nomeDentroDoPacote(arquivo.nome);
    const pasta = arquivo.pasta ? nomeDentroDoPacote(arquivo.pasta) : "";
    return pasta ? `${pasta}/${nome}` : nome;
  }));

  arquivos.forEach((arquivo, indice) => {
    const nome = Buffer.from(nomes[indice]!, "utf8");
    const verificacao = crc32(arquivo.conteudo);
    const tamanho = arquivo.conteudo.length;

    const cabecalho = Buffer.alloc(30);
    cabecalho.writeUInt32LE(0x04034b50, 0); // assinatura da entrada local
    cabecalho.writeUInt16LE(20, 4); // versão mínima: 2.0
    // Bit 11: o nome vem em UTF-8. Sem ele, acento vira lixo no Windows.
    cabecalho.writeUInt16LE(0x0800, 6);
    cabecalho.writeUInt16LE(0, 8); // método 0 = guardado, sem compressão
    cabecalho.writeUInt16LE(hora, 10);
    cabecalho.writeUInt16LE(data, 12);
    cabecalho.writeUInt32LE(verificacao, 14);
    cabecalho.writeUInt32LE(tamanho, 18); // comprimido
    cabecalho.writeUInt32LE(tamanho, 22); // original — iguais, sem compressão
    cabecalho.writeUInt16LE(nome.length, 26);
    cabecalho.writeUInt16LE(0, 28); // sem campo extra

    locais.push(cabecalho, nome, arquivo.conteudo);

    const noIndice = Buffer.alloc(46);
    noIndice.writeUInt32LE(0x02014b50, 0); // assinatura do índice central
    noIndice.writeUInt16LE(20, 4); // versão de quem escreveu
    noIndice.writeUInt16LE(20, 6); // versão mínima para ler
    noIndice.writeUInt16LE(0x0800, 8);
    noIndice.writeUInt16LE(0, 10);
    noIndice.writeUInt16LE(hora, 12);
    noIndice.writeUInt16LE(data, 14);
    noIndice.writeUInt32LE(verificacao, 16);
    noIndice.writeUInt32LE(tamanho, 20);
    noIndice.writeUInt32LE(tamanho, 24);
    noIndice.writeUInt16LE(nome.length, 28);
    noIndice.writeUInt16LE(0, 30); // extra
    noIndice.writeUInt16LE(0, 32); // comentário
    noIndice.writeUInt16LE(0, 34); // número do disco
    noIndice.writeUInt16LE(0, 36); // atributos internos
    noIndice.writeUInt32LE(0, 38); // atributos externos
    noIndice.writeUInt32LE(deslocamento, 42); // onde a entrada local começa

    central.push(noIndice, nome);
    deslocamento += cabecalho.length + nome.length + tamanho;
  });

  const indice = Buffer.concat(central);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); // fim do índice central
  fim.writeUInt16LE(0, 4); // disco atual
  fim.writeUInt16LE(0, 6); // disco onde o índice começa
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(indice.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  fim.writeUInt16LE(0, 20); // sem comentário

  return Buffer.concat([...locais, indice, fim]);
};
