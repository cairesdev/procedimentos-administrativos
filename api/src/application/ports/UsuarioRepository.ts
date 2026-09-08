export type UsuarioAutenticavel = {
  id: string;
  orgaoId: string;
  nome: string;
  email: string;
  username: string;
  senhaHash: string;
  papelBase: string;
  ativo: boolean;
};

/**
 * O conselho profissional — o carimbo de quem assina prontuário.
 *
 * Só os papéis clínicos o preenchem, e sem ele o médico e o enfermeiro não
 * fecham bloco nenhum da ficha. Os três campos andam juntos: conselho sem UF
 * não identifica ninguém, porque CRM 1234 existe em 27 estados.
 */
/**
 * Os seis conselhos que o banco aceita desde a 0049.
 *
 * Eram dois, de quando a saúde só conhecia o pronto atendimento. O programa de
 * cuidado continuado trouxe fonoaudiólogo, terapeuta ocupacional, psicólogo e
 * fisioterapeuta — e o `CHECK` da tabela já os aceitava enquanto o tipo aqui
 * ainda dizia que não existiam.
 */
export type TipoDeConselho = "CRM" | "COREN" | "CRFA" | "CREFITO" | "CRP" | "OUTRO";

export type ConselhoProfissional = {
  conselhoTipo?: TipoDeConselho | null;
  conselhoNumero?: string | null;
  conselhoUf?: string | null;
};

export type NovoUsuario = ConselhoProfissional & {
  orgaoId: string;
  nome: string;
  email: string;
  username: string;
  senhaHash: string;
  papelBase: string;
};

export type NovaLotacao = {
  usuarioId: string;
  unidadeId?: string;
  setorId?: string;
  departamentoId?: string;
  /** Escola, creche ou posto: o destino que o almoxarifado usa. */
  localId?: string;
};

export type UsuarioResumo = {
  id: string;
  nome: string;
  email: string;
  papelBase: string;
  ativo: boolean;
  /** Onde a pessoa está lotada hoje, para a tela mostrar antes de trocar. */
  lotacao?: string | null;
  /** O mesmo destino no formato do seletor: `escola:<uuid>`. */
  lotacaoValor?: string | null;
};

// Contexto de atuação: o front usa as lotações para o seletor de
// "atuando como" e envia lotacaoId em toda ação de tramitação.
export type LotacaoDoUsuario = {
  id: string;
  unidadeId: string | null;
  setorId: string | null;
  departamentoId: string | null;
  /** Escola em que a pessoa trabalha; é ela que trava o almoxarifado. */
  localId: string | null;
  /** Tipo do setor (COMPRAS, CONTROLADORIA…); nulo em lotação de unidade. */
  tipoSetor: string | null;
  destino: string;
};

export type PerfilUsuario = UsuarioResumo & {
  orgaoId: string;
  orgaoNome: string;
  username: string;
  lotacoes: LotacaoDoUsuario[];
  modulos: string[];
};

export type EdicaoUsuario = ConselhoProfissional & {
  nome?: string;
  email?: string;
  papelBase?: string;
  senhaHash?: string;
  ativo?: boolean;
};

export interface UsuarioRepository {
  buscarPorIdentificador(identificador: string): Promise<UsuarioAutenticavel | null>;
  existeEmail(email: string): Promise<boolean>;
  existeUsername(username: string): Promise<boolean>;
  criar(dados: NovoUsuario): Promise<string>;
  criarLotacao(dados: NovaLotacao): Promise<string>;
  listar(orgaoId: string): Promise<UsuarioResumo[]>;
  buscarPerfil(usuarioId: string): Promise<PerfilUsuario | null>;
  buscarPorId(orgaoId: string, id: string): Promise<UsuarioResumo | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoUsuario): Promise<void>;
  contarVinculos(id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string): Promise<void>;
  removerLotacoes(usuarioId: string): Promise<void>;
}

export type FluxoEtapaDestino = {
  setorId: string;
  departamentoId: string | null;
};

export interface FluxoRepository {
  primeiraEtapa(orgaoId: string, tipoProcesso: string): Promise<FluxoEtapaDestino | null>;
  permiteOverride(orgaoId: string, tipoProcesso: string): Promise<boolean>;
}
