import { pool, executarEmTransacao } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  BemDetalhe, BemResumo, CategoriaResumo, ConferenciaDeItem, EdicaoBem, EdicaoCategoria,
  EdicaoLocal, EdicaoRemessa, InventarioResumo, ItemDeInventario, LocalResumo, NovaCategoria,
  BaixaResumo, NovaBaixa, NovaRemessa, NovaTransferencia, NovoInventario, NovoLocal,
  PatrimonioRepository, RemessaDetalhe, RemessaResumo, TransferenciaResumo,
} from "../../application/ports/PatrimonioRepository";

const SQL = {
  listarLocais: `
    SELECT l.id, l.codigo, l.nome, l.unidade_id AS "unidadeId", l.ativo,
           (SELECT count(*) FROM bem b WHERE b.local_atual_id = l.id AND b.status = 'ATIVO') AS bens
      FROM local l
     WHERE l.orgao_id = $1
     ORDER BY l.codigo`,
  buscarLocal: `
    SELECT l.id, l.codigo, l.nome, l.unidade_id AS "unidadeId", l.ativo,
           (SELECT count(*) FROM bem b WHERE b.local_atual_id = l.id AND b.status = 'ATIVO') AS bens
      FROM local l
     WHERE l.orgao_id = $1 AND l.id = $2`,
  existeCodigoLocal: `
    SELECT 1 FROM local WHERE orgao_id = $1 AND codigo = $2 AND ($3::uuid IS NULL OR id <> $3)`,
  criarLocal: `
    INSERT INTO local (orgao_id, unidade_id, codigo, nome) VALUES ($1, $2, $3, $4) RETURNING id`,
  atualizarLocal: `
    UPDATE local
       SET nome = COALESCE($3, nome),
           unidade_id = CASE WHEN $4::boolean THEN $5 ELSE unidade_id END,
           ativo = COALESCE($6, ativo)
     WHERE orgao_id = $1 AND id = $2`,
  removerLocal: `DELETE FROM local WHERE orgao_id = $1 AND id = $2`,

  listarCategorias: `
    SELECT c.id, c.nome, c.ativo,
           (SELECT count(*) FROM bem b WHERE b.categoria_id = c.id) AS bens
      FROM categoria_bem c
     WHERE c.orgao_id = $1
     ORDER BY c.nome`,
  buscarCategoria: `
    SELECT c.id, c.nome, c.ativo,
           (SELECT count(*) FROM bem b WHERE b.categoria_id = c.id) AS bens
      FROM categoria_bem c
     WHERE c.orgao_id = $1 AND c.id = $2`,
  criarCategoria: `INSERT INTO categoria_bem (orgao_id, nome) VALUES ($1, $2) RETURNING id`,
  atualizarCategoria: `
    UPDATE categoria_bem SET nome = COALESCE($3, nome), ativo = COALESCE($4, ativo)
     WHERE orgao_id = $1 AND id = $2`,
  removerCategoria: `DELETE FROM categoria_bem WHERE orgao_id = $1 AND id = $2`,

  listarRemessas: `
    SELECT r.id, r.data, r.nota_fiscal AS "notaFiscal", r.fornecedor_id AS "fornecedorId",
           (SELECT count(*) FROM bem b
              JOIN remessa_lote rl ON rl.id = b.remessa_lote_id
             WHERE rl.remessa_id = r.id) AS bens,
           ${TOTAL_DA_JANELA}
      FROM remessa_patrimonio r
     WHERE r.orgao_id = $1
     ORDER BY r.data DESC, r.id
     LIMIT $2 OFFSET $3`,
  buscarRemessa: `
    SELECT r.id, r.data, r.nota_fiscal AS "notaFiscal", r.fornecedor_id AS "fornecedorId",
           (SELECT count(*) FROM bem b
              JOIN remessa_lote rl ON rl.id = b.remessa_lote_id
             WHERE rl.remessa_id = r.id) AS bens,
           (SELECT count(*) FROM inventario_item ii
              JOIN bem b ON b.id = ii.bem_id
              JOIN remessa_lote rl ON rl.id = b.remessa_lote_id
             WHERE rl.remessa_id = r.id) AS conferencias
      FROM remessa_patrimonio r
     WHERE r.orgao_id = $1 AND r.id = $2`,
  criarRemessa: `
    INSERT INTO remessa_patrimonio (orgao_id, data, fornecedor_id, nota_fiscal, contrato_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING id`,
  atualizarRemessa: `
    UPDATE remessa_patrimonio
       SET data = COALESCE($3, data), fornecedor_id = $4, nota_fiscal = $5
     WHERE orgao_id = $1 AND id = $2`,
  // Ordem obrigatória: bens → lotes → remessa. O contador do local não volta,
  // tombamento excluído vira buraco na sequência de propósito.
  removerBensDaRemessa: `
    DELETE FROM bem
     WHERE orgao_id = $1
       AND remessa_lote_id IN (SELECT id FROM remessa_lote WHERE remessa_id = $2)`,
  removerLotesDaRemessa: `DELETE FROM remessa_lote WHERE remessa_id = $1`,
  removerRemessa: `DELETE FROM remessa_patrimonio WHERE orgao_id = $1 AND id = $2`,
  criarLote: `
    INSERT INTO remessa_lote (remessa_id, categoria_id, local_destino_id, nome_bem, quantidade)
    VALUES ($1, $2, $3, $4, $5) RETURNING id`,
  // Sequencial por local, criado na primeira entrada e travado durante a transação.
  proximoSequencial: `
    INSERT INTO local_tombamento_sequencia (local_id, contador)
    VALUES ($1, $2)
    ON CONFLICT (local_id) DO UPDATE SET contador = local_tombamento_sequencia.contador + $2
    RETURNING contador`,
  codigoDoLocal: `SELECT codigo FROM local WHERE orgao_id = $1 AND id = $2`,
  criarBem: `
    INSERT INTO bem (orgao_id, codigo_tombamento, local_tombamento_id, local_atual_id,
                     categoria_id, remessa_lote_id, nome)
    VALUES ($1, $2, $3, $3, $4, $5, $6)`,

  listarBens: `
    SELECT b.id, b.codigo_tombamento AS "codigoTombamento", b.nome,
           b.categoria_id AS "categoriaId", c.nome AS "categoriaNome",
           b.local_atual_id AS "localAtualId", l.nome AS "localAtualNome",
           b.estado_conservacao AS "estadoConservacao", b.status, ${TOTAL_DA_JANELA}
      FROM bem b
      JOIN categoria_bem c ON c.id = b.categoria_id
      JOIN local l ON l.id = b.local_atual_id
     WHERE b.orgao_id = $1
       AND ($2::uuid IS NULL OR b.local_atual_id = $2)
       AND ($3::text IS NULL OR b.status = $3)
     ORDER BY b.codigo_tombamento, b.id
     LIMIT $4 OFFSET $5`,
  buscarBem: `
    SELECT b.id, b.codigo_tombamento AS "codigoTombamento", b.nome,
           b.categoria_id AS "categoriaId", c.nome AS "categoriaNome",
           b.local_atual_id AS "localAtualId", l.nome AS "localAtualNome",
           b.estado_conservacao AS "estadoConservacao", b.status,
           (SELECT count(*) FROM inventario_item ii WHERE ii.bem_id = b.id) AS conferencias
      FROM bem b
      JOIN categoria_bem c ON c.id = b.categoria_id
      JOIN local l ON l.id = b.local_atual_id
     WHERE b.orgao_id = $1 AND b.id = $2`,
  atualizarBem: `
    UPDATE bem SET nome = COALESCE($3, nome), categoria_id = COALESCE($4, categoria_id)
     WHERE orgao_id = $1 AND id = $2`,
  removerBem: `DELETE FROM bem WHERE orgao_id = $1 AND id = $2`,

  listarTransferencias: `
    SELECT tr.id, tr.bem_id AS "bemId", b.codigo_tombamento AS "codigoTombamento",
           b.nome AS "nomeBem",
           tr.local_origem_id AS "localOrigemId", lo.nome AS "localOrigemNome",
           tr.local_destino_id AS "localDestinoId", ld.nome AS "localDestinoNome",
           ue.nome AS "enviadoPor", tr.data_envio AS "dataEnvio",
           ua.nome AS "aceitoPor", tr.data_aceite AS "dataAceite", tr.status,
           ${TOTAL_DA_JANELA}
      FROM transferencia_bem tr
      JOIN bem b ON b.id = tr.bem_id
      JOIN local lo ON lo.id = tr.local_origem_id
      JOIN local ld ON ld.id = tr.local_destino_id
      JOIN usuario ue ON ue.id = tr.enviado_por_usuario_id
      LEFT JOIN usuario ua ON ua.id = tr.aceito_por_usuario_id
     WHERE b.orgao_id = $1
       AND ($2::text IS NULL OR tr.status = $2)
       AND ($3::uuid IS NULL OR tr.local_origem_id = $3 OR tr.local_destino_id = $3)
     ORDER BY tr.data_envio DESC, tr.id
     LIMIT $4 OFFSET $5`,
  buscarTransferencia: `
    SELECT tr.id, tr.bem_id AS "bemId", b.codigo_tombamento AS "codigoTombamento",
           b.nome AS "nomeBem",
           tr.local_origem_id AS "localOrigemId", lo.nome AS "localOrigemNome",
           tr.local_destino_id AS "localDestinoId", ld.nome AS "localDestinoNome",
           ue.nome AS "enviadoPor", tr.data_envio AS "dataEnvio",
           ua.nome AS "aceitoPor", tr.data_aceite AS "dataAceite", tr.status
      FROM transferencia_bem tr
      JOIN bem b ON b.id = tr.bem_id
      JOIN local lo ON lo.id = tr.local_origem_id
      JOIN local ld ON ld.id = tr.local_destino_id
      JOIN usuario ue ON ue.id = tr.enviado_por_usuario_id
      LEFT JOIN usuario ua ON ua.id = tr.aceito_por_usuario_id
     WHERE b.orgao_id = $1 AND tr.id = $2`,
  transferenciaPendente: `
    SELECT tr.id, tr.bem_id AS "bemId", b.codigo_tombamento AS "codigoTombamento",
           b.nome AS "nomeBem",
           tr.local_origem_id AS "localOrigemId", lo.nome AS "localOrigemNome",
           tr.local_destino_id AS "localDestinoId", ld.nome AS "localDestinoNome",
           ue.nome AS "enviadoPor", tr.data_envio AS "dataEnvio",
           ua.nome AS "aceitoPor", tr.data_aceite AS "dataAceite", tr.status
      FROM transferencia_bem tr
      JOIN bem b ON b.id = tr.bem_id
      JOIN local lo ON lo.id = tr.local_origem_id
      JOIN local ld ON ld.id = tr.local_destino_id
      JOIN usuario ue ON ue.id = tr.enviado_por_usuario_id
      LEFT JOIN usuario ua ON ua.id = tr.aceito_por_usuario_id
     WHERE b.orgao_id = $1 AND tr.bem_id = $2 AND tr.status = 'PENDENTE'
     LIMIT 1`,
  criarTransferencia: `
    INSERT INTO transferencia_bem
      (bem_id, local_origem_id, local_destino_id, enviado_por_usuario_id)
    VALUES ($1, $2, $3, $4) RETURNING id`,
  fecharTransferencia: `
    UPDATE transferencia_bem
       SET status = $2, aceito_por_usuario_id = $3, data_aceite = now()
     WHERE id = $1 AND status = 'PENDENTE'`,
  // O tombamento NÃO muda: local_tombamento_id fica como nasceu.
  moverBem: `UPDATE bem SET local_atual_id = $2 WHERE id = $1`,

  listarBaixas: `
    SELECT ba.bem_id AS "bemId", b.codigo_tombamento AS "codigoTombamento",
           b.nome AS "nomeBem", l.nome AS "localNome",
           ba.motivo, ba.observacao, u.nome AS "dadaPor", ba.data, ${TOTAL_DA_JANELA}
      FROM baixa_bem ba
      JOIN bem b ON b.id = ba.bem_id
      JOIN local l ON l.id = b.local_atual_id
      JOIN usuario u ON u.id = ba.usuario_id
     WHERE b.orgao_id = $1
     ORDER BY ba.data DESC, ba.bem_id
     LIMIT $2 OFFSET $3`,
  buscarBaixa: `
    SELECT ba.bem_id AS "bemId", b.codigo_tombamento AS "codigoTombamento",
           b.nome AS "nomeBem", l.nome AS "localNome",
           ba.motivo, ba.observacao, u.nome AS "dadaPor", ba.data
      FROM baixa_bem ba
      JOIN bem b ON b.id = ba.bem_id
      JOIN local l ON l.id = b.local_atual_id
      JOIN usuario u ON u.id = ba.usuario_id
     WHERE b.orgao_id = $1 AND ba.bem_id = $2`,
  registrarBaixa: `
    INSERT INTO baixa_bem (bem_id, motivo, observacao, usuario_id) VALUES ($1, $2, $3, $4)`,
  baixarBem: `UPDATE bem SET status = 'BAIXADO' WHERE orgao_id = $1 AND id = $2`,

  listarInventarios: `
    SELECT i.id, i.local_id AS "localId", l.nome AS "localNome",
           i.data_inicio AS "dataInicio", i.data_conclusao AS "dataConclusao", i.status,
           (SELECT count(*) FROM inventario_item ii WHERE ii.inventario_id = i.id) AS conferidos,
           (SELECT count(*) FROM bem b
             WHERE b.local_atual_id = i.local_id AND b.status = 'ATIVO') AS esperados,
           (SELECT count(*) FROM inventario_item ii
             WHERE ii.inventario_id = i.id AND ii.situacao = 'NAO_ENCONTRADO') AS divergencias
      FROM inventario i
      JOIN local l ON l.id = i.local_id
     WHERE l.orgao_id = $1
     ORDER BY i.data_inicio DESC`,
  buscarInventario: `
    SELECT i.id, i.local_id AS "localId", l.nome AS "localNome",
           i.data_inicio AS "dataInicio", i.data_conclusao AS "dataConclusao", i.status,
           (SELECT count(*) FROM inventario_item ii WHERE ii.inventario_id = i.id) AS conferidos,
           (SELECT count(*) FROM bem b
             WHERE b.local_atual_id = i.local_id AND b.status = 'ATIVO') AS esperados,
           (SELECT count(*) FROM inventario_item ii
             WHERE ii.inventario_id = i.id AND ii.situacao = 'NAO_ENCONTRADO') AS divergencias
      FROM inventario i
      JOIN local l ON l.id = i.local_id
     WHERE l.orgao_id = $1 AND i.id = $2`,
  inventarioAberto: `
    SELECT 1 FROM inventario i
      JOIN local l ON l.id = i.local_id
     WHERE l.orgao_id = $1 AND i.local_id = $2 AND i.status = 'ABERTO'`,
  abrirInventario: `
    INSERT INTO inventario (local_id, data_inicio) VALUES ($1, $2) RETURNING id`,
  // Lista os bens esperados no local com a conferência já registrada, quando houver.
  itensDoInventario: `
    SELECT ii.id, b.id AS "bemId", b.codigo_tombamento AS "codigoTombamento", b.nome,
           b.estado_conservacao AS "estadoRegistrado",
           ii.situacao,
           ii.estado_observado AS "estadoObservado", ii.observacao
      FROM inventario i
      JOIN local l ON l.id = i.local_id
      JOIN bem b ON b.local_atual_id = i.local_id AND b.status = 'ATIVO' AND b.orgao_id = l.orgao_id
      LEFT JOIN inventario_item ii ON ii.inventario_id = i.id AND ii.bem_id = b.id
     WHERE l.orgao_id = $1 AND i.id = $2
     ORDER BY b.codigo_tombamento`,
  registrarConferencia: `
    INSERT INTO inventario_item (inventario_id, bem_id, situacao, estado_observado, observacao)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (inventario_id, bem_id)
    DO UPDATE SET situacao = $3, estado_observado = $4, observacao = $5`,
  concluirInventario: `
    UPDATE inventario SET status = 'CONCLUIDO', data_conclusao = now()
     WHERE id = $2 AND status = 'ABERTO'
       AND local_id IN (SELECT id FROM local WHERE orgao_id = $1)`,
};

const comContagem = <T extends Record<string, unknown>>(linha: T, campos: string[]): T => {
  const convertido = { ...linha };
  for (const campo of campos) convertido[campo as keyof T] = Number(linha[campo]) as never;
  return convertido;
};

export class PostgresPatrimonioRepository implements PatrimonioRepository {
  listarLocais = async (orgaoId: string): Promise<LocalResumo[]> => {
    const { rows } = await pool.query(SQL.listarLocais, [orgaoId]);
    return rows.map((linha) => comContagem(linha, ["bens"]));
  };

  buscarLocal = async (orgaoId: string, id: string): Promise<LocalResumo | null> => {
    const { rows } = await pool.query(SQL.buscarLocal, [orgaoId, id]);
    return rows[0] ? comContagem(rows[0], ["bens"]) : null;
  };

  existeCodigoLocal = async (orgaoId: string, codigo: string, ignorarId?: string) => {
    const { rowCount } = await pool.query(SQL.existeCodigoLocal, [orgaoId, codigo, ignorarId ?? null]);
    return (rowCount ?? 0) > 0;
  };

  criarLocal = async (dados: NovoLocal): Promise<string> => {
    const { rows } = await pool.query(SQL.criarLocal, [
      dados.orgaoId, dados.unidadeId ?? null, dados.codigo, dados.nome,
    ]);
    return rows[0].id;
  };

  atualizarLocal = async (orgaoId: string, id: string, dados: EdicaoLocal): Promise<void> => {
    await pool.query(SQL.atualizarLocal, [
      orgaoId, id, dados.nome ?? null,
      dados.unidadeId !== undefined, dados.unidadeId ?? null,
      dados.ativo ?? null,
    ]);
  };

  removerLocal = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerLocal, [orgaoId, id]);
  };

  listarCategorias = async (orgaoId: string): Promise<CategoriaResumo[]> => {
    const { rows } = await pool.query(SQL.listarCategorias, [orgaoId]);
    return rows.map((linha) => comContagem(linha, ["bens"]));
  };

  buscarCategoria = async (orgaoId: string, id: string): Promise<CategoriaResumo | null> => {
    const { rows } = await pool.query(SQL.buscarCategoria, [orgaoId, id]);
    return rows[0] ? comContagem(rows[0], ["bens"]) : null;
  };

  criarCategoria = async (dados: NovaCategoria): Promise<string> => {
    const { rows } = await pool.query(SQL.criarCategoria, [dados.orgaoId, dados.nome]);
    return rows[0].id;
  };

  atualizarCategoria = async (orgaoId: string, id: string, dados: EdicaoCategoria) => {
    await pool.query(SQL.atualizarCategoria, [orgaoId, id, dados.nome ?? null, dados.ativo ?? null]);
  };

  removerCategoria = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerCategoria, [orgaoId, id]);
  };

  listarRemessas = async (
    orgaoId: string,
    paginacao: Paginacao,
  ): Promise<Pagina<RemessaResumo>> => {
    const { rows } = await pool.query(SQL.listarRemessas, [
      orgaoId, paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    const pagina = montarPagina<RemessaResumo>(rows, paginacao);
    return { ...pagina, itens: pagina.itens.map((linha) => comContagem(linha, ["bens"])) };
  };

  buscarRemessa = async (orgaoId: string, id: string): Promise<RemessaDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscarRemessa, [orgaoId, id]);
    return rows[0] ? comContagem(rows[0], ["bens", "conferencias"]) : null;
  };

  atualizarRemessa = async (
    orgaoId: string,
    id: string,
    dados: EdicaoRemessa,
  ): Promise<void> => {
    await pool.query(SQL.atualizarRemessa, [
      orgaoId, id, dados.data ?? null, dados.fornecedorId ?? null, dados.notaFiscal ?? null,
    ]);
  };

  removerRemessa = async (orgaoId: string, id: string, tx: Tx): Promise<void> => {
    await tx.query(SQL.removerBensDaRemessa, [orgaoId, id]);
    await tx.query(SQL.removerLotesDaRemessa, [id]);
    await tx.query(SQL.removerRemessa, [orgaoId, id]);
  };

  // Cada lote vira N bens; o código nasce do local e nunca muda depois.
  criarRemessa = async (dados: NovaRemessa, tx: Tx) => {
    const { rows } = await tx.query(SQL.criarRemessa, [
      dados.orgaoId, dados.data, dados.fornecedorId ?? null,
      dados.notaFiscal ?? null, dados.contratoId ?? null,
    ]);
    const remessaId: string = rows[0].id;
    const tombamentos: string[] = [];

    for (const lote of dados.lotes) {
      const lotes = await tx.query(SQL.criarLote, [
        remessaId, lote.categoriaId, lote.localDestinoId, lote.nomeBem, lote.quantidade,
      ]);
      const loteId: string = lotes.rows[0].id;

      const local = await tx.query(SQL.codigoDoLocal, [dados.orgaoId, lote.localDestinoId]);
      const codigoLocal: string = local.rows[0].codigo;

      const sequencia = await tx.query(SQL.proximoSequencial, [lote.localDestinoId, lote.quantidade]);
      const ultimo: number = sequencia.rows[0].contador;
      const primeiro = ultimo - lote.quantidade + 1;

      for (let numero = primeiro; numero <= ultimo; numero += 1) {
        const codigo = `${codigoLocal}-${String(numero).padStart(3, "0")}`;
        await tx.query(SQL.criarBem, [
          dados.orgaoId, codigo, lote.localDestinoId, lote.categoriaId, loteId, lote.nomeBem,
        ]);
        tombamentos.push(codigo);
      }
    }

    return { id: remessaId, tombamentos };
  };

  listarBens = async (
    orgaoId: string,
    filtros: { localId?: string; status?: string },
    paginacao: Paginacao,
  ): Promise<Pagina<BemResumo>> => {
    const { rows } = await pool.query(SQL.listarBens, [
      orgaoId, filtros.localId ?? null, filtros.status ?? null,
      paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    return montarPagina(rows, paginacao);
  };

  buscarBem = async (orgaoId: string, id: string): Promise<BemDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscarBem, [orgaoId, id]);
    return rows[0] ? comContagem(rows[0], ["conferencias"]) : null;
  };

  atualizarBem = async (orgaoId: string, id: string, dados: EdicaoBem): Promise<void> => {
    await pool.query(SQL.atualizarBem, [orgaoId, id, dados.nome ?? null, dados.categoriaId ?? null]);
  };

  removerBem = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerBem, [orgaoId, id]);
  };

  listarTransferencias = async (
    orgaoId: string,
    filtros: { status?: string; localId?: string },
    paginacao: Paginacao,
  ): Promise<Pagina<TransferenciaResumo>> => {
    const { rows } = await pool.query(SQL.listarTransferencias, [
      orgaoId, filtros.status ?? null, filtros.localId ?? null,
      paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    return montarPagina(rows, paginacao);
  };

  buscarTransferencia = async (
    orgaoId: string,
    id: string,
  ): Promise<TransferenciaResumo | null> => {
    const { rows } = await pool.query(SQL.buscarTransferencia, [orgaoId, id]);
    return rows[0] ?? null;
  };

  transferenciaPendenteDoBem = async (
    orgaoId: string,
    bemId: string,
  ): Promise<TransferenciaResumo | null> => {
    const { rows } = await pool.query(SQL.transferenciaPendente, [orgaoId, bemId]);
    return rows[0] ?? null;
  };

  criarTransferencia = async (dados: NovaTransferencia): Promise<string> => {
    const { rows } = await pool.query(SQL.criarTransferencia, [
      dados.bemId, dados.localOrigemId, dados.localDestinoId, dados.enviadoPorUsuarioId,
    ]);
    return rows[0].id;
  };

  // Fechar a transferência e mover o bem andam juntos: um sem o outro deixaria
  // o bem em local errado ou a transferência eternamente pendente.
  aceitarTransferencia = async (
    id: string,
    bemId: string,
    localDestinoId: string,
    usuarioId: string,
  ): Promise<void> => {
    await executarEmTransacao(async (tx) => {
      await tx.query(SQL.fecharTransferencia, [id, "ACEITA", usuarioId]);
      await tx.query(SQL.moverBem, [bemId, localDestinoId]);
    });
  };

  recusarTransferencia = async (id: string, usuarioId: string): Promise<void> => {
    await pool.query(SQL.fecharTransferencia, [id, "RECUSADA", usuarioId]);
  };

  listarBaixas = async (orgaoId: string, paginacao: Paginacao): Promise<Pagina<BaixaResumo>> => {
    const { rows } = await pool.query(SQL.listarBaixas, [
      orgaoId, paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    return montarPagina(rows, paginacao);
  };

  buscarBaixa = async (orgaoId: string, bemId: string): Promise<BaixaResumo | null> => {
    const { rows } = await pool.query(SQL.buscarBaixa, [orgaoId, bemId]);
    return rows[0] ?? null;
  };

  registrarBaixa = async (orgaoId: string, dados: NovaBaixa): Promise<void> => {
    await executarEmTransacao(async (tx) => {
      await tx.query(SQL.registrarBaixa, [
        dados.bemId, dados.motivo, dados.observacao ?? null, dados.usuarioId,
      ]);
      await tx.query(SQL.baixarBem, [orgaoId, dados.bemId]);
    });
  };

  listarInventarios = async (orgaoId: string): Promise<InventarioResumo[]> => {
    const { rows } = await pool.query(SQL.listarInventarios, [orgaoId]);
    return rows.map((linha) => comContagem(linha, ["conferidos", "esperados", "divergencias"]));
  };

  buscarInventario = async (orgaoId: string, id: string): Promise<InventarioResumo | null> => {
    const { rows } = await pool.query(SQL.buscarInventario, [orgaoId, id]);
    return rows[0] ? comContagem(rows[0], ["conferidos", "esperados", "divergencias"]) : null;
  };

  inventarioAbertoNoLocal = async (orgaoId: string, localId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.inventarioAberto, [orgaoId, localId]);
    return (rowCount ?? 0) > 0;
  };

  abrirInventario = async (dados: NovoInventario): Promise<string> => {
    const { rows } = await pool.query(SQL.abrirInventario, [dados.localId, dados.dataInicio]);
    return rows[0].id;
  };

  itensDoInventario = async (orgaoId: string, inventarioId: string): Promise<ItemDeInventario[]> => {
    const { rows } = await pool.query(SQL.itensDoInventario, [orgaoId, inventarioId]);
    return rows;
  };

  registrarConferencia = async (inventarioId: string, item: ConferenciaDeItem): Promise<void> => {
    await pool.query(SQL.registrarConferencia, [
      inventarioId, item.bemId, item.situacao,
      item.estadoObservado ?? null, item.observacao ?? null,
    ]);
  };

  concluirInventario = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.concluirInventario, [orgaoId, id]);
  };
}
