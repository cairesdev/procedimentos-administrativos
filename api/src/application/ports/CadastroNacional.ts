/**
 * O CNES, visto de dentro do sistema.
 *
 * Port estreito de propósito: só o que o cadastro da unidade precisa. A API
 * aberta do Ministério tem noventa rotas e nenhuma delas devolve profissional
 * (ver `docs/integracao-cnes.md`); trazer mais para cá seria trazer superfície
 * que ninguém usa.
 *
 * **Toda operação pode falhar, e falhar é normal.** O serviço é do Ministério,
 * não nosso. Quem chama trata a falha como "não deu para consultar agora" e
 * segue com o cadastro digitado — nenhum atendimento depende disto.
 */

export type EstabelecimentoDoCnes = {
  codigoCnes: string;
  nome: string;
  /** 5 = HOSPITAL GERAL, 2 = UBS, 1 = POSTO DE SAÚDE. */
  tipoUnidade: number | null;
  tipoUnidadeDescricao: string | null;
  endereco: string | null;
  telefone: string | null;
  municipio: number | null;
};

export type MunicipioDoSus = {
  codigo: string;
  nome: string;
  uf: string;
};

export interface CadastroNacional {
  /** Descobre o código IBGE de 6 dígitos a partir do nome do município. */
  municipiosPorNome(nome: string): Promise<MunicipioDoSus[]>;

  /** Os estabelecimentos de um município — é assim que se acha o hospital. */
  estabelecimentosDoMunicipio(codigoMunicipio: string): Promise<EstabelecimentoDoCnes[]>;

  /** Um estabelecimento, pelo código CNES. */
  estabelecimento(codigoCnes: string): Promise<EstabelecimentoDoCnes | null>;
}
