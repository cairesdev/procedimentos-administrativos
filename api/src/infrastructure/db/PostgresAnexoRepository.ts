import { pool } from "./pool";
import type { AnexoDetalhe, AnexoRepository, NovoAnexo } from "../../application/ports/ArmazenamentoArquivos";

const COLUNAS = `
  a.id, a.processo_id AS "processoId", a.despacho_id AS "despachoId",
  a.tipo_documento AS "tipoDocumento", a.arquivo, a.data`;

const SQL = {
  criar: `
    INSERT INTO anexo (processo_id, despacho_id, tipo_documento, arquivo,
                       enviado_por_usuario_id, enviado_por_requerente_id)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
  listar: `
    SELECT ${COLUNAS} FROM anexo a WHERE a.processo_id = $1 ORDER BY a.data`,
  buscar: `
    SELECT ${COLUNAS}
      FROM anexo a
      JOIN processo p ON p.id = a.processo_id
     WHERE p.orgao_id = $1 AND a.id = $2`,
  remover: `DELETE FROM anexo WHERE id = $1`,
};

export class PostgresAnexoRepository implements AnexoRepository {
  criar = async (dados: NovoAnexo): Promise<string> => {
    const { rows } = await pool.query(SQL.criar, [
      dados.processoId, dados.despachoId ?? null, dados.tipoDocumento, dados.arquivo,
      dados.enviadoPorUsuarioId ?? null, dados.enviadoPorRequerenteId ?? null,
    ]);
    return rows[0].id;
  };

  listarPorProcesso = async (processoId: string): Promise<AnexoDetalhe[]> => {
    const { rows } = await pool.query(SQL.listar, [processoId]);
    return rows;
  };

  buscar = async (orgaoId: string, anexoId: string): Promise<AnexoDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscar, [orgaoId, anexoId]);
    return rows[0] ?? null;
  };

  remover = async (anexoId: string): Promise<void> => {
    await pool.query(SQL.remover, [anexoId]);
  };
}
