import type { Tx } from "../../application/ports/Transacao";
import type {
  NovoProcesso,
  NumeracaoSequencia,
  ProcessoRepository,
} from "../../application/ports/ProcessoRepository";

const SQL = {
  criar: `
    INSERT INTO processo (orgao_id, numero_protocolo, numero_processo_adm, tipo_processo,
                          setor_atual_id, departamento_atual_id, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'ABERTO')
    RETURNING id`,
  cancelar: `
    UPDATE processo
       SET status = 'CANCELADO', data_encerramento = now()
     WHERE id = $1 AND orgao_id = $2 AND status <> 'CANCELADO'`,
  proximoNumero: `
    INSERT INTO numeracao_sequencia (orgao_id, tipo, ano, contador)
    VALUES ($1, $2, $3, 1)
    ON CONFLICT (orgao_id, tipo, ano)
    DO UPDATE SET contador = numeracao_sequencia.contador + 1
    RETURNING contador`,
};

export class PostgresProcessoRepository implements ProcessoRepository, NumeracaoSequencia {
  criar = async (dados: NovoProcesso, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criar, [
      dados.orgaoId,
      dados.numeroProtocolo,
      dados.numeroProcessoAdm,
      dados.tipoProcesso,
      dados.setorAtualId ?? null,
      dados.departamentoAtualId ?? null,
    ]);
    return rows[0].id;
  };

  cancelar = async (orgaoId: string, processoId: string, tx: Tx): Promise<void> => {
    await tx.query(SQL.cancelar, [processoId, orgaoId]);
  };

  proximoNumero = async (orgaoId: string, tipo: string, ano: number, tx: Tx): Promise<number> => {
    const { rows } = await tx.query(SQL.proximoNumero, [orgaoId, tipo, ano]);
    return rows[0].contador;
  };
}
