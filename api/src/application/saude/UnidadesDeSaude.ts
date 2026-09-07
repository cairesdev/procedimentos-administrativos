import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type {
  CadastroNacional, EstabelecimentoDoCnes, MunicipioDoSus,
} from "../ports/CadastroNacional";
import type {
  DadosDaUnidadeSaude, UnidadeSaude, UnidadeSaudeRepository,
} from "../ports/UnidadeSaudeRepository";

/**
 * O cadastro dos estabelecimentos — hospital, UBS, posto.
 *
 * A consulta ao CNES entra aqui e **em nenhum outro lugar do módulo**. É o
 * único ponto do sistema que fala com o Ministério, e é uma tela de cadastro,
 * feita uma vez por unidade: nenhum atendimento espera por rede externa.
 *
 * Quando o serviço não responde, o cadastro continua funcionando com tudo
 * digitado. Um hospital de plantão 24 horas não pode depender de a rede do
 * Ministério estar de pé — e a alternativa "não cadastra" seria pior que a
 * ausência da integração.
 */
export class UnidadesDeSaude {
  constructor(
    private readonly unidades: UnidadeSaudeRepository,
    private readonly cnes: CadastroNacional,
  ) {}

  listar = (orgaoId: string, apenasAtivas = false): Promise<UnidadeSaude[]> =>
    this.unidades.listar(orgaoId, apenasAtivas);

  ver = async (orgaoId: string, id: string): Promise<UnidadeSaude> => {
    const unidade = await this.unidades.porId(orgaoId, id);
    if (!unidade) throw new NaoEncontrado("Unidade de saúde não encontrada");
    return unidade;
  };

  criar = async (orgaoId: string, dados: DadosDaUnidadeSaude): Promise<{ id: string }> => {
    if (!dados.nome?.trim()) throw new ErroDeNegocio("Informe o nome da unidade");
    await this.garantirCnesLivre(orgaoId, dados.codigoCnes, null);
    return { id: await this.unidades.criar(orgaoId, dados) };
  };

  atualizar = async (
    orgaoId: string, id: string, dados: DadosDaUnidadeSaude,
  ): Promise<void> => {
    await this.garantirCnesLivre(orgaoId, dados.codigoCnes, id);
    const mudou = await this.unidades.atualizar(orgaoId, id, dados);
    if (!mudou) throw new NaoEncontrado("Unidade de saúde não encontrada");
  };

  private garantirCnesLivre = async (
    orgaoId: string, codigoCnes: string | null | undefined, proprioId: string | null,
  ): Promise<void> => {
    if (!codigoCnes) return;
    const ocupado = await this.unidades.porCnes(orgaoId, codigoCnes);
    if (ocupado && ocupado.id !== proprioId) {
      /**
       * Dois cadastros do mesmo CNES partiriam a série histórica em duas: o
       * relatório de um ano diria metade dos atendimentos, e ninguém
       * desconfiaria — o número simplesmente pareceria baixo.
       */
      throw new Conflito(
        `O CNES ${codigoCnes} já está cadastrado como "${ocupado.nome}".`,
        { unidadeSaudeId: ocupado.id },
      );
    }
  };

  // --- A ponte com o cadastro nacional ---

  /**
   * A API aberta não busca estabelecimento por nome — só por município.
   *
   * Por isso o fluxo da tela é município → lista → escolhe, e não "digite o
   * nome do hospital". A limitação é do serviço, e desenhar a tela contra ela
   * é mais honesto que fingir uma busca que filtraria no cliente.
   */
  municipios = (nome: string): Promise<MunicipioDoSus[]> => {
    if (nome.trim().length < 3) return Promise.resolve([]);
    return this.cnes.municipiosPorNome(nome.trim());
  };

  estabelecimentosDoMunicipio = (
    codigoMunicipio: string,
  ): Promise<EstabelecimentoDoCnes[]> =>
    this.cnes.estabelecimentosDoMunicipio(codigoMunicipio);

  /**
   * Puxa um estabelecimento do CNES para virar cadastro.
   *
   * Devolve os dados **sem gravar**: quem confirma é o administrador, olhando
   * o que veio. O nome no CNES às vezes diverge do que a prefeitura usa no
   * timbre, e sobrescrever calado trocaria o nome do hospital na ficha
   * impressa sem ninguém pedir.
   */
  consultarCnes = async (codigoCnes: string): Promise<EstabelecimentoDoCnes> => {
    if (!/^\d{1,7}$/.test(codigoCnes)) {
      throw new ErroDeNegocio("O código CNES tem até sete dígitos");
    }
    const encontrado = await this.cnes.estabelecimento(codigoCnes);
    if (!encontrado) {
      throw new NaoEncontrado(
        "Não foi possível consultar este CNES agora. Confira o código, ou "
        + "cadastre a unidade à mão — o serviço do Ministério pode estar fora do ar.",
      );
    }
    return encontrado;
  };
}
