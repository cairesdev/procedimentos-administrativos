export type Vehicle = {
  id: string;
  placa: string;
  modelo: string;
  ano: number | null;
  tipo: string | null;
  unidadeId: string | null;
  quilometragemAtual: number;
  ativo: boolean;
  /** Manutenção em aberto: o veículo não pode sair. */
  emManutencao: boolean;
  viagens: number;
};

export type Driver = {
  id: string;
  nome: string;
  cnh: string;
  categoriaCnh: string;
  validadeCnh: string;
  usuarioId: string | null;
  ativo: boolean;
  /** Negativo = CNH vencida. */
  diasParaVencerCnh: number;
  viagens: number;
};

export type TripStatus =
  | "SOLICITADA"
  | "APROVADA"
  | "RECUSADA"
  | "REMARCADA"
  | "RETIRADA"
  | "FINALIZADA"
  | "CANCELADA";

export type Trip = {
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
  status: TripStatus;
  createdAt: string;
};

export type TripDetail = Trip & {
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

export type Maintenance = {
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

export type Refuel = {
  id: string;
  viagemId: string;
  data: string;
  litros: number | null;
  valor: number | null;
};

/** Uma linha por veículo; o veículo sem viagem na semana também aparece. */
export type ScheduleRow = {
  veiculoId: string;
  placa: string;
  modelo: string;
  emManutencao: boolean;
  ativo: boolean;
  viagens: Trip[];
};

export type UsageRow = {
  veiculoId: string;
  placa: string;
  modelo: string;
  viagensFinalizadas: number;
  kmRodado: number;
  litros: number;
  valorCombustivel: number;
  custoManutencao: number;
};

export const TRIP_STATUSES: { value: TripStatus; label: string }[] = [
  { value: "SOLICITADA", label: "Solicitada" },
  { value: "REMARCADA", label: "Remarcada" },
  { value: "APROVADA", label: "Aprovada" },
  { value: "RETIRADA", label: "Em viagem" },
  { value: "FINALIZADA", label: "Finalizada" },
  { value: "RECUSADA", label: "Recusada" },
  { value: "CANCELADA", label: "Cancelada" },
];

export const CNH_CATEGORIES = ["A", "B", "AB", "C", "D", "E"];

// Espelha as transições da API; a tela só oferece o que o ciclo aceita.
export const NEXT_ACTIONS: Record<TripStatus, string[]> = {
  SOLICITADA: ["aprovar", "recusar", "remarcar", "cancelar"],
  REMARCADA: ["aprovar", "recusar", "cancelar"],
  APROVADA: ["retirada", "cancelar"],
  RETIRADA: ["finalizar"],
  FINALIZADA: [],
  RECUSADA: [],
  CANCELADA: [],
};
