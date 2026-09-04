import { pool } from "./pool";
import type { Tx } from "../../application/ports/Transacao";
import type {
  ConviteDeFornecedor, FornecedorConviteRepository, NovoConvite,
} from "../../application/ports/FornecedorConviteRepository";

const COLUNAS = `
  c.id, c.fornecedor_id AS "fornecedorId", c.orgao_id AS "orgaoId",
  o.nome AS "orgaoNome", c.expira_em AS "expiraEm", c.usado_em AS "usadoEm",
  c.revogado_em AS "revogadoEm", c.criado_em AS "criadoEm"`;

const SQL = {
  criar: `
    INSERT INTO fornecedor_convite
      (fornecedor_id, orgao_id, criado_por, token_hash, expira_em)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id`,

  // Sem filtro de órgão: a página é pública e o token é a credencial. O órgão
  // sai da própria linha, para a auditoria saber a quem a alteração pertence.
  buscarPorHash: `
    SELECT ${COLUNAS}
      FROM fornecedor_convite c
      JOIN orgao o ON o.id = c.orgao_id
     WHERE c.token_hash = $1`,

  buscarAberto: `
    SELECT ${COLUNAS}
      FROM fornecedor_convite c
      JOIN orgao o ON o.id = c.orgao_id
     WHERE c.fornecedor_id = $1 AND c.orgao_id = $2 AND c.revogado_em IS NULL`,

  registrarUso: `UPDATE fornecedor_convite SET usado_em = now() WHERE id = $1`,

  revogarAbertos: `
    UPDATE fornecedor_convite SET revogado_em = now()
     WHERE fornecedor_id = $1 AND orgao_id = $2 AND revogado_em IS NULL`,
};

export class PostgresFornecedorConviteRepository implements FornecedorConviteRepository {
  criar = async (dados: NovoConvite, tx?: Tx): Promise<string> => {
    // Recebe a transação porque o e-mail do convite entra junto: e-mail sem
    // convite avisaria de um link que não existe.
    const { rows } = await (tx ?? pool).query(SQL.criar, [
      dados.fornecedorId, dados.orgaoId, dados.criadoPor, dados.tokenHash, dados.expiraEm,
    ]);
    return rows[0].id;
  };

  buscarPorHash = async (tokenHash: string): Promise<ConviteDeFornecedor | null> => {
    const { rows } = await pool.query(SQL.buscarPorHash, [tokenHash]);
    return rows[0] ?? null;
  };

  buscarAberto = async (
    fornecedorId: string,
    orgaoId: string,
  ): Promise<ConviteDeFornecedor | null> => {
    const { rows } = await pool.query(SQL.buscarAberto, [fornecedorId, orgaoId]);
    return rows[0] ?? null;
  };

  registrarUso = async (id: string): Promise<void> => {
    await pool.query(SQL.registrarUso, [id]);
  };

  revogarAbertos = async (fornecedorId: string, orgaoId: string): Promise<void> => {
    await pool.query(SQL.revogarAbertos, [fornecedorId, orgaoId]);
  };
}
