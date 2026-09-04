import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
} from "../../application/shared/Paginacao";
import type { Pagina, Paginacao } from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  EmailFilaRepository, EmailNaFila, EmailParaEnviar, NovoEmail,
} from "../../application/ports/EmailFilaRepository";

const COLUNAS = `
  id, orgao_id AS "orgaoId", tipo, destinatario, assunto, corpo,
  referencia_id AS "referenciaId", status, tentativas,
  ultimo_erro AS "ultimoErro", agendado_para AS "agendadoPara",
  enviado_em AS "enviadoEm", criado_em AS "criadoEm"`;

const SQL = {
  /**
   * `ON CONFLICT DO NOTHING` é a idempotência em ação.
   *
   * O segundo clique esbarra na chave única e não grava — e não é erro, é um
   * clique a mais. `RETURNING id` volta vazio nesse caso, que é como o caso de
   * uso sabe a diferença sem consultar antes (o que abriria janela entre a
   * leitura e a escrita).
   */
  enfileirar: `
    INSERT INTO email_fila
      (orgao_id, tipo, destinatario, assunto, corpo, referencia_id, chave_idempotencia)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (chave_idempotencia) DO NOTHING
    RETURNING id`,

  /**
   * Reserva um lote para este worker.
   *
   * `FOR UPDATE SKIP LOCKED` é o que permite uma segunda réplica sem que as
   * duas peguem o mesmo e-mail: a segunda pula o que a primeira segura, em vez
   * de esperar por ele.
   *
   * A reserva já conta a tentativa e empurra `agendado_para` cinco minutos.
   * Se o processo morrer entre o SMTP aceitar e o `marcarEnviado`, a linha
   * volta sozinha para a fila depois disso — o custo é um e-mail repetido no
   * caso raro, e a alternativa é a linha ficar presa em PENDENTE para sempre,
   * que é pior: ninguém recebe e ninguém percebe.
   *
   * O nome do órgão vem junto porque é ele que vai no remetente.
   */
  reservarLote: `
    WITH escolhidos AS (
      SELECT id FROM email_fila
       WHERE status = 'PENDENTE' AND agendado_para <= now()
       ORDER BY agendado_para
       LIMIT $1
       FOR UPDATE SKIP LOCKED
    )
    UPDATE email_fila e
       SET tentativas = e.tentativas + 1,
           agendado_para = now() + interval '5 minutes'
      FROM escolhidos, orgao o
     WHERE e.id = escolhidos.id AND o.id = e.orgao_id
    RETURNING e.id, e.orgao_id AS "orgaoId", e.tipo, e.destinatario, e.assunto,
              e.corpo, e.referencia_id AS "referenciaId", e.status, e.tentativas,
              e.ultimo_erro AS "ultimoErro", e.agendado_para AS "agendadoPara",
              e.enviado_em AS "enviadoEm", e.criado_em AS "criadoEm",
              o.nome AS "orgaoNome"`,

  marcarEnviado: `
    UPDATE email_fila SET status = 'ENVIADO', enviado_em = now(), ultimo_erro = NULL
     WHERE id = $1`,

  // `agendado_para` nulo = acabaram as tentativas. O CHECK da tabela impede
  // FALHOU com `enviado_em`, então ele não é tocado aqui.
  marcarFalha: `
    UPDATE email_fila
       SET ultimo_erro = $2,
           status = CASE WHEN $3::timestamptz IS NULL THEN 'FALHOU' ELSE 'PENDENTE' END,
           agendado_para = COALESCE($3::timestamptz, agendado_para)
     WHERE id = $1`,

  listar: `
    SELECT ${COLUNAS}, ${TOTAL_DA_JANELA} FROM email_fila
     WHERE orgao_id = $1
     ORDER BY criado_em DESC, id
     LIMIT $2 OFFSET $3`,

  /**
   * O botão de reenviar.
   *
   * Zera as tentativas e devolve para agora. Só alcança o que falhou: e-mail
   * já enviado não se manda de novo por engano, e o filtro por `orgao_id`
   * impede que uma prefeitura mexa na fila da outra.
   */
  reenfileirar: `
    UPDATE email_fila
       SET status = 'PENDENTE', tentativas = 0, agendado_para = now(), ultimo_erro = NULL
     WHERE orgao_id = $1 AND id = $2 AND status = 'FALHOU'
    RETURNING id`,
};

export class PostgresEmailFilaRepository implements EmailFilaRepository {
  enfileirar = async (tx: Tx, dados: NovoEmail): Promise<boolean> => {
    const { rows } = await tx.query(SQL.enfileirar, [
      dados.orgaoId, dados.tipo, dados.destinatario, dados.assunto, dados.corpo,
      dados.referenciaId ?? null, dados.chaveIdempotencia,
    ]);
    return rows.length > 0;
  };

  reservarLote = async (limite: number): Promise<EmailParaEnviar[]> => {
    const { rows } = await pool.query(SQL.reservarLote, [limite]);
    return rows;
  };

  marcarEnviado = async (id: string): Promise<void> => {
    await pool.query(SQL.marcarEnviado, [id]);
  };

  marcarFalha = async (
    id: string,
    erro: string,
    proximaTentativa: Date | null,
  ): Promise<void> => {
    await pool.query(SQL.marcarFalha, [id, erro, proximaTentativa]);
  };

  listar = async (orgaoId: string, paginacao: Paginacao): Promise<Pagina<EmailNaFila>> => {
    const { rows } = await pool.query(SQL.listar, [
      orgaoId, paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    return montarPagina(rows, paginacao);
  };

  reenfileirar = async (orgaoId: string, id: string): Promise<boolean> => {
    const { rows } = await pool.query(SQL.reenfileirar, [orgaoId, id]);
    return rows.length > 0;
  };
}
