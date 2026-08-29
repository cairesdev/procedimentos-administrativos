import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AlmoxarifadoRepository } from "../ports/AlmoxarifadoRepository";
import type {
  ApuracaoDoRelatorio, RelatorioConsumoRepository,
} from "../ports/RelatorioConsumoRepository";

export type NovoRelatorio = {
  orgaoId: string;
  usuarioId: string;
  almoxarifadoId: string;
  tipoEstoqueId?: string;
  periodoInicio: string;
  periodoFim: string;
};

/**
 * O relatório de consumo da alimentação escolar.
 *
 * Guarda o **recorte** — almoxarifado, tipo de estoque e período — e apura os
 * números na hora de ler. O motor de documentos é quem os congela: a peça
 * emitida guarda o retrato em `documento_emitido.dados`, e o relatório aberto
 * continua refletindo o estoque de hoje.
 *
 * Quatro grandezas por unidade, e cada uma vem de uma tabela diferente:
 *
 * - **recebido**: o que a escola confirmou ter recebido (`quantidade_confirmada`
 *   da liberação), não o que o almoxarifado despachou. Contar o despachado
 *   infla o relatório com o que se perdeu no caminho.
 * - **perdido**: `quantidade_perdida`, que sempre tem motivo — o banco recusa
 *   perda sem ele.
 * - **consumido**: o que a unidade declarou usar.
 * - **devolvido**: só devolução **aceita** pelo almoxarifado. Pendente ainda
 *   não voltou ao estoque de ninguém, e recusada nunca voltará.
 */
export class ApurarConsumo {
  constructor(
    private readonly relatorios: RelatorioConsumoRepository,
    private readonly almoxarifado: AlmoxarifadoRepository,
  ) {}

  criar = async (dados: NovoRelatorio): Promise<{ id: string }> => {
    if (dados.periodoFim < dados.periodoInicio) {
      throw new ErroDeNegocio("O fim do período não pode ser antes do começo");
    }

    const almoxarifado = await this.almoxarifado.buscarAlmoxarifado(
      dados.orgaoId, dados.almoxarifadoId,
    );
    if (!almoxarifado) throw new NaoEncontrado("Almoxarifado não encontrado neste órgão");

    const id = await this.relatorios.criar(dados);
    return { id };
  };

  /** Os números do recorte, apurados agora. */
  apurar = async (orgaoId: string, id: string): Promise<ApuracaoDoRelatorio> => {
    const apuracao = await this.relatorios.apurar(orgaoId, id);
    if (!apuracao) throw new NaoEncontrado("Relatório não encontrado");
    return apuracao;
  };

  listar = (orgaoId: string) => this.relatorios.listar(orgaoId);

  excluir = async (orgaoId: string, id: string): Promise<void> => {
    // O relatório é só o recorte: apagá-lo não apaga a peça já emitida, que
    // guarda o próprio retrato e continua conferível pelo código.
    await this.relatorios.excluir(orgaoId, id);
  };
}

/**
 * Percentual de agricultura familiar, em texto pronto para a peça.
 *
 * É por **número de remessas**, não por valor: o almoxarifado registra
 * quantidade e não guarda preço. O modelo diz isso na própria folha, para
 * ninguém apresentar este número como se fosse o percentual financeiro que o
 * FNDE cobra.
 */
export const percentualDeAgriculturaFamiliar = (
  total: number,
  daAgricultura: number,
): string => {
  if (total === 0) return "0%";
  return `${Math.round((daAgricultura / total) * 1000) / 10}%`.replace(".", ",");
};
