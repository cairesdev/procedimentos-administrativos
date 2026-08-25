import { pool } from "./pool";
import { LIMIAR_ALERTA_DIAS } from "../../domain/shared/Prazos";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Paginacao,
} from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  DestinoEtapa, FilaDeProcessos, NovaOrdemFornecimento, NovoDespacho, ProcessoDetalhe,
  TramitacaoRepository,
} from "../../application/ports/TramitacaoRepository";

/** Colunas de apoio da query da fila — não fazem parte do contrato. */
type Contadores = { _atrasados: string; _vencendo: string; dataAbertura: string };

// Só ENCAMINHAMENTO move o processo — parecer encerra e ordem não desloca.
// Por isso o último encaminhamento é exatamente o que o pôs onde ele está.
const ENTRADA_NO_SETOR = `
  coalesce(
    (SELECT max(d.data) FROM despacho d
      WHERE d.processo_id = p.id AND d.tipo = 'ENCAMINHAMENTO'),
    p.data_abertura)`;

// Prazo da etapa do fluxo correspondente ao setor atual, quando ativo.
const PRAZO_DA_ETAPA = `
  (SELECT fe.prazo_dias
     FROM fluxo_etapa fe
     JOIN fluxo_configuracao fc ON fc.id = fe.fluxo_id
    WHERE fc.orgao_id = p.orgao_id
      AND fc.tipo_processo = p.tipo_processo
      AND fe.setor_id = p.setor_atual_id
      AND fe.prazo_ativo
      AND fe.prazo_dias IS NOT NULL
    ORDER BY fe.ordem
    LIMIT 1)`;

const COLUNAS_PROCESSO = `
  p.id, p.orgao_id AS "orgaoId", p.numero_protocolo AS "numeroProtocolo",
  p.numero_processo_adm AS "numeroProcessoAdm", p.tipo_processo AS "tipoProcesso",
  p.setor_atual_id AS "setorAtualId", p.departamento_atual_id AS "departamentoAtualId", p.status,
  ${ENTRADA_NO_SETOR} AS "entrouNoSetorEm",
  ${PRAZO_DA_ETAPA} AS "prazoDias",
  CASE WHEN ${PRAZO_DA_ETAPA} IS NULL THEN NULL
       ELSE ${ENTRADA_NO_SETOR} + (${PRAZO_DA_ETAPA} || ' days')::interval
  END AS "prazoLimite",
  -- Dias inteiros até o vencimento; negativo = atrasado.
  CASE WHEN ${PRAZO_DA_ETAPA} IS NULL THEN NULL
       ELSE floor(extract(epoch FROM (
              ${ENTRADA_NO_SETOR} + (${PRAZO_DA_ETAPA} || ' days')::interval - now()
            )) / 86400)::int
  END AS "diasParaVencer"`;

const SQL = {
  buscarProcesso: `
    SELECT ${COLUNAS_PROCESSO},
           -- O detalhe do processo mostra a solicitação que o originou.
           (SELECT s.id FROM solicitacao s WHERE s.processo_id = p.id) AS "solicitacaoId"
      FROM processo p WHERE p.orgao_id = $1 AND p.id = $2`,
  // Os contadores saem por janela sobre a fila inteira, na mesma ida ao
  // banco: a página traz 25 linhas, mas o alerta fala da fila toda.
  listarFila: `
    WITH fila AS (
      SELECT ${COLUNAS_PROCESSO}, p.data_abertura AS "dataAbertura" FROM processo p
       WHERE p.orgao_id = $1
         AND ($2::uuid IS NULL OR p.setor_atual_id = $2)
         AND p.status IN ('ABERTO', 'TRAMITANDO')
    )
    SELECT fila.*, ${TOTAL_DA_JANELA},
           count(*) FILTER (WHERE "diasParaVencer" < 0) OVER () AS "_atrasados",
           count(*) FILTER (
             WHERE "diasParaVencer" BETWEEN 0 AND $3
           ) OVER () AS "_vencendo"
      FROM fila
     -- Quem está mais perto de estourar (ou já estourou) primeiro; sem prazo, por antiguidade.
     ORDER BY "diasParaVencer" NULLS LAST, "dataAbertura", id
     LIMIT $4 OFFSET $5`,
  listarDespachos: `
    SELECT d.id, d.tipo, d.texto, d.data, d.setor_id AS "setorId",
           d.departamento_id AS "departamentoId", u.nome AS "usuarioNome"
      FROM despacho d
      JOIN usuario u ON u.id = d.usuario_id
     WHERE d.processo_id = $1
     ORDER BY d.data`,
  registrarDespacho: `
    INSERT INTO despacho (processo_id, setor_id, departamento_id, usuario_id, lotacao_id, tipo, texto)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
  moverProcesso: `
    UPDATE processo
       SET setor_atual_id = $2, departamento_atual_id = $3, status = 'TRAMITANDO'
     WHERE id = $1`,
  encerrarProcesso: `
    UPDATE processo SET status = 'ENCERRADO', data_encerramento = now() WHERE id = $1`,
  lotacaoDoUsuario: `SELECT 1 FROM lotacao WHERE id = $1 AND usuario_id = $2 AND ativo`,
  ordemDaEtapaAtual: `
    SELECT fe.ordem
      FROM fluxo_etapa fe
      JOIN fluxo_configuracao fc ON fc.id = fe.fluxo_id
     WHERE fc.orgao_id = $1 AND fc.tipo_processo = $2 AND fe.setor_id = $3
     ORDER BY fe.ordem LIMIT 1`,
  etapaSeguinte: `
    SELECT fe.setor_id AS "setorId", fe.departamento_id AS "departamentoId"
      FROM fluxo_etapa fe
      JOIN fluxo_configuracao fc ON fc.id = fe.fluxo_id
     WHERE fc.orgao_id = $1 AND fc.tipo_processo = $2 AND fe.ordem > $3
     ORDER BY fe.ordem LIMIT 1`,
  registrarParecer: `
    INSERT INTO parecer (processo_id, favoravel, justificativa, usuario_id)
    VALUES ($1, $2, $3, $4) RETURNING id`,
  fornecedorDoContrato: `
    SELECT fornecedor_id AS "fornecedorId" FROM contrato WHERE orgao_id = $1 AND id = $2`,
  contratoParticipa: `
    SELECT 1
      FROM solicitacao s
      JOIN solicitacao_item si ON si.solicitacao_id = s.id
      JOIN item i ON i.id = si.item_id
     WHERE s.processo_id = $1 AND i.contrato_id = $2
     LIMIT 1`,
  existeNotaFiscal: `
    SELECT 1 FROM ordem_fornecimento
     WHERE orgao_id = $1 AND fornecedor_id = $2 AND numero_nota_fiscal = $3`,
  criarOrdem: `
    INSERT INTO ordem_fornecimento
      (orgao_id, processo_id, contrato_id, fornecedor_id, numero, dados_contratante,
       numero_empenho, numero_requisicao, projeto_atividade, elemento_despesa,
       fonte_recurso, valor, numero_parcelas, numero_nota_fiscal)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id`,
};

export class PostgresTramitacaoRepository implements TramitacaoRepository {
  buscarProcesso = async (orgaoId: string, processoId: string): Promise<ProcessoDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscarProcesso, [orgaoId, processoId]);
    return rows[0] ?? null;
  };

  listarFila = async (
    orgaoId: string,
    paginacao: Paginacao,
    setorId?: string,
  ): Promise<FilaDeProcessos> => {
    const { rows } = await pool.query(SQL.listarFila, [
      orgaoId, setorId ?? null, LIMIAR_ALERTA_DIAS,
      paginacao.porPagina, deslocamentoDe(paginacao),
    ]);

    const primeira = rows[0];
    // `dataAbertura` só existe para ordenar; não faz parte do contrato.
    const { itens, ...pagina } = montarPagina<ProcessoDetalhe & Contadores>(rows, paginacao);
    return {
      ...pagina,
      itens: itens.map(({ _atrasados, _vencendo, dataAbertura, ...processo }) => processo),
      atrasados: primeira ? Number(primeira._atrasados) : 0,
      vencendo: primeira ? Number(primeira._vencendo) : 0,
      limiarAlertaDias: LIMIAR_ALERTA_DIAS,
    };
  };

  listarDespachos = async (processoId: string): Promise<unknown[]> => {
    const { rows } = await pool.query(SQL.listarDespachos, [processoId]);
    return rows;
  };

  registrarDespacho = async (dados: NovoDespacho, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.registrarDespacho, [
      dados.processoId, dados.setorId, dados.departamentoId ?? null,
      dados.usuarioId, dados.lotacaoId, dados.tipo, dados.texto ?? null,
    ]);
    return rows[0].id;
  };

  moverProcesso = async (processoId: string, destino: DestinoEtapa, tx: Tx): Promise<void> => {
    await tx.query(SQL.moverProcesso, [processoId, destino.setorId, destino.departamentoId]);
  };

  encerrarProcesso = async (processoId: string, tx: Tx): Promise<void> => {
    await tx.query(SQL.encerrarProcesso, [processoId]);
  };

  lotacaoPertenceAoUsuario = async (lotacaoId: string, usuarioId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.lotacaoDoUsuario, [lotacaoId, usuarioId]);
    return (rowCount ?? 0) > 0;
  };

  proximaEtapaApos = async (
    orgaoId: string, tipoProcesso: string, setorAtualId: string,
  ): Promise<DestinoEtapa | null> => {
    const atual = await pool.query(SQL.ordemDaEtapaAtual, [orgaoId, tipoProcesso, setorAtualId]);
    if (!atual.rows[0]) return null;
    const { rows } = await pool.query(SQL.etapaSeguinte, [orgaoId, tipoProcesso, atual.rows[0].ordem]);
    return rows[0] ?? null;
  };

  registrarParecer = async (
    processoId: string, favoravel: boolean, justificativa: string | undefined, usuarioId: string, tx: Tx,
  ): Promise<string> => {
    const { rows } = await tx.query(SQL.registrarParecer, [
      processoId, favoravel, justificativa ?? null, usuarioId,
    ]);
    return rows[0].id;
  };

  fornecedorDoContrato = async (orgaoId: string, contratoId: string): Promise<string | null> => {
    const { rows } = await pool.query(SQL.fornecedorDoContrato, [orgaoId, contratoId]);
    return rows[0]?.fornecedorId ?? null;
  };

  contratoParticipaDoProcesso = async (processoId: string, contratoId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.contratoParticipa, [processoId, contratoId]);
    return (rowCount ?? 0) > 0;
  };

  existeNotaFiscal = async (orgaoId: string, fornecedorId: string, nf: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeNotaFiscal, [orgaoId, fornecedorId, nf]);
    return (rowCount ?? 0) > 0;
  };

  criarOrdem = async (dados: NovaOrdemFornecimento, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criarOrdem, [
      dados.orgaoId, dados.processoId, dados.contratoId, dados.fornecedorId, dados.numero,
      dados.dadosContratante ? JSON.stringify(dados.dadosContratante) : null,
      dados.numeroEmpenho ?? null, dados.numeroRequisicao ?? null,
      dados.projetoAtividade ?? null, dados.elementoDespesa ?? null,
      dados.fonteRecurso ?? null, dados.valor, dados.numeroParcelas ?? null,
      dados.numeroNotaFiscal ?? null,
    ]);
    return rows[0].id;
  };
}
