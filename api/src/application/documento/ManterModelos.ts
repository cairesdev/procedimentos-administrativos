import {
  CATALOGO_POR_ESCOPO, MODULO_DO_ESCOPO, ehEscopo, tipoAPartirDoNome,
  type EscopoDeDocumento,
} from "../../domain/documento/Catalogo";
import { limparCorpo, tagsRemovidas } from "../../domain/documento/CorpoSeguro";
import { validarContraCatalogo } from "../../domain/documento/Marcadores";
import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { ehTipoDeSetor } from "../../domain/shared/Papeis";
import type { DocumentoRepository, ModeloDeDocumento } from "../ports/DocumentoRepository";

export type DadosDoModelo = {
  nome: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
};

export type NovoModeloPersonalizado = DadosDoModelo & {
  escopo: string;
};

/**
 * Cadastro dos modelos, dos dois lados: o painel do produto mantém os globais,
 * a prefeitura mantém a versão dela e pode criar peças próprias. É o mesmo
 * caso de uso porque a validação é idêntica — o que muda é o dono da linha.
 */
export class ManterModelos {
  constructor(private readonly documentos: DocumentoRepository) {}

  /**
   * Peças que este servidor alcança.
   *
   * `setores` são os tipos de setor da lotação dele. Sem o argumento, a lista
   * vem inteira — é a tela de administração de modelos, que precisa enxergar
   * até a peça restrita para poder editá-la.
   */
  listarParaOrgao = (orgaoId: string, modulo?: string, setores?: string[]) =>
    this.documentos.listarModelosResolvidos(orgaoId, modulo, setores);

  /** Tipos de setor que alcançam uma peça. Vazio = todos. */
  setoresDoModelo = (modeloId: string) => this.documentos.setoresDoModelo(modeloId);

  /**
   * Amarra a peça a setores. Lista vazia devolve a peça a todo mundo.
   *
   * Só a versão da prefeitura pode ser amarrada: mexer no modelo global daqui
   * mudaria a regra de todas as outras prefeituras de uma vez.
   */
  definirSetores = async (
    orgaoId: string,
    tipo: string,
    setores: string[],
  ): Promise<void> => {
    const invalido = setores.find((setor) => !ehTipoDeSetor(setor));
    if (invalido) throw new ErroDeNegocio(`Tipo de setor desconhecido: ${invalido}`);

    const atual = await this.documentos.resolverModelo(orgaoId, tipo);
    if (!atual) throw new NaoEncontrado("Modelo não encontrado");
    if (atual.origem === "GLOBAL") {
      throw new ErroDeNegocio(
        "Este é o modelo padrão do produto. Salve uma versão da prefeitura antes de "
        + "restringir quem a emite.",
      );
    }
    await this.documentos.definirSetoresDoModelo(atual.id, [...new Set(setores)]);
  };

  listarGlobais = () => this.documentos.listarModelosGlobais();

  resolver = async (orgaoId: string, tipo: string) => {
    const modelo = await this.documentos.resolverModelo(orgaoId, tipo);
    if (!modelo) throw new NaoEncontrado("Não há modelo cadastrado para este tipo");
    return modelo;
  };

  /** Marcadores que o modelo pode usar, a partir do escopo dele. */
  catalogoDe = (escopo: string) => {
    if (!ehEscopo(escopo)) throw new ErroDeNegocio(`Escopo desconhecido: ${escopo}`);
    return CATALOGO_POR_ESCOPO[escopo];
  };

  /** Catálogo do tipo já cadastrado — a tela de edição parte daqui. */
  catalogoDoTipo = async (orgaoId: string, tipo: string) => {
    const modelo = await this.resolver(orgaoId, tipo);
    return this.catalogoDe(modelo.escopo);
  };

  salvarGlobal = (tipo: string, dados: DadosDoModelo) => this.editar(null, tipo, dados);

  salvarDaPrefeitura = (orgaoId: string, tipo: string, dados: DadosDoModelo) =>
    this.editar(orgaoId, tipo, dados);

  /**
   * Peça nova, inventada pelo administrador. Nasce sempre como modelo da
   * prefeitura (ou global, se vier do painel do produto) e marcada como
   * personalizada — não existe padrão por trás dela para restaurar.
   */
  criarPersonalizado = async (
    orgaoId: string | null,
    dados: NovoModeloPersonalizado,
  ): Promise<{ id: string; tipo: string }> => {
    const catalogo = this.catalogoDe(dados.escopo);
    // O módulo sai do escopo, não de quem chama. Enquanto todo escopo falava
    // de processo, um default "PROCESSOS" passava despercebido; com patrimônio
    // e frotas ele esconderia a peça nova da tela que deveria oferecê-la, já
    // que o botão de emissão filtra os modelos por módulo.
    const modulo = MODULO_DO_ESCOPO[dados.escopo as EscopoDeDocumento];

    const tipo = tipoAPartirDoNome(dados.nome);
    if (tipo.length < 3) {
      throw new ErroDeNegocio("O nome precisa de ao menos três letras ou números");
    }
    // Vale tanto contra o global quanto contra o da própria prefeitura: dois
    // modelos com o mesmo tipo tornariam a resolução ambígua.
    if (await this.documentos.tipoEmUso(orgaoId, tipo)) {
      throw new Conflito(`Já existe um documento chamado "${dados.nome}"`);
    }

    const corpo = this.corpoValidado(dados.corpo, catalogo);
    return {
      tipo,
      id: await this.documentos.criarModelo({
        orgaoId,
        modulo,
        tipo,
        escopo: dados.escopo,
        nome: dados.nome,
        titulo: dados.titulo,
        corpo,
        ativo: dados.ativo,
        personalizado: true,
      }),
    };
  };

  /**
   * Apagar a linha da prefeitura devolve o tipo ao modelo global — é o
   * "restaurar padrão". Peça personalizada não tem padrão atrás: apagar ali é
   * excluir de vez, e por isso exige o método próprio.
   */
  restaurarPadrao = async (orgaoId: string, tipo: string): Promise<void> => {
    const atual = await this.documentos.resolverModelo(orgaoId, tipo);
    if (!atual || atual.origem === "GLOBAL") {
      throw new ErroDeNegocio("Esta prefeitura já usa o modelo padrão deste documento");
    }
    if (atual.personalizado) {
      throw new ErroDeNegocio(
        "Este documento foi criado por esta prefeitura e não tem modelo padrão — use excluir",
      );
    }
    await this.documentos.removerModelo(atual.id);
  };

  /** Só peça personalizada some de vez; o padrão do produto não se apaga. */
  excluirPersonalizado = async (orgaoId: string, tipo: string): Promise<void> => {
    const atual = await this.documentos.resolverModelo(orgaoId, tipo);
    if (!atual) throw new NaoEncontrado("Modelo não encontrado");
    if (!atual.personalizado || atual.origem === "GLOBAL") {
      throw new ErroDeNegocio(
        "Só documento criado por esta prefeitura pode ser excluído. Para voltar ao texto de "
        + "fábrica, use restaurar padrão; para tirar de circulação, desative o modelo.",
      );
    }
    await this.documentos.removerModelo(atual.id);
  };

  private editar = async (
    orgaoId: string | null,
    tipo: string,
    dados: DadosDoModelo,
  ): Promise<{ id: string }> => {
    const existente = orgaoId ? await this.daPrefeitura(orgaoId, tipo) : await this.global(tipo);

    // Sem linha própria ainda: a prefeitura está personalizando o global, e o
    // escopo tem de vir dele — quem edita não escolhe de onde a peça fala.
    const base = existente ?? (orgaoId ? await this.resolver(orgaoId, tipo) : null);
    if (!base) throw new NaoEncontrado("Não há modelo cadastrado para este tipo");

    const corpo = this.corpoValidado(dados.corpo, this.catalogoDe(base.escopo));

    if (existente) {
      await this.documentos.atualizarModelo(existente.id, { ...dados, corpo });
      return { id: existente.id };
    }
    // Esta linha nasce da personalização de um modelo que já existe, então
    // sempre tem um padrão atrás dela — mesmo quando o global foi uma peça
    // criada pelo painel do produto. Herdar `personalizado` daqui tiraria da
    // prefeitura o "restaurar padrão" e ofereceria "excluir" no lugar.
    return {
      id: await this.documentos.criarModelo({
        orgaoId,
        modulo: base.modulo,
        tipo,
        escopo: base.escopo,
        ...dados,
        corpo,
        personalizado: false,
      }),
    };
  };

  /** Limpa antes de validar: o que o sanitizador tira não pode contar como marcador. */
  private corpoValidado = (
    bruto: string,
    catalogo: { valores: string[]; listas: Record<string, string[]> },
  ): string => {
    const corpo = limparCorpo(bruto);
    if (corpo.trim() === "") throw new ErroDeNegocio("O corpo do modelo está vazio");
    validarContraCatalogo(corpo, catalogo);
    return corpo;
  };

  private daPrefeitura = async (orgaoId: string, tipo: string) => {
    const resolvido = await this.documentos.resolverModelo(orgaoId, tipo);
    return resolvido?.origem === "PREFEITURA" ? resolvido : null;
  };

  private global = async (tipo: string): Promise<ModeloDeDocumento | null> =>
    (await this.documentos.listarModelosGlobais()).find((modelo) => modelo.tipo === tipo) ?? null;

  /** Aviso para a tela: o que o sanitizador removeria deste corpo. */
  avisosDe = (corpo: string): string[] => tagsRemovidas(corpo);
}

export type { EscopoDeDocumento };
