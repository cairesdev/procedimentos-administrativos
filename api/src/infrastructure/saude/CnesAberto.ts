import type {
  CadastroNacional, EstabelecimentoDoCnes, MunicipioDoSus,
} from "../../application/ports/CadastroNacional";

/**
 * A API de Dados Abertos do SUS (DEMAS).
 *
 * `https://apidadosabertos.saude.gov.br` — sem autenticação, sem cadastro,
 * JSON. Verificada contra o serviço real em 07/09/2026; os campos abaixo são
 * os que ela devolve de verdade, não os que a documentação promete.
 *
 * **Limites que importam** e que moldaram este arquivo: não há busca por nome
 * de estabelecimento nem filtro por CNPJ — só por município, UF e tipo. Por
 * isso o fluxo da tela é "município → lista → escolhe", e não "digite o nome
 * do hospital".
 *
 * **Não existe endpoint de profissional aqui.** Ele só existe no barramento
 * SOAP, que é outro serviço e outra fatia (`docs/integracao-cnes.md`).
 */

const BASE = "https://apidadosabertos.saude.gov.br";

/**
 * Cinco segundos, e nem um a mais.
 *
 * Isto é chamado de uma tela de cadastro, com alguém esperando. Um serviço do
 * Ministério fora do ar não pode virar uma aba pendurada: a tela precisa dizer
 * "não deu para consultar agora, preencha à mão" enquanto a pessoa ainda está
 * olhando.
 */
const TEMPO_LIMITE_MS = 5_000;

const buscar = async <T>(caminho: string): Promise<T | null> => {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(`${BASE}${caminho}`, {
      signal: controle.signal,
      headers: { Accept: "application/json" },
    });
    if (!resposta.ok) return null;
    return await resposta.json() as T;
  } catch {
    // Rede fora, DNS falhando, serviço em manutenção: tudo vira "não deu".
    // Quem chama trata a ausência; nenhum atendimento depende disto.
    return null;
  } finally {
    clearTimeout(relogio);
  }
};

type EstabelecimentoBruto = {
  codigo_cnes: number;
  nome_fantasia: string | null;
  nome_razao_social: string | null;
  codigo_tipo_unidade: number | null;
  endereco_estabelecimento: string | null;
  numero_estabelecimento: string | null;
  bairro_estabelecimento: string | null;
  numero_telefone_estabelecimento: string | null;
  codigo_municipio: number | null;
};

const enderecoDe = (bruto: EstabelecimentoBruto): string | null => {
  const partes = [
    bruto.endereco_estabelecimento,
    bruto.numero_estabelecimento,
    bruto.bairro_estabelecimento,
  ].filter((parte) => parte && parte.trim());
  return partes.length > 0 ? partes.join(", ") : null;
};

const traduzir = (bruto: EstabelecimentoBruto): EstabelecimentoDoCnes => ({
  // O código vem numérico e perde o zero à esquerda; o CNES tem sete dígitos.
  codigoCnes: String(bruto.codigo_cnes).padStart(7, "0"),
  nome: bruto.nome_fantasia?.trim() || bruto.nome_razao_social?.trim() || "Sem nome",
  tipoUnidade: bruto.codigo_tipo_unidade,
  tipoUnidadeDescricao: null,
  endereco: enderecoDe(bruto),
  telefone: bruto.numero_telefone_estabelecimento?.trim() || null,
  municipio: bruto.codigo_municipio,
});

export class CnesAberto implements CadastroNacional {
  municipiosPorNome = async (nome: string): Promise<MunicipioDoSus[]> => {
    const dados = await buscar<{
      macrorregiao_regiao_saude_municipios: {
        codigo_municipio: string; municipio: string; uf: string;
      }[];
    }>(`/macrorregiao-e-regiao-de-saude/municipio?municipio=${encodeURIComponent(nome)}`);

    return (dados?.macrorregiao_regiao_saude_municipios ?? []).map((linha) => ({
      codigo: linha.codigo_municipio,
      // Vem como "MA - BELA VISTA DO MARANHAO"; a sigla já está no campo `uf`.
      nome: linha.municipio.replace(/^[A-Z]{2}\s*-\s*/, ""),
      uf: linha.uf,
    }));
  };

  estabelecimentosDoMunicipio = async (
    codigoMunicipio: string,
  ): Promise<EstabelecimentoDoCnes[]> => {
    const dados = await buscar<{ estabelecimentos: EstabelecimentoBruto[] }>(
      `/cnes/estabelecimentos?codigo_municipio=${encodeURIComponent(codigoMunicipio)}&limit=200`,
    );
    if (!dados?.estabelecimentos) return [];

    const tipos = await this.tipos();
    return dados.estabelecimentos.map((bruto) => {
      const traduzido = traduzir(bruto);
      return {
        ...traduzido,
        tipoUnidadeDescricao: traduzido.tipoUnidade === null
          ? null
          : tipos.get(traduzido.tipoUnidade) ?? null,
      };
    });
  };

  estabelecimento = async (codigoCnes: string): Promise<EstabelecimentoDoCnes | null> => {
    const bruto = await buscar<EstabelecimentoBruto>(
      `/cnes/estabelecimentos/${encodeURIComponent(String(Number(codigoCnes)))}`,
    );
    if (!bruto?.codigo_cnes) return null;

    const traduzido = traduzir(bruto);
    const tipos = await this.tipos();
    return {
      ...traduzido,
      tipoUnidadeDescricao: traduzido.tipoUnidade === null
        ? null
        : tipos.get(traduzido.tipoUnidade) ?? null,
    };
  };

  /**
   * O dicionário de tipos, guardado em memória depois da primeira consulta.
   *
   * São umas dezenas de linhas que não mudam de mês para mês, e a lista de
   * estabelecimentos precisa delas para escrever "Hospital geral" em vez de
   * "5". Buscar de novo a cada tela seria uma chamada externa para traduzir um
   * número.
   */
  private cacheDeTipos: Map<number, string> | null = null;

  private tipos = async (): Promise<Map<number, string>> => {
    if (this.cacheDeTipos) return this.cacheDeTipos;

    // A chave é `tipos_unidade`, no singular — conferida contra o serviço, não
    // deduzida do nome da rota, que é `tipounidades`.
    const dados = await buscar<{
      tipos_unidade?: { codigo_tipo_unidade: number; descricao_tipo_unidade: string }[];
    }>("/cnes/tipounidades");

    const mapa = new Map<number, string>();
    for (const tipo of dados?.tipos_unidade ?? []) {
      mapa.set(tipo.codigo_tipo_unidade, tipo.descricao_tipo_unidade);
    }
    // Só guarda se veio alguma coisa: cachear vazio esconderia a falha para
    // sempre, e a próxima tela não teria como se recuperar.
    if (mapa.size > 0) this.cacheDeTipos = mapa;
    return mapa;
  };
}
