import { pool } from "./pool";
import type {
  DadosDaUnidadeSaude, UnidadeSaude, UnidadeSaudeRepository,
} from "../../application/ports/UnidadeSaudeRepository";

const COLUNAS = `
  id, nome, codigo_cnes AS "codigoCnes", tipo_unidade AS "tipoUnidade",
  endereco, telefone, cnes_consultado_em AS "cnesConsultadoEm",
  unidade_id AS "unidadeId", ativo`;

const SQL = {
  listar: `
    SELECT ${COLUNAS} FROM unidade_saude
     WHERE orgao_id = $1 AND ($2::boolean IS NOT TRUE OR ativo)
     ORDER BY nome`,

  porId: `
    SELECT ${COLUNAS} FROM unidade_saude
     WHERE orgao_id = $1 AND id = $2`,

  porCnes: `
    SELECT ${COLUNAS} FROM unidade_saude
     WHERE orgao_id = $1 AND codigo_cnes = $2`,

  criar: `
    INSERT INTO unidade_saude
      (orgao_id, nome, codigo_cnes, tipo_unidade, endereco, telefone,
       unidade_id, cnes_consultado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,

  atualizar: `
    UPDATE unidade_saude
       SET nome = $3, codigo_cnes = $4, tipo_unidade = $5, endereco = $6,
           telefone = $7, unidade_id = $8, cnes_consultado_em = $9
     WHERE orgao_id = $1 AND id = $2
    RETURNING id`,
};

export class PostgresUnidadeSaudeRepository implements UnidadeSaudeRepository {
  listar = async (orgaoId: string, apenasAtivas: boolean): Promise<UnidadeSaude[]> => {
    const { rows } = await pool.query(SQL.listar, [orgaoId, apenasAtivas]);
    return rows;
  };

  porId = async (orgaoId: string, id: string): Promise<UnidadeSaude | null> => {
    const { rows } = await pool.query(SQL.porId, [orgaoId, id]);
    return rows[0] ?? null;
  };

  porCnes = async (orgaoId: string, codigoCnes: string): Promise<UnidadeSaude | null> => {
    const { rows } = await pool.query(SQL.porCnes, [orgaoId, codigoCnes]);
    return rows[0] ?? null;
  };

  criar = async (orgaoId: string, dados: DadosDaUnidadeSaude): Promise<string> => {
    const { rows } = await pool.query(SQL.criar, [
      orgaoId,
      dados.nome.trim(),
      dados.codigoCnes ?? null,
      dados.tipoUnidade ?? null,
      dados.endereco ?? null,
      dados.telefone ?? null,
      dados.unidadeId ?? null,
      dados.cnesConsultadoEm ?? null,
    ]);
    return rows[0].id;
  };

  atualizar = async (
    orgaoId: string, id: string, dados: DadosDaUnidadeSaude,
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.atualizar, [
      orgaoId,
      id,
      dados.nome.trim(),
      dados.codigoCnes ?? null,
      dados.tipoUnidade ?? null,
      dados.endereco ?? null,
      dados.telefone ?? null,
      dados.unidadeId ?? null,
      dados.cnesConsultadoEm ?? null,
    ]);
    return rows.length > 0;
  };
}
