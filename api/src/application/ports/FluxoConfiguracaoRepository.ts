export type EtapaFluxo = {
  ordem: number;
  setorId: string;
  departamentoId?: string;
  prazoDias?: number;
  prazoAtivo: boolean;
  visibilidadeEstendida: boolean;
};

export type ConfiguracaoFluxo = {
  orgaoId: string;
  tipoProcesso: string;
  permiteOverrideUsuario: boolean;
  etapas: EtapaFluxo[];
};

export interface FluxoConfiguracaoRepository {
  salvar(config: ConfiguracaoFluxo): Promise<void>;
  buscar(orgaoId: string, tipoProcesso: string): Promise<ConfiguracaoFluxo | null>;
}
