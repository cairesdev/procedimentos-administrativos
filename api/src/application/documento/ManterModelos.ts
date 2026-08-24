import { CATALOGO_POR_TIPO, MODULO_DO_TIPO, type TipoDeDocumento } from "../../domain/documento/Catalogo";
import { limparCorpo, tagsRemovidas } from "../../domain/documento/CorpoSeguro";
import { validarContraCatalogo } from "../../domain/documento/Marcadores";
import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { DocumentoRepository, ModeloDeDocumento } from "../ports/DocumentoRepository";

export type DadosDoModelo = {
  nome: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
};

/**
 * Cadastro dos modelos, dos dois lados: o painel do produto mantém os globais,
 * a prefeitura mantém a versão dela. É o mesmo caso de uso porque a validação
 * é idêntica — o que muda é só quem é o dono da linha.
 */
export class ManterModelos {
  constructor(private readonly documentos: DocumentoRepository) {}

  listarParaOrgao = (orgaoId: string, modulo?: string) =>
    this.documentos.listarModelosResolvidos(orgaoId, modulo);

  listarGlobais = () => this.documentos.listarModelosGlobais();

  /** Modelo global de um tipo, para a tela de edição partir dele. */
  resolver = async (orgaoId: string, tipo: string) => {
    const modelo = await this.documentos.resolverModelo(orgaoId, tipo);
    if (!modelo) throw new NaoEncontrado("Não há modelo cadastrado para este tipo");
    return modelo;
  };

  salvarGlobal = async (tipo: string, dados: DadosDoModelo): Promise<{ id: string }> =>
    this.salvar(null, tipo, dados);

  salvarDaPrefeitura = async (
    orgaoId: string,
    tipo: string,
    dados: DadosDoModelo,
  ): Promise<{ id: string }> => this.salvar(orgaoId, tipo, dados);

  /**
   * Apagar a linha da prefeitura devolve o tipo ao modelo global — é o
   * "restaurar padrão". Modelo global não se apaga: o tipo ficaria sem nenhum
   * modelo e a emissão pararia para todo mundo.
   */
  restaurarPadrao = async (orgaoId: string, tipo: string): Promise<void> => {
    const atual = await this.documentos.resolverModelo(orgaoId, tipo);
    if (!atual || atual.origem === "GLOBAL") {
      throw new ErroDeNegocio("Esta prefeitura já usa o modelo padrão deste documento");
    }
    await this.documentos.removerModelo(atual.id);
  };

  private salvar = async (
    orgaoId: string | null,
    tipo: string,
    dados: DadosDoModelo,
  ): Promise<{ id: string }> => {
    const catalogo = CATALOGO_POR_TIPO[tipo as TipoDeDocumento];
    if (!catalogo) throw new ErroDeNegocio(`Tipo de documento desconhecido: ${tipo}`);

    // Limpa antes de validar: o que o sanitizador tira não pode contar como
    // marcador válido nem sobreviver escondido no corpo salvo.
    const corpo = limparCorpo(dados.corpo);
    if (corpo.trim() === "") throw new ErroDeNegocio("O corpo do modelo está vazio");
    validarContraCatalogo(corpo, catalogo);

    const existente = orgaoId
      ? await this.daPrefeitura(orgaoId, tipo)
      : await this.global(tipo);

    if (existente) {
      await this.documentos.atualizarModelo(existente.id, { ...dados, corpo });
      return { id: existente.id };
    }
    return {
      id: await this.documentos.criarModelo({
        orgaoId,
        modulo: MODULO_DO_TIPO[tipo as TipoDeDocumento]!,
        tipo,
        ...dados,
        corpo,
      }),
    };
  };

  /** Só a linha da própria prefeitura — a global não pode ser sobrescrita por ela. */
  private daPrefeitura = async (orgaoId: string, tipo: string) => {
    const resolvido = await this.documentos.resolverModelo(orgaoId, tipo);
    return resolvido?.origem === "PREFEITURA" ? resolvido : null;
  };

  private global = async (tipo: string): Promise<ModeloDeDocumento | null> =>
    (await this.documentos.listarModelosGlobais()).find((modelo) => modelo.tipo === tipo) ?? null;

  /** Aviso para a tela: o que o sanitizador removeria deste corpo. */
  avisosDe = (corpo: string): string[] => tagsRemovidas(corpo);
}
