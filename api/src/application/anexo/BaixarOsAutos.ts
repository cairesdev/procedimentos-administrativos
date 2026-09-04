import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { montarZip, type ArquivoDoPacote } from "../../domain/shared/Zip";
import { pecaEmHtml } from "../../domain/documento/PecaEmHtml";
import type { AnexoRepository, ArmazenamentoArquivos } from "../ports/ArmazenamentoArquivos";
import type { DocumentoRepository } from "../ports/DocumentoRepository";
import type { TramitacaoRepository } from "../ports/TramitacaoRepository";

/**
 * Teto do pacote, em bytes.
 *
 * O zip é montado inteiro na memória antes de descer — dez anexos de cem
 * megabytes cabem no que o sistema aceita hoje, e derrubar a API da prefeitura
 * por causa de um download seria pior que negar o pacote. Acima do teto, a
 * recusa diz o tamanho e manda baixar separado, que continua funcionando.
 */
export const TETO_DO_PACOTE = 200 * 1024 * 1024;

/**
 * Os autos do processo num arquivo só.
 *
 * Quem presta contas ao Tribunal precisa entregar "o processo", e hoje isso é
 * abrir a tela, clicar em cada anexo, clicar em cada peça emitida e torcer para
 * não esquecer nenhuma. O pacote resolve com um clique — e, por trazer as duas
 * coisas, responde à pergunta que a tela separa em duas abas.
 *
 * **As peças emitidas entram como HTML**, e não como PDF. O sistema guarda a
 * peça como HTML congelado na emissão e imprime pelo navegador; gerar PDF no
 * servidor exigiria um Chromium dentro do contêiner — centenas de megabytes e
 * uma superfície de atualização nova — para produzir o mesmo papel que o
 * navegador já produz. O arquivo abre com dois cliques e imprime igual.
 */
export class BaixarOsAutos {
  constructor(
    private readonly anexos: AnexoRepository,
    private readonly documentos: DocumentoRepository,
    private readonly tramitacao: TramitacaoRepository,
    private readonly storage: ArmazenamentoArquivos,
  ) {}

  montar = async (
    orgaoId: string,
    processoId: string,
    baseUrl: string,
  ): Promise<{ nomeArquivo: string; conteudo: Buffer }> => {
    const processo = await this.tramitacao.buscarProcesso(orgaoId, processoId);
    if (!processo) throw new NaoEncontrado("Processo não encontrado");

    const [anexos, emitidos] = await Promise.all([
      this.anexos.listarPorProcesso(processoId),
      this.documentos.listarPorReferencia(orgaoId, processoId),
    ]);

    /**
     * Rascunho fica de fora — segunda tranca.
     *
     * `listarPorReferencia` já filtra por `situacao = 'EMITIDO'` no SQL, então
     * hoje isto não corta nada. Fica porque a consequência de errar aqui é
     * séria: peça não emitida é texto que alguém está escrevendo, e mandá-la
     * dentro dos autos apresentaria como ato o que ninguém assinou. Se um dia
     * a consulta passar a trazer rascunho — para uma tela de edição, por
     * exemplo —, o pacote continua entregando só o que saiu.
     */
    const pecas = emitidos.filter((documento) => documento.situacao === "EMITIDO");

    if (anexos.length === 0 && pecas.length === 0) {
      throw new ErroDeNegocio(
        "Este processo ainda não tem anexos nem peças emitidas para baixar.",
        422,
      );
    }

    const arquivos: ArquivoDoPacote[] = [];
    let total = 0;

    /**
     * Os anexos vêm um a um, e o teto é conferido a cada arquivo.
     *
     * Somar tudo primeiro exigiria uma consulta de tamanho que o armazenamento
     * não dá de graça; parar no meio evita carregar o resto de um pacote que
     * já não vai caber.
     */
    for (const anexo of anexos) {
      const nome = (anexo.arquivo.split("/").pop() ?? "anexo")
        .replace(/^[0-9a-f-]{36}-/i, "");

      /**
       * Arquivo que sumiu do armazenamento não vira "Erro interno".
       *
       * A linha existe no banco e o objeto não — bucket mexido por fora,
       * restauração parcial. Entregar o pacote sem ele seria pior: quem manda
       * os autos ao Tribunal acredita que está completo. Então recusa, e diz
       * qual arquivo faltou, que é o que permite ir procurá-lo.
       */
      let arquivo;
      try {
        arquivo = await this.storage.abrir(anexo.arquivo);
      } catch {
        throw new ErroDeNegocio(
          `O arquivo "${nome}" não foi encontrado no armazenamento, então o pacote `
          + "sairia incompleto. Baixe os demais separadamente e avise o suporte.",
          409,
        );
      }

      total += arquivo.tamanho;
      if (total > TETO_DO_PACOTE) {
        throw new ErroDeNegocio(
          `Os arquivos deste processo passam de ${Math.round(TETO_DO_PACOTE / 1024 / 1024)} MB `
          + "somados, que é o limite do pacote. Baixe os arquivos separadamente.",
          422,
        );
      }

      const pedacos: Buffer[] = [];
      for await (const pedaco of arquivo.fluxo) pedacos.push(pedaco as Buffer);

      arquivos.push({ pasta: "anexos", nome, conteudo: Buffer.concat(pedacos) });
    }

    for (const peca of pecas) {
      arquivos.push({
        pasta: "pecas",
        nome: `${peca.codigo} - ${peca.titulo}.html`,
        conteudo: Buffer.from(pecaEmHtml(peca, baseUrl), "utf8"),
      });
    }

    return {
      nomeArquivo: `processo-${processo.numeroProcessoAdm.replace(/\//g, "-")}.zip`,
      conteudo: montarZip(arquivos),
    };
  };
}
