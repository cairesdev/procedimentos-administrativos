export type NovoVeiculo = {
  orgaoId: string;
  unidadeId?: string;
  placa: string;
  modelo: string;
  ano?: number;
  tipo?: string;
};

export type VeiculoResumo = {
  id: string;
  placa: string;
  modelo: string;
  ano: number | null;
  tipo: string | null;
  unidadeId: string | null;
  quilometragemAtual: number;
  ativo: boolean;
  /** Manutenção sem data_fim: o veículo não pode sair. */
  emManutencao: boolean;
  viagens: number;
};

export type EdicaoVeiculo = {
  modelo?: string;
  ano?: number | null;
  tipo?: string | null;
  unidadeId?: string | null;
  ativo?: boolean;
};

export type NovoMotorista = {
  orgaoId: string;
  usuarioId?: string;
  nome: string;
  cnh: string;
  categoriaCnh: string;
  validadeCnh: string;
};

export type MotoristaResumo = {
  id: string;
  nome: string;
  cnh: string;
  categoriaCnh: string;
  validadeCnh: string;
  usuarioId: string | null;
  ativo: boolean;
  /** Dias até o vencimento da CNH; negativo = vencida. */
  diasParaVencerCnh: number;
  viagens: number;
};

export type EdicaoMotorista = {
  nome?: string;
  cnh?: string;
  categoriaCnh?: string;
  validadeCnh?: string;
  usuarioId?: string | null;
  ativo?: boolean;
};

export type StatusViagem =
  | "SOLICITADA"
  | "APROVADA"
  | "RECUSADA"
  | "REMARCADA"
  | "RETIRADA"
  | "FINALIZADA"
  | "CANCELADA";

export type NovaViagem = {
  orgaoId: string;
  unidadeSolicitanteId: string;
  veiculoId: string;
  motoristaId: string;
  dataHoraDesejada: string;
  motivo: string;
  responsavel: string;
};

export type ViagemResumo = {
  id: string;
  unidadeSolicitanteId: string;
  unidadeSolicitanteNome: string;
  veiculoId: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  motoristaId: string;
  motoristaNome: string;
  dataHoraDesejada: string;
  dataHoraRemarcada: string | null;
  motivo: string;
  responsavel: string;
  status: StatusViagem;
  createdAt: string;
};

export type ViagemDetalhe = ViagemResumo & {
  retirada: {
    kmInicial: number;
    dataHora: string;
    motoristaId: string;
    motoristaNome: string;
    notaCombustivelTipo: "LITRO" | "VALOR" | null;
    notaCombustivelQuantidade: number | null;
  } | null;
  finalizacao: {
    dataHora: string;
    kmFinal: number;
    sinistro: string | null;
  } | null;
};

export type DadosRetirada = {
  kmInicial: number;
  dataHora: string;
  motoristaId: string;
  notaCombustivelTipo?: "LITRO" | "VALOR";
  notaCombustivelQuantidade?: number;
};

export type DadosFinalizacao = {
  dataHora: string;
  kmFinal: number;
  sinistro?: string;
};

export type NovoAbastecimento = {
  viagemId: string;
  data: string;
  litros?: number;
  valor?: number;
};

export type AbastecimentoResumo = {
  id: string;
  viagemId: string;
  data: string;
  litros: number | null;
  valor: number | null;
};

/** Uma linha por veículo, com as viagens da semana já agrupadas por dia. */
export type LinhaDaAgenda = {
  veiculoId: string;
  placa: string;
  modelo: string;
  emManutencao: boolean;
  ativo: boolean;
  viagens: ViagemResumo[];
};

export type LinhaDoRelatorio = {
  veiculoId: string;
  placa: string;
  modelo: string;
  viagensFinalizadas: number;
  kmRodado: number;
  litros: number;
  valorCombustivel: number;
  custoManutencao: number;
};

export type NovaManutencao = {
  veiculoId: string;
  tipo: "PREVENTIVA" | "CORRETIVA";
  dataInicio: string;
  descricao?: string;
  oficina?: string;
  custo?: number;
};

export type ManutencaoResumo = {
  id: string;
  veiculoId: string;
  veiculoPlaca: string;
  tipo: "PREVENTIVA" | "CORRETIVA";
  dataInicio: string;
  dataFim: string | null;
  descricao: string | null;
  oficina: string | null;
  custo: number | null;
};

export type EncerramentoManutencao = {
  dataFim: string;
  custo?: number;
  descricao?: string;
};

export interface FrotaRepository {
  compartilhaEntreSecretarias(orgaoId: string): Promise<boolean>;

  listarVeiculos(orgaoId: string): Promise<VeiculoResumo[]>;
  buscarVeiculo(orgaoId: string, id: string): Promise<VeiculoResumo | null>;
  existePlaca(orgaoId: string, placa: string, ignorarId?: string): Promise<boolean>;
  criarVeiculo(dados: NovoVeiculo): Promise<string>;
  atualizarVeiculo(orgaoId: string, id: string, dados: EdicaoVeiculo): Promise<void>;
  removerVeiculo(orgaoId: string, id: string): Promise<void>;

  listarMotoristas(orgaoId: string): Promise<MotoristaResumo[]>;
  buscarMotorista(orgaoId: string, id: string): Promise<MotoristaResumo | null>;
  criarMotorista(dados: NovoMotorista): Promise<string>;
  atualizarMotorista(orgaoId: string, id: string, dados: EdicaoMotorista): Promise<void>;
  removerMotorista(orgaoId: string, id: string): Promise<void>;

  listarViagens(
    orgaoId: string,
    filtros: { status?: string; veiculoId?: string; de?: string; ate?: string },
  ): Promise<ViagemResumo[]>;
  buscarViagem(orgaoId: string, id: string): Promise<ViagemDetalhe | null>;
  criarViagem(dados: NovaViagem): Promise<string>;
  /** Viagens do mesmo veículo que se cruzam com o horário — só para avisar. */
  conflitosDeAgenda(
    orgaoId: string,
    veiculoId: string,
    dataHora: string,
    ignorarViagemId?: string,
  ): Promise<ViagemResumo[]>;
  mudarStatusViagem(
    orgaoId: string,
    id: string,
    status: StatusViagem,
    dataHoraRemarcada?: string,
  ): Promise<void>;
  registrarRetirada(viagemId: string, dados: DadosRetirada): Promise<void>;
  registrarFinalizacao(
    orgaoId: string,
    viagemId: string,
    veiculoId: string,
    dados: DadosFinalizacao,
  ): Promise<void>;

  listarAbastecimentos(orgaoId: string, viagemId: string): Promise<AbastecimentoResumo[]>;
  buscarAbastecimento(orgaoId: string, id: string): Promise<AbastecimentoResumo | null>;
  registrarAbastecimento(dados: NovoAbastecimento): Promise<string>;
  removerAbastecimento(id: string): Promise<void>;

  /** Agenda da semana: todo veículo aparece, mesmo sem viagem. */
  agenda(orgaoId: string, de: string, ate: string): Promise<LinhaDaAgenda[]>;
  relatorioDeUso(orgaoId: string, de: string, ate: string): Promise<LinhaDoRelatorio[]>;

  listarManutencoes(
    orgaoId: string,
    filtros: { veiculoId?: string; abertas?: boolean },
  ): Promise<ManutencaoResumo[]>;
  buscarManutencao(orgaoId: string, id: string): Promise<ManutencaoResumo | null>;
  abrirManutencao(dados: NovaManutencao): Promise<string>;
  encerrarManutencao(id: string, dados: EncerramentoManutencao): Promise<void>;
  removerManutencao(id: string): Promise<void>;
}
