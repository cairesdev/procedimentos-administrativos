import { pool } from "./pool";
import type {
  NovoRegistroDeQualidade, QualidadeRepository, RegistroDeQualidade,
} from "../../application/ports/QualidadeRepository";

/**
 * O registro fala de um lote que está em um de dois lugares, e cada lado chega
 * ao órgão por um caminho diferente: o lote do almoxarifado pela remessa, o da
 * unidade pelo local. Um `WHERE id = $1` solitário aqui seria vazamento entre
 * prefeituras.
 */
const SQL = {
  registrar: `
    INSERT INTO qualidade_lote
      (lote_id, estoque_local_id, tipo, observacao, quantidade, usuario_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`,

  listar: `
    SELECT q.id, q.lote_id AS "loteId", q.estoque_local_id AS "estoqueLocalId",
           p.nome AS "produtoNome", p.unidade_medida AS "unidadeMedida",
           coalesce(a.nome, l.nome) AS "ondeEsta",
           q.tipo, q.observacao, q.quantidade, u.nome AS "usuarioNome", q.data
      FROM qualidade_lote q
      JOIN usuario u ON u.id = q.usuario_id
      LEFT JOIN lote lo ON lo.id = q.lote_id
      LEFT JOIN remessa_estoque r ON r.id = lo.remessa_id
      LEFT JOIN almoxarifado a ON a.id = r.almoxarifado_id
      LEFT JOIN estoque_local el ON el.id = q.estoque_local_id
      LEFT JOIN local l ON l.id = el.local_id
      JOIN produto p ON p.id = coalesce(lo.produto_id, el.produto_id)
     WHERE coalesce(a.orgao_id, l.orgao_id) = $1
       AND ($2::uuid IS NULL OR q.lote_id = $2)
       AND ($3::uuid IS NULL OR q.estoque_local_id = $3)
       AND ($4::text IS NULL OR q.tipo = $4)
     ORDER BY q.data DESC, q.id
     LIMIT 200`,

  loteDoOrgao: `
    SELECT 1
      FROM lote lo
      JOIN remessa_estoque r ON r.id = lo.remessa_id
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
     WHERE lo.id = $2 AND a.orgao_id = $1`,

  estoqueDoOrgao: `
    SELECT 1
      FROM estoque_local el
      JOIN local l ON l.id = el.local_id
     WHERE el.id = $2 AND l.orgao_id = $1`,
};

export class PostgresQualidadeRepository implements QualidadeRepository {
  registrar = async (dados: NovoRegistroDeQualidade): Promise<string> => {
    const { rows } = await pool.query(SQL.registrar, [
      dados.loteId ?? null, dados.estoqueLocalId ?? null, dados.tipo,
      dados.observacao.trim(), dados.quantidade ?? null, dados.usuarioId,
    ]);
    return rows[0].id;
  };

  listar = async (
    orgaoId: string,
    filtros: { lote?: string; estoqueLocal?: string; tipo?: string },
  ): Promise<RegistroDeQualidade[]> => {
    const { rows } = await pool.query(SQL.listar, [
      orgaoId, filtros.lote ?? null, filtros.estoqueLocal ?? null, filtros.tipo ?? null,
    ]);
    return rows.map((linha) => ({
      ...linha,
      quantidade: linha.quantidade === null ? null : Number(linha.quantidade),
    }));
  };

  loteDoOrgao = async (
    orgaoId: string,
    loteId?: string,
    estoqueLocalId?: string,
  ): Promise<boolean> => {
    const consulta = loteId ? SQL.loteDoOrgao : SQL.estoqueDoOrgao;
    const { rowCount } = await pool.query(consulta, [orgaoId, loteId ?? estoqueLocalId]);
    return (rowCount ?? 0) > 0;
  };
}
