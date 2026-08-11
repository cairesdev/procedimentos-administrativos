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

export type NovoUsuario = {
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
};

export type UsuarioResumo = {
  id: string;
  nome: string;
  email: string;
  papelBase: string;
  ativo: boolean;
};

// Contexto de atuação: o front usa as lotações para o seletor de
// "atuando como" e envia lotacaoId em toda ação de tramitação.
export type LotacaoDoUsuario = {
  id: string;
  unidadeId: string | null;
  setorId: string | null;
  departamentoId: string | null;
  destino: string;
};

export type PerfilUsuario = UsuarioResumo & {
  orgaoId: string;
  orgaoNome: string;
  username: string;
  lotacoes: LotacaoDoUsuario[];
  modulos: string[];
};

export type EdicaoUsuario = {
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
