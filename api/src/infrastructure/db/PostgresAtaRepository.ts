import { pool } from "./pool";
import type { Tx } from "../../application/ports/Transacao";
import type {
  AtaRepository, AtaResumo, EdicaoAta, ItemDeAta, NovaAta,
} from "../../application/ports/AtaRepository";

const SQL = {
  existeNumero: `
    SELECT 1 FROM ata_registro_precos
     WHERE orgao_id = $1 AND numero = $2 AND ($3::uuid IS NULL OR id <> $3)`,
  buscar: `
    SELECT id, numero, objeto, licitacao_id AS "licitacaoId",
           data_assinatura AS "dataAssinatura", data_vigencia AS "dataVigencia",
           valor_total AS "valorTotal"
      FROM ata_registro_precos WHERE orgao_id = $1 AND id = $2`,
  atualizar: `
    UPDATE ata_registro_precos
       SET numero = COALESCE($3, numero),
           licitacao_id = CASE WHEN $4::boolean THEN $5 ELSE licitacao_id END,
           objeto = COALESCE($6, objeto),
           data_assinatura = COALESCE($7, data_assinatura),
           data_vigencia = COALESCE($8, data_vigencia),
           valor_total = COALESCE($9, valor_total)
     WHERE orgao_id = $1 AND id = $2`,
  limparItens: `DELETE FROM ata_item WHERE ata_id = $1`,
  vinculos: `
    SELECT
      (SELECT count(*) FROM contrato WHERE ata_id = $2 AND orgao_id = $1) AS contratos,
      (SELECT count(*) FROM item i
         JOIN ata_item ai ON ai.id = i.origem_ata_item_id
        WHERE ai.ata_id = $2 AND i.orgao_id = $1) AS itens_copiados`,
  remover: `DELETE FROM ata_registro_precos WHERE orgao_id = $1 AND id = $2`,
  criar: `
    INSERT INTO ata_registro_precos
      (orgao_id, licitacao_id, numero, objeto, data_assinatura, data_vigencia, valor_total)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
  criarItem: `
    INSERT INTO ata_item
      (ata_id, produto, descricao, unidade_medida, marca, quantidade, valor_unitario, valor_total)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  listar: `
    SELECT id, numero, objeto, licitacao_id AS "licitacaoId",
           data_assinatura AS "dataAssinatura", data_vigencia AS "dataVigencia",
           valor_total AS "valorTotal"
      FROM ata_registro_precos
     WHERE orgao_id = $1
     ORDER BY data_assinatura DESC`,
  listarItens: `
    SELECT i.id, i.produto, i.descricao, i.unidade_medida AS "unidadeMedida", i.marca,
           i.quantidade, i.valor_unitario AS "valorUnitario", i.valor_total AS "valorTotal"
      FROM ata_item i
      JOIN ata_registro_precos a ON a.id = i.ata_id
     WHERE a.orgao_id = $1 AND i.ata_id = $2
     ORDER BY i.produto`,
};

export class PostgresAtaRepository implements AtaRepository {
  existeNumero = async (orgaoId: string, numero: string, ignorarId?: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeNumero, [orgaoId, numero, ignorarId ?? null]);
    return (rowCount ?? 0) > 0;
  };

  buscar = async (orgaoId: string, id: string): Promise<AtaResumo | null> => {
    const { rows } = await pool.query(SQL.buscar, [orgaoId, id]);
    return rows[0] ?? null;
  };

  atualizar = async (orgaoId: string, id: string, dados: EdicaoAta, tx: Tx): Promise<void> => {
    await tx.query(SQL.atualizar, [
      orgaoId, id, dados.numero ?? null,
      dados.licitacaoId !== undefined, dados.licitacaoId ?? null,
      dados.objeto ?? null, dados.dataAssinatura ?? null,
      dados.dataVigencia ?? null, dados.valorTotal ?? null,
    ]);

    if (dados.itens) {
      await tx.query(SQL.limparItens, [id]);
      for (const item of dados.itens) {
        await tx.query(SQL.criarItem, [
          id, item.produto, item.descricao ?? null, item.unidadeMedida,
          item.marca ?? null, item.quantidade, item.valorUnitario, item.valorTotal,
        ]);
      }
    }
  };

  contarVinculos = async (orgaoId: string, id: string): Promise<Record<string, number>> => {
    const { rows } = await pool.query(SQL.vinculos, [orgaoId, id]);
    return Object.fromEntries(
      Object.entries(rows[0] as Record<string, string>)
        .map(([chave, valor]) => [chave, Number(valor)])
        .filter(([, quantidade]) => (quantidade as number) > 0),
    );
  };

  remover = async (orgaoId: string, id: string, tx: Tx): Promise<void> => {
    await tx.query(SQL.limparItens, [id]);
    await tx.query(SQL.remover, [orgaoId, id]);
  };

  criar = async (dados: NovaAta, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criar, [
      dados.orgaoId, dados.licitacaoId ?? null, dados.numero, dados.objeto,
      dados.dataAssinatura, dados.dataVigencia, dados.valorTotal,
    ]);
    const id: string = rows[0].id;

    for (const item of dados.itens) {
      await tx.query(SQL.criarItem, [
        id, item.produto, item.descricao ?? null, item.unidadeMedida,
        item.marca ?? null, item.quantidade, item.valorUnitario, item.valorTotal,
      ]);
    }
    return id;
  };

  listar = async (orgaoId: string): Promise<AtaResumo[]> => {
    const { rows } = await pool.query(SQL.listar, [orgaoId]);
    return rows;
  };

  listarItens = async (orgaoId: string, ataId: string): Promise<ItemDeAta[]> => {
    const { rows } = await pool.query(SQL.listarItens, [orgaoId, ataId]);
    return rows.map((item) => ({
      ...item,
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valorUnitario),
      valorTotal: Number(item.valorTotal),
    }));
  };
}
