import { pool, executarEmTransacao } from "./pool";
import type {
  ConfiguracaoFluxo, FluxoConfiguracaoRepository,
} from "../../application/ports/FluxoConfiguracaoRepository";

const SQL = {
  upsertConfig: `
    INSERT INTO fluxo_configuracao (orgao_id, tipo_processo, permite_override_usuario)
    VALUES ($1, $2, $3)
    ON CONFLICT (orgao_id, tipo_processo)
    DO UPDATE SET permite_override_usuario = $3
    RETURNING id`,
  apagarEtapas: `DELETE FROM fluxo_etapa WHERE fluxo_id = $1`,
  inserirEtapa: `
    INSERT INTO fluxo_etapa (fluxo_id, ordem, setor_id, departamento_id,
                             prazo_dias, prazo_ativo, visibilidade_estendida)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  buscarConfig: `
    SELECT id, permite_override_usuario AS "permiteOverrideUsuario"
      FROM fluxo_configuracao
     WHERE orgao_id = $1 AND tipo_processo = $2`,
  buscarEtapas: `
    SELECT ordem, setor_id AS "setorId", departamento_id AS "departamentoId",
           prazo_dias AS "prazoDias", prazo_ativo AS "prazoAtivo",
           visibilidade_estendida AS "visibilidadeEstendida"
      FROM fluxo_etapa
     WHERE fluxo_id = $1
     ORDER BY ordem`,
};

export class PostgresFluxoConfiguracaoRepository implements FluxoConfiguracaoRepository {
  salvar = async (config: ConfiguracaoFluxo): Promise<void> => {
    await executarEmTransacao(async (tx) => {
      const { rows } = await tx.query(SQL.upsertConfig, [
        config.orgaoId, config.tipoProcesso, config.permiteOverrideUsuario,
      ]);
      const fluxoId: string = rows[0].id;
      await tx.query(SQL.apagarEtapas, [fluxoId]);
      for (const etapa of config.etapas) {
        await tx.query(SQL.inserirEtapa, [
          fluxoId, etapa.ordem, etapa.setorId, etapa.departamentoId ?? null,
          etapa.prazoDias ?? null, etapa.prazoAtivo, etapa.visibilidadeEstendida,
        ]);
      }
    });
  };

  buscar = async (orgaoId: string, tipoProcesso: string): Promise<ConfiguracaoFluxo | null> => {
    const { rows } = await pool.query(SQL.buscarConfig, [orgaoId, tipoProcesso]);
    const config = rows[0];
    if (!config) return null;
    const etapas = await pool.query(SQL.buscarEtapas, [config.id]);
    return {
      orgaoId,
      tipoProcesso,
      permiteOverrideUsuario: config.permiteOverrideUsuario,
      etapas: etapas.rows,
    };
  };
}
