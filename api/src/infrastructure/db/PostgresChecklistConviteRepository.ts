import { pool } from "./pool";
import type {
  ChecklistConviteRepository, ConviteDeChecklist,
} from "../../application/ports/ChecklistConviteRepository";

const SQL = {
  criar: `
    INSERT INTO checklist_convite
      (checklist_id, token_hash, destinatario, criado_por, expira_em)
    VALUES ($1, $2, $3, $4, $5) RETURNING id`,

  /**
   * O órgão vem pelo checklist, e não guardado no convite.
   *
   * Duas cópias do mesmo vínculo divergiriam no dia em que uma fosse
   * atualizada e a outra não — e é este `orgaoId` que trava tudo que a página
   * pública alcança depois.
   */
  buscarPorHash: `
    SELECT cv.id, cv.checklist_id AS "checklistId",
           ck.orgao_id AS "orgaoId", o.nome AS "orgaoNome",
           cv.expira_em AS "expiraEm", cv.revogado_em AS "revogadoEm"
      FROM checklist_convite cv
      JOIN checklist ck ON ck.id = cv.checklist_id
      JOIN orgao o ON o.id = ck.orgao_id
     WHERE cv.token_hash = $1`,

  buscarAberto: `
    SELECT expira_em AS "expiraEm", destinatario, criado_em AS "criadoEm"
      FROM checklist_convite
     WHERE checklist_id = $1 AND revogado_em IS NULL
     ORDER BY criado_em DESC
     LIMIT 1`,

  revogarAbertos: `
    UPDATE checklist_convite SET revogado_em = now()
     WHERE checklist_id = $1 AND revogado_em IS NULL`,

  registrarUso: `UPDATE checklist_convite SET usado_em = now() WHERE id = $1`,

  itemEhDoFornecedor: `
    SELECT 1 FROM checklist_item WHERE id = $1 AND para_fornecedor`,

  cicloPertenceAoChecklist: `
    SELECT 1
      FROM checklist_item_cumprimento cu
      JOIN checklist_item i ON i.id = cu.item_id
     WHERE cu.id = $2 AND i.checklist_id = $1 AND i.para_fornecedor`,
};

export class PostgresChecklistConviteRepository implements ChecklistConviteRepository {
  criar = async (dados: {
    checklistId: string; tokenHash: string; destinatario: string | null;
    criadoPor: string; expiraEm: string;
  }): Promise<string> => {
    const { rows } = await pool.query(SQL.criar, [
      dados.checklistId, dados.tokenHash, dados.destinatario,
      dados.criadoPor, dados.expiraEm,
    ]);
    return rows[0].id as string;
  };

  buscarPorHash = async (tokenHash: string): Promise<ConviteDeChecklist | null> => {
    const { rows } = await pool.query(SQL.buscarPorHash, [tokenHash]);
    return (rows[0] as ConviteDeChecklist) ?? null;
  };

  buscarAberto = async (checklistId: string) => {
    const { rows } = await pool.query(SQL.buscarAberto, [checklistId]);
    return (rows[0] as {
      expiraEm: string; destinatario: string | null; criadoEm: string;
    }) ?? null;
  };

  revogarAbertos = async (checklistId: string): Promise<void> => {
    await pool.query(SQL.revogarAbertos, [checklistId]);
  };

  registrarUso = async (conviteId: string): Promise<void> => {
    await pool.query(SQL.registrarUso, [conviteId]);
  };

  itemEhDoFornecedor = async (itemId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.itemEhDoFornecedor, [itemId]);
    return (rowCount ?? 0) > 0;
  };

  cicloPertenceAoChecklist = async (
    checklistId: string, cumprimentoId: string,
  ): Promise<boolean> => {
    const { rowCount } = await pool.query(
      SQL.cicloPertenceAoChecklist, [checklistId, cumprimentoId],
    );
    return (rowCount ?? 0) > 0;
  };
}
