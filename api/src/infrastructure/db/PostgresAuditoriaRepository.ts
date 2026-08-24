import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina,
} from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  AuditoriaRepository, EventoAuditoria, FiltroAuditoria, RegistroAuditoria,
} from "../../application/ports/AuditoriaRepository";

const SQL = {
  registrar: `
    INSERT INTO auditoria_log (orgao_id, usuario_id, tipo_evento, referencia_id, detalhes)
    VALUES ($1, $2, $3, $4, $5)`,
  listar: `
    SELECT a.id, a.tipo_evento AS "tipoEvento", a.referencia_id AS "referenciaId",
           a.usuario_id AS "usuarioId", u.nome AS "usuarioNome", a.detalhes, a.data,
           ${TOTAL_DA_JANELA}
      FROM auditoria_log a
      LEFT JOIN usuario u ON u.id = a.usuario_id
     WHERE a.orgao_id = $1
       AND ($2::uuid IS NULL OR a.referencia_id = $2)
       AND ($3::text IS NULL OR a.tipo_evento = $3)
       AND ($4::timestamptz IS NULL OR a.data >= $4)
       AND ($5::timestamptz IS NULL OR a.data <= $5)
     ORDER BY a.data DESC, a.id
     LIMIT $6 OFFSET $7`,
};

export class PostgresAuditoriaRepository implements AuditoriaRepository {
  registrar = async (evento: EventoAuditoria, tx?: Tx): Promise<void> => {
    const executor = tx ?? pool;
    await executor.query(SQL.registrar, [
      evento.orgaoId,
      evento.usuarioId ?? null,
      evento.tipoEvento,
      evento.referenciaId ?? null,
      evento.detalhes ? JSON.stringify(evento.detalhes) : null,
    ]);
  };

  listar = async (filtro: FiltroAuditoria): Promise<Pagina<RegistroAuditoria>> => {
    const { rows } = await pool.query(SQL.listar, [
      filtro.orgaoId,
      filtro.referenciaId ?? null,
      filtro.tipoEvento ?? null,
      filtro.desde ?? null,
      filtro.ate ?? null,
      filtro.porPagina,
      deslocamentoDe(filtro),
    ]);
    return montarPagina(rows, filtro);
  };
}
