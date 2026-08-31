import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  AlcanceDeConsulta, AlcanceDoSetor,
  Almoxarifado, AlmoxarifadoRepository, ConfiguracaoDoAlmoxarifado,
  ConfirmacaoDeRecebimento, DisponibilidadeDeProduto, LiberacaoParaConferir,
  LocalDeEstoque, LoteComSaldo, LoteDaRemessa, NovaLiberacao, NovaRemessa,
  NovaSolicitacaoEstoque, NovoLote, Produto, RemessaResumo, SolicitacaoEstoque,
  SolicitacaoResumo, TipoDeEstoque,
  AjusteResumo, ConsumoRegistrado, DevolucaoResumo, LoteBloqueado,
  NovaDevolucao, NovaTransferencia, NovoAjuste, NovoConsumo, TransferenciaResumo,
} from "../../application/ports/AlmoxarifadoRepository";

/**
 * `lote`, `solicitacao_estoque`, `liberacao_lote` e `estoque_local` não têm
 * `orgao_id` próprio — alcançam o órgão por join na remessa, no almoxarifado ou
 * no local. Toda consulta daqui amarra por esse caminho: um `WHERE id = $1`
 * solitário deixaria uma prefeitura mexer no estoque de outra.
 */

const COLUNAS_SOLICITACAO = `
  s.id, s.local_solicitante_id AS "localSolicitanteId",
  l.nome AS "localSolicitanteNome", l.almoxarifado_id AS "almoxarifadoId",
  u.nome AS "autorNome",
  s.tipo_estoque_id AS "tipoEstoqueId", te.nome AS "tipoEstoqueNome",
  s.status, s.data, s.enviada_em AS "enviadaEm",
  s.reserva_expira_em AS "reservaExpiraEm",
  s.liberada_em AS "liberadaEm", s.recebida_em AS "recebidaEm",
  s.motivo_recusa AS "motivoRecusa"`;

const SQL = {
  /**
   * O alcance de quem é lotado em setor, nas duas moedas que o `WHERE` aceita.
   *
   * `setor_id IS NULL` no almoxarifado e `almoxarifado_id IS NULL` no local
   * entram para qualquer setor: são os registros que ninguém classificou
   * ainda, e a migration que criou as colunas não podia tirá-los de quem já os
   * opera.
   *
   * Fica **dentro** de `SQL` de propósito. Como constante solta lá em cima ela
   * ficava fora do alcance do extrator estático, e o verificador de migrations
   * a deixava passar sem `PREPARE` — 345 consultas conferidas antes e depois
   * de acrescentá-la foi o que denunciou.
   */
  alcanceDoSetor: `
  SELECT
    (SELECT coalesce(array_agg(a.id), '{}') FROM almoxarifado a
      WHERE a.orgao_id = $1 AND (a.setor_id IS NULL OR a.setor_id = ANY($2)))
      AS almoxarifados,
    (SELECT coalesce(array_agg(lo.id), '{}') FROM local lo
      WHERE lo.orgao_id = $1
        AND (lo.almoxarifado_id IS NULL OR lo.almoxarifado_id IN (
              SELECT a2.id FROM almoxarifado a2
               WHERE a2.orgao_id = $1
                 AND (a2.setor_id IS NULL OR a2.setor_id = ANY($2)))))
      AS locais`,
  // ---- Cadastros -----------------------------------------------------------
  listarAlmoxarifados: `
    SELECT a.id, a.nome, a.ativo,
           (SELECT count(*) FROM local l WHERE l.almoxarifado_id = a.id) AS locais,
           (SELECT count(*) FROM remessa_estoque r WHERE r.almoxarifado_id = a.id) AS remessas
      FROM almoxarifado a
     WHERE a.orgao_id = $1
     ORDER BY a.nome`,
  criarAlmoxarifado: `
    INSERT INTO almoxarifado (orgao_id, nome) VALUES ($1, $2) RETURNING id`,
  atualizarAlmoxarifado: `
    UPDATE almoxarifado SET nome = $3, ativo = $4 WHERE orgao_id = $1 AND id = $2`,
  removerAlmoxarifado: `DELETE FROM almoxarifado WHERE orgao_id = $1 AND id = $2`,

  listarTipos: `
    SELECT t.id, t.nome, t.ativo,
           (SELECT count(*) FROM remessa_estoque r WHERE r.tipo_estoque_id = t.id) AS remessas
      FROM tipo_estoque t
     WHERE t.orgao_id = $1
     ORDER BY t.nome`,
  criarTipo: `INSERT INTO tipo_estoque (orgao_id, nome) VALUES ($1, $2) RETURNING id`,
  atualizarTipo: `
    UPDATE tipo_estoque SET nome = $3, ativo = $4 WHERE orgao_id = $1 AND id = $2`,
  removerTipo: `DELETE FROM tipo_estoque WHERE orgao_id = $1 AND id = $2`,

  // Catálogo global: sem orgao_id, como `fornecedor`.
  listarProdutos: `
    SELECT id, nome, unidade_medida AS "unidadeMedida", ativo
      FROM produto
     WHERE ativo AND ($1::text IS NULL OR nome ILIKE '%' || $1 || '%')
     ORDER BY nome
     LIMIT 500`,
  garantirProduto: `
    INSERT INTO produto (nome, unidade_medida) VALUES ($1, $2)
    ON CONFLICT (nome, unidade_medida) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id`,

  buscarConfiguracao: `
    SELECT reserva_ativa AS "reservaAtiva",
           reserva_prazo_horas AS "reservaPrazoHoras",
           alerta_validade_dias AS "alertaValidadeDias"
      FROM almoxarifado_config WHERE orgao_id = $1`,
  salvarConfiguracao: `
    INSERT INTO almoxarifado_config
      (orgao_id, reserva_ativa, reserva_prazo_horas, alerta_validade_dias)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (orgao_id) DO UPDATE
      SET reserva_ativa = EXCLUDED.reserva_ativa,
          reserva_prazo_horas = EXCLUDED.reserva_prazo_horas,
          alerta_validade_dias = EXCLUDED.alerta_validade_dias`,

  listarLocais: `
    SELECT l.id, l.nome, l.codigo, l.unidade_id AS "unidadeId",
           l.almoxarifado_id AS "almoxarifadoId", a.nome AS "almoxarifadoNome",
           l.cnpj, l.endereco, l.responsavel, l.ativo
      FROM local l
      LEFT JOIN almoxarifado a ON a.id = l.almoxarifado_id
     WHERE l.orgao_id = $1
       -- Inativo some dos seletores e aparece na tela de cadastro: sem isto,
       -- inativar por engano só teria volta por dentro do banco.
       AND (l.ativo OR $4)
       AND ($2::uuid IS NULL OR l.almoxarifado_id = $2)
       AND ($3::uuid[] IS NULL OR l.id = ANY($3))
     ORDER BY l.ativo DESC, l.nome`,
  buscarLocal: `
    SELECT l.id, l.nome, l.codigo, l.unidade_id AS "unidadeId",
           l.almoxarifado_id AS "almoxarifadoId", a.nome AS "almoxarifadoNome",
           l.cnpj, l.endereco, l.responsavel
      FROM local l
      LEFT JOIN almoxarifado a ON a.id = l.almoxarifado_id
     WHERE l.orgao_id = $1 AND l.id = $2
       AND ($3::uuid[] IS NULL OR l.id = ANY($3))`,
  /**
   * A escola nasce aqui quando a prefeitura não comprou o patrimônio.
   *
   * Mesma tabela `local` que o patrimônio usa — é um local físico, e o mesmo
   * prédio guarda bem tombado e estoque. Tabela própria faria a escola existir
   * duas vezes, com dois CNPJs livres para divergir bem no dado que o PNAE
   * cobra.
   */
  criarLocal: `
    INSERT INTO local (orgao_id, codigo, nome, almoxarifado_id, unidade_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING id`,

  renomearLocal: `
    UPDATE local SET nome = $3, codigo = $4
     WHERE orgao_id = $1 AND id = $2`,

  /**
   * Inativa, nunca apaga.
   *
   * O local aparece em pedido, entrega, consumo e relatório de anos anteriores;
   * apagá-lo levaria a prestação de contas junto. Inativo some das listas de
   * escolha e continua nomeando o passado.
   */
  definirSituacaoDoLocal: `
    UPDATE local SET ativo = $3 WHERE orgao_id = $1 AND id = $2`,

  codigoDeLocalEmUso: `
    SELECT 1 FROM local
     WHERE orgao_id = $1 AND codigo = $2
       AND id <> coalesce($3, '00000000-0000-0000-0000-000000000000'::uuid)`,

  salvarDadosDoLocal: `
    UPDATE local
       SET almoxarifado_id = $3, cnpj = $4, endereco = $5, bairro = $6,
           municipio = $7, uf = $8, cep = $9, telefone = $10, email = $11,
           responsavel = $12
     WHERE orgao_id = $1 AND id = $2`,

  // ---- Entrada -------------------------------------------------------------
  listarRemessas: `
    SELECT r.id, r.codigo, r.titulo, r.data,
           a.nome AS "almoxarifadoNome", te.nome AS "tipoEstoqueNome",
           r.local_armazenado AS "localArmazenado", r.nota_fiscal AS "notaFiscal",
           f.razao_social AS "fornecedorRazaoSocial",
           coalesce(u.nome, '—') AS "responsavelNome",
           (SELECT count(*) FROM lote lo WHERE lo.remessa_id = r.id) AS lotes,
           ${TOTAL_DA_JANELA}
      FROM remessa_estoque r
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
      JOIN tipo_estoque te ON te.id = r.tipo_estoque_id
      LEFT JOIN usuario u ON u.id = r.responsavel_usuario_id
      LEFT JOIN fornecedor f ON f.id = r.fornecedor_id
     WHERE a.orgao_id = $1
       AND ($4::uuid IS NULL OR r.almoxarifado_id = $4)
       AND ($5::uuid IS NULL OR r.tipo_estoque_id = $5)
       AND ($6::text IS NULL
            OR r.codigo ILIKE '%' || $6 || '%'
            OR r.titulo ILIKE '%' || $6 || '%')
     ORDER BY r.data DESC, r.id
     LIMIT $2 OFFSET $3`,
  buscarRemessa: `
    SELECT r.id, r.codigo, r.titulo, r.data,
           a.nome AS "almoxarifadoNome", te.nome AS "tipoEstoqueNome",
           r.local_armazenado AS "localArmazenado", r.nota_fiscal AS "notaFiscal",
           f.razao_social AS "fornecedorRazaoSocial",
           coalesce(u.nome, '—') AS "responsavelNome",
           (SELECT count(*) FROM lote lo WHERE lo.remessa_id = r.id) AS lotes
      FROM remessa_estoque r
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
      JOIN tipo_estoque te ON te.id = r.tipo_estoque_id
      LEFT JOIN usuario u ON u.id = r.responsavel_usuario_id
      LEFT JOIN fornecedor f ON f.id = r.fornecedor_id
     WHERE a.orgao_id = $1 AND r.id = $2`,
  lotesDaRemessa: `
    SELECT lo.id, lo.produto_id AS "produtoId", p.nome AS "produtoNome",
           p.unidade_medida AS "unidadeMedida",
           lo.quantidade, lo.saldo, lo.data_validade AS "dataValidade"
      FROM lote lo
      JOIN produto p ON p.id = lo.produto_id
     WHERE lo.remessa_id = $1
     ORDER BY lo.data_validade NULLS LAST, p.nome`,
  criarRemessa: `
    INSERT INTO remessa_estoque
      (almoxarifado_id, codigo, titulo, data, local_armazenado, tipo_estoque_id,
       responsavel_usuario_id, nota_fiscal, fornecedor_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
  codigoEmUso: `
    SELECT 1 FROM remessa_estoque r
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
     WHERE a.orgao_id = $1 AND r.almoxarifado_id = $2 AND r.codigo = $3`,
  adicionarLote: `
    INSERT INTO lote (remessa_id, produto_id, quantidade, saldo, data_validade)
    SELECT $2, $3, $4, $4, $5
      FROM remessa_estoque r
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
     WHERE a.orgao_id = $1 AND r.id = $2
    RETURNING id`,
  removerLote: `
    DELETE FROM lote
     WHERE id = $2
       AND remessa_id IN (
             SELECT r.id FROM remessa_estoque r
               JOIN almoxarifado a ON a.id = r.almoxarifado_id
              WHERE a.orgao_id = $1)`,
  loteTemMovimento: `
    SELECT 1
      FROM liberacao_lote ll
      JOIN lote lo ON lo.id = ll.lote_id
      JOIN remessa_estoque r ON r.id = lo.remessa_id
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
     WHERE a.orgao_id = $1 AND ll.lote_id = $2
     LIMIT 1`,

  // ---- Disponibilidade -----------------------------------------------------
  // Saldo do almoxarifado menos o que outras solicitações já reservaram. As
  // duas contas olham o MESMO almoxarifado: no legado a reserva era por unidade
  // e o saldo somava o órgão inteiro, e duas escolas não se enxergavam.
  listarDisponiveis: `
    SELECT p.id AS "produtoId", p.nome, p.unidade_medida AS "unidadeMedida",
           sum(lo.saldo) AS "saldoTotal",
           coalesce((
             SELECT sum(si.quantidade_reservada)
               FROM solicitacao_estoque_item si
               JOIN solicitacao_estoque s ON s.id = si.solicitacao_id
               JOIN local l ON l.id = s.local_solicitante_id
              WHERE si.produto_id = p.id
                AND l.almoxarifado_id = $2
                AND s.status = 'SOLICITADA'
           ), 0) AS reservado,
           min(lo.data_validade) AS "proximaValidade"
      FROM lote lo
      JOIN produto p ON p.id = lo.produto_id
      JOIN remessa_estoque r ON r.id = lo.remessa_id
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
     WHERE a.orgao_id = $1 AND a.id = $2 AND lo.saldo > 0
       AND ($3::uuid IS NULL OR r.tipo_estoque_id = $3)
     GROUP BY p.id, p.nome, p.unidade_medida
     ORDER BY p.nome`,

  // ---- Solicitação ---------------------------------------------------------
  listarSolicitacoes: `
    SELECT ${COLUNAS_SOLICITACAO},
           (SELECT count(*) FROM solicitacao_estoque_item si
             WHERE si.solicitacao_id = s.id) AS "totalItens",
           ${TOTAL_DA_JANELA}
      FROM solicitacao_estoque s
      JOIN local l ON l.id = s.local_solicitante_id
      JOIN usuario u ON u.id = s.autor_usuario_id
      LEFT JOIN tipo_estoque te ON te.id = s.tipo_estoque_id
     WHERE l.orgao_id = $1
       AND ($4::text IS NULL OR s.status = $4)
       AND ($5::uuid IS NULL OR s.local_solicitante_id = $5)
       AND ($6::uuid IS NULL OR l.almoxarifado_id = $6)
       AND ($7::uuid[] IS NULL OR s.local_solicitante_id = ANY($7))
     ORDER BY s.data DESC, s.id
     LIMIT $2 OFFSET $3`,
  buscarSolicitacao: `
    SELECT ${COLUNAS_SOLICITACAO}
      FROM solicitacao_estoque s
      JOIN local l ON l.id = s.local_solicitante_id
      JOIN usuario u ON u.id = s.autor_usuario_id
      LEFT JOIN tipo_estoque te ON te.id = s.tipo_estoque_id
     WHERE l.orgao_id = $1 AND s.id = $2
       AND ($3::uuid[] IS NULL OR s.local_solicitante_id = ANY($3))`,
  itensDaSolicitacao: `
    SELECT si.id, si.produto_id AS "produtoId", p.nome AS "produtoNome",
           p.unidade_medida AS "unidadeMedida",
           si.quantidade_solicitada AS "quantidadeSolicitada",
           si.quantidade_reservada AS "quantidadeReservada",
           si.saldo_da_unidade_no_momento AS "saldoDaUnidadeNoMomento",
           si.quantidade_liberada AS "quantidadeLiberada",
           si.quantidade_recebida AS "quantidadeRecebida"
      FROM solicitacao_estoque_item si
      JOIN produto p ON p.id = si.produto_id
     WHERE si.solicitacao_id = $1
     ORDER BY p.nome`,
  criarSolicitacao: `
    INSERT INTO solicitacao_estoque
      (local_solicitante_id, autor_usuario_id, tipo_estoque_id, status)
    SELECT $2, $3, $4, 'RASCUNHO' FROM local l WHERE l.orgao_id = $1 AND l.id = $2
    RETURNING id`,
  apagarItens: `
    DELETE FROM solicitacao_estoque_item
     WHERE solicitacao_id = $2
       AND solicitacao_id IN (
             SELECT s.id FROM solicitacao_estoque s
               JOIN local l ON l.id = s.local_solicitante_id
              WHERE l.orgao_id = $1)`,
  inserirItem: `
    INSERT INTO solicitacao_estoque_item
      (solicitacao_id, produto_id, quantidade_solicitada)
    VALUES ($1, $2, $3)`,
  removerSolicitacao: `
    DELETE FROM solicitacao_estoque
     WHERE id = $2 AND status = 'RASCUNHO'
       AND local_solicitante_id IN (
             SELECT l.id FROM local l WHERE l.orgao_id = $1)`,

  // ---- Saldo e reserva -----------------------------------------------------
  lotesComSaldo: `
    SELECT lo.id, lo.produto_id AS "produtoId", lo.saldo,
           lo.data_validade AS "dataValidade",
           r.codigo AS "remessaCodigo", a.nome AS "almoxarifadoNome"
      FROM lote lo
      JOIN remessa_estoque r ON r.id = lo.remessa_id
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
     WHERE a.orgao_id = $1 AND a.id = $2
       AND lo.produto_id = ANY($3::uuid[]) AND lo.saldo > 0
     ORDER BY lo.data_validade NULLS LAST, lo.id`,
  // `FOR UPDATE OF lo`: trava só a linha do lote. Sem o `OF`, o Postgres
  // travaria também remessa e almoxarifado, e duas entradas em almoxarifados
  // diferentes esperariam uma pela outra sem motivo.
  bloquearLotes: `
    SELECT lo.id, lo.produto_id AS "produtoId", lo.saldo,
           lo.data_validade AS "dataValidade",
           r.codigo AS "remessaCodigo", a.nome AS "almoxarifadoNome"
      FROM lote lo
      JOIN remessa_estoque r ON r.id = lo.remessa_id
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
     WHERE a.orgao_id = $1 AND a.id = $2
       AND lo.produto_id = ANY($3::uuid[]) AND lo.saldo > 0
     ORDER BY lo.data_validade NULLS LAST, lo.id
       FOR UPDATE OF lo`,
  reservasPorProduto: `
    SELECT si.produto_id AS "produtoId", sum(si.quantidade_reservada) AS reservado
      FROM solicitacao_estoque_item si
      JOIN solicitacao_estoque s ON s.id = si.solicitacao_id
      JOIN local l ON l.id = s.local_solicitante_id
     WHERE l.orgao_id = $1 AND l.almoxarifado_id = $2
       AND si.produto_id = ANY($3::uuid[])
       AND s.status = 'SOLICITADA'
     GROUP BY si.produto_id`,
  marcarEnviada: `
    UPDATE solicitacao_estoque s
       SET status = 'SOLICITADA', enviada_em = now(), reserva_expira_em = $3
      FROM local l
     WHERE s.id = $2 AND l.id = s.local_solicitante_id AND l.orgao_id = $1
       AND s.status = 'RASCUNHO'`,
  reservarItem: `
    UPDATE solicitacao_estoque_item SET quantidade_reservada = $2 WHERE id = $1`,

  // ---- Liberação -----------------------------------------------------------
  debitarLote: `UPDATE lote SET saldo = saldo - $2 WHERE id = $1`,
  inserirLiberacao: `
    INSERT INTO liberacao_lote (solicitacao_item_id, lote_id, quantidade)
    VALUES ($1, $2, $3)`,
  // Baixa a reserva junto: era o que o legado esquecia, deixando o material
  // reservado e debitado ao mesmo tempo.
  liberarItem: `
    UPDATE solicitacao_estoque_item
       SET quantidade_liberada = $2, quantidade_reservada = 0
     WHERE id = $1`,
  marcarLiberada: `
    UPDATE solicitacao_estoque s
       SET status = 'LIBERADA', liberada_em = now(), liberada_por_usuario_id = $3
      FROM local l
     WHERE s.id = $2 AND l.id = s.local_solicitante_id AND l.orgao_id = $1
       AND s.status = 'SOLICITADA'`,
  zerarReservaDaSolicitacao: `
    UPDATE solicitacao_estoque_item SET quantidade_reservada = 0
     WHERE solicitacao_id = $1`,
  recusar: `
    UPDATE solicitacao_estoque s
       SET status = 'RECUSADA', motivo_recusa = $4,
           liberada_por_usuario_id = $3, liberada_em = now()
      FROM local l
     WHERE s.id = $2 AND l.id = s.local_solicitante_id AND l.orgao_id = $1
       AND s.status = 'SOLICITADA'`,
  cancelar: `
    UPDATE solicitacao_estoque s
       SET status = 'CANCELADA'
      FROM local l
     WHERE s.id = $2 AND l.id = s.local_solicitante_id AND l.orgao_id = $1
       AND s.status IN ('RASCUNHO', 'SOLICITADA')`,

  // ---- Recebimento ---------------------------------------------------------
  listarLiberacoes: `
    SELECT ll.id, ll.solicitacao_item_id AS "solicitacaoItemId", ll.lote_id AS "loteId",
           si.produto_id AS "produtoId", p.nome AS "produtoNome",
           p.unidade_medida AS "unidadeMedida",
           ll.quantidade, ll.quantidade_confirmada AS "quantidadeConfirmada",
           lo.data_validade AS "dataValidade", r.codigo AS "remessaCodigo"
      FROM liberacao_lote ll
      JOIN solicitacao_estoque_item si ON si.id = ll.solicitacao_item_id
      JOIN solicitacao_estoque s ON s.id = si.solicitacao_id
      JOIN local l ON l.id = s.local_solicitante_id
      JOIN produto p ON p.id = si.produto_id
      JOIN lote lo ON lo.id = ll.lote_id
      JOIN remessa_estoque r ON r.id = lo.remessa_id
     WHERE l.orgao_id = $1 AND s.id = $2
     ORDER BY p.nome, lo.data_validade NULLS LAST`,
  confirmarLiberacao: `
    UPDATE liberacao_lote
       SET quantidade_confirmada = $2,
           quantidade_perdida = quantidade - $2,
           motivo_perda = $3, observacao_perda = $4, confirmada_em = now()
     WHERE id = $1`,
  // O lote nasce na unidade com a validade copiada da origem: é o que permite
  // à escola consumir em FEFO o que está no armário dela.
  // O `::numeric` explícito é obrigatório: `$2` aparece como valor inserido e
  // como comparação, e sem o cast o Postgres recusa com "inconsistent types
  // deduced for parameter $2" — em tempo de execução, no meio do recebimento.
  creditarEstoqueLocal: `
    INSERT INTO estoque_local
      (local_id, produto_id, lote_origem_id, liberacao_lote_id,
       quantidade_recebida, saldo, data_validade, data_entrada)
    SELECT s.local_solicitante_id, si.produto_id, ll.lote_id, ll.id,
           $2::numeric, $2::numeric, lo.data_validade, current_date
      FROM liberacao_lote ll
      JOIN solicitacao_estoque_item si ON si.id = ll.solicitacao_item_id
      JOIN solicitacao_estoque s ON s.id = si.solicitacao_id
      JOIN lote lo ON lo.id = ll.lote_id
     WHERE ll.id = $1 AND $2::numeric > 0`,
  totalRecebidoPorItem: `
    UPDATE solicitacao_estoque_item si
       SET quantidade_recebida = (
             SELECT coalesce(sum(ll.quantidade_confirmada), 0)
               FROM liberacao_lote ll WHERE ll.solicitacao_item_id = si.id)
     WHERE si.solicitacao_id = $1`,
  marcarRecebida: `
    UPDATE solicitacao_estoque s
       SET status = 'RECEBIDA', recebida_em = now(), recebida_por_usuario_id = $3
      FROM local l
     WHERE s.id = $2 AND l.id = s.local_solicitante_id AND l.orgao_id = $1
       AND s.status IN ('LIBERADA', 'EM_TRANSITO')`,

  // ---- Expiração da reserva ------------------------------------------------
  expirarReservas: `
    UPDATE solicitacao_estoque
       SET status = 'EXPIRADA'
     WHERE status = 'SOLICITADA'
       AND reserva_expira_em IS NOT NULL
       AND reserva_expira_em < now()
    RETURNING id`,
  zerarReservasExpiradas: `
    UPDATE solicitacao_estoque_item SET quantidade_reservada = 0
     WHERE solicitacao_id = ANY($1::uuid[])`,

  // ---- Estoque da unidade --------------------------------------------------
  estoqueDoLocal: `
    SELECT el.produto_id AS "produtoId", p.nome AS "produtoNome",
           p.unidade_medida AS "unidadeMedida",
           el.id, el.saldo, el.data_validade AS "dataValidade",
           el.data_entrada AS "dataEntrada"
      FROM estoque_local el
      JOIN produto p ON p.id = el.produto_id
      JOIN local l ON l.id = el.local_id
     WHERE l.orgao_id = $1 AND el.local_id = $2 AND el.saldo > 0
       AND ($3::uuid[] IS NULL OR el.local_id = ANY($3))
     ORDER BY p.nome, el.data_validade NULLS LAST`,

  // ---- Movimento -----------------------------------------------------------
  buscarAlmoxarifado: `
    SELECT a.id, a.nome, a.ativo,
           (SELECT count(*) FROM local l WHERE l.almoxarifado_id = a.id) AS locais,
           (SELECT count(*) FROM remessa_estoque r WHERE r.almoxarifado_id = a.id) AS remessas
      FROM almoxarifado a
     WHERE a.orgao_id = $1 AND a.id = $2`,

  lotesDoAlmoxarifado: `
    SELECT lo.id, lo.produto_id AS "produtoId", p.nome AS "produtoNome",
           p.unidade_medida AS "unidadeMedida",
           lo.quantidade, lo.saldo, lo.data_validade AS "dataValidade",
           r.codigo AS "remessaCodigo"
      FROM lote lo
      JOIN remessa_estoque r ON r.id = lo.remessa_id
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
      JOIN produto p ON p.id = lo.produto_id
     WHERE a.orgao_id = $1 AND a.id = $2 AND lo.saldo > 0
     ORDER BY p.nome, lo.data_validade NULLS LAST`,

  // FEFO no armário da escola, travado para escrita. `FOR UPDATE OF el` trava
  // só a linha do estoque; sem o `OF`, o local e o produto entrariam junto.
  bloquearEstoqueLocal: `
    SELECT el.id, el.saldo, el.data_validade AS "dataValidade"
      FROM estoque_local el
      JOIN local l ON l.id = el.local_id
     WHERE l.orgao_id = $1 AND el.local_id = $2 AND el.produto_id = $3
       AND el.saldo > 0
     ORDER BY el.data_validade NULLS LAST, el.id
       FOR UPDATE OF el`,

  bloquearLoteDaUnidade: `
    SELECT el.id, el.produto_id AS "produtoId", p.nome AS "produtoNome",
           el.saldo, el.quantidade_recebida AS "tetoDoLote",
           el.local_id AS "localId", l.almoxarifado_id AS "almoxarifadoId"
      FROM estoque_local el
      JOIN local l ON l.id = el.local_id
      JOIN produto p ON p.id = el.produto_id
     WHERE l.orgao_id = $1 AND el.id = $2
       FOR UPDATE OF el`,

  bloquearLotePorId: `
    SELECT lo.id, lo.produto_id AS "produtoId", p.nome AS "produtoNome",
           lo.saldo, NULL::numeric AS "tetoDoLote",
           NULL::uuid AS "localId", a.id AS "almoxarifadoId"
      FROM lote lo
      JOIN remessa_estoque r ON r.id = lo.remessa_id
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
      JOIN produto p ON p.id = lo.produto_id
     WHERE a.orgao_id = $1 AND lo.id = $2
       FOR UPDATE OF lo`,

  criarConsumo: `
    INSERT INTO consumo
      (local_id, produto_id, quantidade, forma, periodo_inicio, periodo_fim,
       usuario_id, observacao)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
  criarConsumoLote: `
    INSERT INTO consumo_lote (consumo_id, estoque_local_id, quantidade)
    VALUES ($1, $2, $3)`,
  debitarEstoqueLocal: `
    UPDATE estoque_local SET saldo = saldo - $2 WHERE id = $1`,

  listarConsumo: `
    SELECT c.id, p.nome AS "produtoNome", p.unidade_medida AS "unidadeMedida",
           c.quantidade, c.forma,
           c.periodo_inicio AS "periodoInicio", c.periodo_fim AS "periodoFim",
           c.data, coalesce(u.nome, '—') AS "usuarioNome", c.observacao,
           (SELECT count(*) FROM consumo_lote cl WHERE cl.consumo_id = c.id) AS lotes,
           ${TOTAL_DA_JANELA}
      FROM consumo c
      JOIN local l ON l.id = c.local_id
      JOIN produto p ON p.id = c.produto_id
      LEFT JOIN usuario u ON u.id = c.usuario_id
     WHERE l.orgao_id = $1
       AND ($4::uuid IS NULL OR c.local_id = $4)
       AND ($5::uuid IS NULL OR c.produto_id = $5)
       AND ($6::date IS NULL OR c.data >= $6)
       AND ($7::date IS NULL OR c.data <= $7)
       AND ($8::uuid[] IS NULL OR c.local_id = ANY($8))
     ORDER BY c.data DESC, c.id
     LIMIT $2 OFFSET $3`,

  criarDevolucao: `
    INSERT INTO devolucao
      (local_id, almoxarifado_id, produto_id, estoque_local_id, quantidade,
       motivo, solicitada_por_usuario_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,

  bloquearDevolucao: `
    SELECT d.id, l.nome AS "localNome", a.nome AS "almoxarifadoNome",
           p.nome AS "produtoNome", p.unidade_medida AS "unidadeMedida",
           d.quantidade, d.status, d.motivo, d.recusa_motivo AS "recusaMotivo",
           coalesce(us.nome, '—') AS "solicitadaPor",
           ua.nome AS "aceitaPor",
           el.data_validade AS "dataValidade",
           d.data, d.respondida_em AS "respondidaEm",
           d.estoque_local_id AS "estoqueLocalId"
      FROM devolucao d
      JOIN local l ON l.id = d.local_id
      JOIN almoxarifado a ON a.id = d.almoxarifado_id
      JOIN produto p ON p.id = d.produto_id
      LEFT JOIN estoque_local el ON el.id = d.estoque_local_id
      LEFT JOIN usuario us ON us.id = d.solicitada_por_usuario_id
      LEFT JOIN usuario ua ON ua.id = d.aceito_por_usuario_id
     WHERE l.orgao_id = $1 AND d.id = $2
       FOR UPDATE OF d`,

  // Só o que a resposta precisa saber, travado. A consulta completa serve à
  // tela; esta serve à escrita.
  bloquearDevolucaoSimples: `
    SELECT d.estoque_local_id AS "estoqueLocalId", d.quantidade, d.status,
           el.lote_origem_id AS "loteOrigemId"
      FROM devolucao d
      LEFT JOIN estoque_local el ON el.id = d.estoque_local_id
     WHERE d.id = $1
       FOR UPDATE OF d`,

  devolverSaldoAUnidade: `
    UPDATE estoque_local SET saldo = saldo + $2 WHERE id = $1`,

  responderDevolucao: `
    UPDATE devolucao
       SET status = CASE WHEN $3 THEN 'ACEITA' ELSE 'RECUSADA' END,
           aceito_por_usuario_id = $2,
           recusa_motivo = $4,
           respondida_em = now()
     WHERE id = $1 AND status = 'PENDENTE'`,

  // Aceite: o material volta ao lote de ORIGEM no almoxarifado, preservando a
  // validade. Criar lote novo duplicaria a mesma caixa no estoque.
  //
  // Um UPDATE simples, e não um `UPDATE ... FROM ... JOIN`: o id do lote já
  // veio travado na leitura, e a versão com join precisava qualificar
  // `lote.saldo` para não colidir com o `saldo` de `estoque_local`.
  creditarLoteDeOrigem: `UPDATE lote SET saldo = saldo + $2 WHERE id = $1`,

  listarDevolucoes: `
    SELECT d.id, l.nome AS "localNome", a.nome AS "almoxarifadoNome",
           p.nome AS "produtoNome", p.unidade_medida AS "unidadeMedida",
           d.quantidade, d.status, d.motivo, d.recusa_motivo AS "recusaMotivo",
           coalesce(us.nome, '—') AS "solicitadaPor",
           ua.nome AS "aceitaPor",
           el.data_validade AS "dataValidade",
           d.data, d.respondida_em AS "respondidaEm",
           ${TOTAL_DA_JANELA}
      FROM devolucao d
      JOIN local l ON l.id = d.local_id
      JOIN almoxarifado a ON a.id = d.almoxarifado_id
      JOIN produto p ON p.id = d.produto_id
      LEFT JOIN estoque_local el ON el.id = d.estoque_local_id
      LEFT JOIN usuario us ON us.id = d.solicitada_por_usuario_id
      LEFT JOIN usuario ua ON ua.id = d.aceito_por_usuario_id
     WHERE l.orgao_id = $1
       AND ($4::text IS NULL OR d.status = $4)
       AND ($5::uuid IS NULL OR d.almoxarifado_id = $5)
       AND ($6::uuid IS NULL OR d.local_id = $6)
       AND ($7::uuid[] IS NULL OR d.local_id = ANY($7))
     ORDER BY d.data DESC, d.id
     LIMIT $2 OFFSET $3`,

  criarTransferencia: `
    INSERT INTO transferencia_almoxarifado
      (almoxarifado_origem_id, almoxarifado_destino_id, lote_id, quantidade,
       usuario_id, motivo)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`,

  // A remessa de transferência nasce no destino com o tipo de estoque do lote
  // de origem: mudar de categoria no caminho esconderia o material da tela que
  // o procura.
  criarRemessaDeTransferencia: `
    INSERT INTO remessa_estoque
      (almoxarifado_id, codigo, titulo, data, tipo_estoque_id,
       responsavel_usuario_id, transferencia_id, local_armazenado)
    SELECT $2::uuid,
           -- Cast explícito nos dois lugares: $1 aparece como valor de uma
           -- coluna uuid E dentro de substr, e sem ele o Postgres o deduz como
           -- texto e recusa a gravação.
           'TR-' || upper(substr($1::uuid::text, 1, 8)),
           'Transferência de ' || ao.nome,
           current_date,
           r.tipo_estoque_id,
           $3::uuid,
           $1::uuid,
           'Recebido por transferência'
      FROM lote lo
      JOIN remessa_estoque r ON r.id = lo.remessa_id
      JOIN almoxarifado ao ON ao.id = r.almoxarifado_id
     WHERE lo.id = $4
    RETURNING id`,

  criarLoteDeTransferencia: `
    INSERT INTO lote (remessa_id, produto_id, quantidade, saldo, data_validade, lote_origem_id)
    SELECT $1, lo.produto_id, $3, $3, lo.data_validade, lo.id
      FROM lote lo WHERE lo.id = $2
    RETURNING id`,

  listarTransferencias: `
    SELECT t.id, p.nome AS "produtoNome", p.unidade_medida AS "unidadeMedida",
           t.quantidade, ao.nome AS "origemNome", ad.nome AS "destinoNome",
           coalesce(u.nome, '—') AS "usuarioNome", t.motivo,
           lo.data_validade AS "dataValidade", t.data,
           ${TOTAL_DA_JANELA}
      FROM transferencia_almoxarifado t
      JOIN almoxarifado ao ON ao.id = t.almoxarifado_origem_id
      JOIN almoxarifado ad ON ad.id = t.almoxarifado_destino_id
      JOIN lote lo ON lo.id = t.lote_id
      JOIN produto p ON p.id = lo.produto_id
      LEFT JOIN usuario u ON u.id = t.usuario_id
     WHERE ao.orgao_id = $1
       AND ($4::uuid IS NULL
            OR t.almoxarifado_origem_id = $4 OR t.almoxarifado_destino_id = $4)
     ORDER BY t.data DESC, t.id
     LIMIT $2 OFFSET $3`,

  criarAjuste: `
    INSERT INTO ajuste_estoque
      (almoxarifado_id, lote_id, estoque_local_id, saldo_anterior, saldo_corrigido,
       motivo, observacao, usuario_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,

  aplicarAjusteNoLote: `UPDATE lote SET saldo = $2 WHERE id = $1`,
  aplicarAjusteNaUnidade: `UPDATE estoque_local SET saldo = $2 WHERE id = $1`,

  listarAjustes: `
    SELECT aj.id,
           CASE WHEN aj.lote_id IS NULL THEN 'unidade' ELSE 'almoxarifado' END AS onde,
           p.nome AS "produtoNome", p.unidade_medida AS "unidadeMedida",
           aj.saldo_anterior AS "saldoAnterior", aj.saldo_corrigido AS "saldoCorrigido",
           aj.saldo_corrigido - aj.saldo_anterior AS diferenca,
           aj.motivo, aj.observacao,
           coalesce(u.nome, '—') AS "usuarioNome", aj.data,
           ${TOTAL_DA_JANELA}
      FROM ajuste_estoque aj
      LEFT JOIN lote lo ON lo.id = aj.lote_id
      LEFT JOIN estoque_local el ON el.id = aj.estoque_local_id
      LEFT JOIN local l ON l.id = el.local_id
      LEFT JOIN almoxarifado a ON a.id = aj.almoxarifado_id
      JOIN produto p ON p.id = coalesce(lo.produto_id, el.produto_id)
      LEFT JOIN usuario u ON u.id = aj.usuario_id
     WHERE coalesce(a.orgao_id, l.orgao_id) = $1
       AND ($4::uuid IS NULL OR aj.almoxarifado_id = $4)
       AND ($5::uuid IS NULL OR el.local_id = $5)
       AND ($6::uuid[] IS NULL OR el.local_id = ANY($6)
            OR ($7::uuid[] IS NOT NULL AND aj.almoxarifado_id = ANY($7)))
     ORDER BY aj.data DESC, aj.id
     LIMIT $2 OFFSET $3`,
};

const numero = (valor: unknown) => Number(valor ?? 0);

const executor = (tx?: Tx) => tx ?? pool;

export class PostgresAlmoxarifadoRepository implements AlmoxarifadoRepository {
  // ---- Cadastros -----------------------------------------------------------

  listarAlmoxarifados = async (orgaoId: string): Promise<Almoxarifado[]> => {
    const { rows } = await pool.query(SQL.listarAlmoxarifados, [orgaoId]);
    return rows.map((linha) => ({
      ...linha,
      locais: numero(linha.locais),
      remessas: numero(linha.remessas),
    })) as Almoxarifado[];
  };

  criarAlmoxarifado = async (orgaoId: string, nome: string): Promise<string> => {
    const { rows } = await pool.query(SQL.criarAlmoxarifado, [orgaoId, nome]);
    return rows[0].id as string;
  };

  atualizarAlmoxarifado = async (
    orgaoId: string, id: string, dados: { nome: string; ativo: boolean },
  ): Promise<void> => {
    await pool.query(SQL.atualizarAlmoxarifado, [orgaoId, id, dados.nome, dados.ativo]);
  };

  removerAlmoxarifado = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerAlmoxarifado, [orgaoId, id]);
  };

  listarTipos = async (orgaoId: string): Promise<TipoDeEstoque[]> => {
    const { rows } = await pool.query(SQL.listarTipos, [orgaoId]);
    return rows.map((linha) => ({ ...linha, remessas: numero(linha.remessas) })) as TipoDeEstoque[];
  };

  criarTipo = async (orgaoId: string, nome: string): Promise<string> => {
    const { rows } = await pool.query(SQL.criarTipo, [orgaoId, nome]);
    return rows[0].id as string;
  };

  atualizarTipo = async (
    orgaoId: string, id: string, dados: { nome: string; ativo: boolean },
  ): Promise<void> => {
    await pool.query(SQL.atualizarTipo, [orgaoId, id, dados.nome, dados.ativo]);
  };

  removerTipo = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerTipo, [orgaoId, id]);
  };

  listarProdutos = async (busca?: string): Promise<Produto[]> => {
    const { rows } = await pool.query(SQL.listarProdutos, [busca ?? null]);
    return rows as Produto[];
  };

  garantirProduto = async (nome: string, unidadeMedida: string, tx?: Tx): Promise<string> => {
    const { rows } = await executor(tx).query(SQL.garantirProduto, [nome, unidadeMedida]);
    return rows[0].id as string;
  };

  /** Sem linha de configuração, valem os padrões da migration. */
  buscarConfiguracao = async (orgaoId: string): Promise<ConfiguracaoDoAlmoxarifado> => {
    const { rows } = await pool.query(SQL.buscarConfiguracao, [orgaoId]);
    const config = rows[0];
    return {
      reservaAtiva: config?.reservaAtiva ?? true,
      reservaPrazoHoras: numero(config?.reservaPrazoHoras ?? 72),
      alertaValidadeDias: numero(config?.alertaValidadeDias ?? 30),
    };
  };

  salvarConfiguracao = async (
    orgaoId: string, dados: ConfiguracaoDoAlmoxarifado,
  ): Promise<void> => {
    await pool.query(SQL.salvarConfiguracao, [
      orgaoId, dados.reservaAtiva, dados.reservaPrazoHoras, dados.alertaValidadeDias,
    ]);
  };

  /**
   * Traduz "os almoxarifados do meu setor" nos ids que o `WHERE` entende.
   *
   * Uma consulta por requisição, e só para quem é lotado em setor: quem é da
   * escola já sabe os próprios locais, e quem não tem lotação não tem trava.
   */
  alcanceDoSetor = async (orgaoId: string, setores: string[]): Promise<AlcanceDoSetor> => {
    const { rows } = await pool.query(SQL.alcanceDoSetor, [orgaoId, setores]);
    const linha = rows[0] as { locais: string[] | null; almoxarifados: string[] | null };
    return { locais: linha?.locais ?? [], almoxarifados: linha?.almoxarifados ?? [] };
  };

  listarLocais = async (
    orgaoId: string, alcance: AlcanceDeConsulta,
    almoxarifadoId?: string, incluirInativos = false,
  ): Promise<LocalDeEstoque[]> => {
    const { rows } = await pool.query(SQL.listarLocais, [
      orgaoId, almoxarifadoId ?? null, alcance.locais, incluirInativos,
    ]);
    return rows as LocalDeEstoque[];
  };

  buscarLocal = async (
    orgaoId: string, localId: string, alcance: AlcanceDeConsulta,
  ): Promise<LocalDeEstoque | null> => {
    const { rows } = await pool.query(SQL.buscarLocal, [orgaoId, localId, alcance.locais]);
    return (rows[0] as LocalDeEstoque) ?? null;
  };

  criarLocal = async (orgaoId: string, dados: {
    nome: string; codigo: string; almoxarifadoId: string | null; unidadeId?: string | null;
  }): Promise<string> => {
    const { rows } = await pool.query(SQL.criarLocal, [
      orgaoId, dados.codigo, dados.nome, dados.almoxarifadoId, dados.unidadeId ?? null,
    ]);
    return rows[0].id as string;
  };

  renomearLocal = async (
    orgaoId: string, localId: string, dados: { nome: string; codigo: string },
  ): Promise<void> => {
    await pool.query(SQL.renomearLocal, [orgaoId, localId, dados.nome, dados.codigo]);
  };

  definirSituacaoDoLocal = async (
    orgaoId: string, localId: string, ativo: boolean,
  ): Promise<void> => {
    await pool.query(SQL.definirSituacaoDoLocal, [orgaoId, localId, ativo]);
  };

  codigoDeLocalEmUso = async (
    orgaoId: string, codigo: string, exceto?: string,
  ): Promise<boolean> => {
    const { rows } = await pool.query(
      SQL.codigoDeLocalEmUso, [orgaoId, codigo, exceto ?? null],
    );
    return rows.length > 0;
  };

  salvarDadosDoLocal: AlmoxarifadoRepository["salvarDadosDoLocal"] = async (
    orgaoId, localId, dados,
  ) => {
    await pool.query(SQL.salvarDadosDoLocal, [
      orgaoId, localId, dados.almoxarifadoId,
      dados.cnpj ?? null, dados.endereco ?? null, dados.bairro ?? null,
      dados.municipio ?? null, dados.uf ?? null, dados.cep ?? null,
      dados.telefone ?? null, dados.email ?? null, dados.responsavel ?? null,
    ]);
  };

  // ---- Entrada -------------------------------------------------------------

  listarRemessas = async (
    orgaoId: string,
    filtros: Paginacao & { almoxarifado?: string; tipo?: string; busca?: string },
  ): Promise<Pagina<RemessaResumo>> => {
    const { rows } = await pool.query(SQL.listarRemessas, [
      orgaoId, filtros.porPagina, deslocamentoDe(filtros),
      filtros.almoxarifado ?? null, filtros.tipo ?? null, filtros.busca ?? null,
    ]);
    return montarPagina<RemessaResumo>(
      rows.map((linha) => ({ ...linha, lotes: numero(linha.lotes) })) as never,
      filtros,
    );
  };

  buscarRemessa = async (orgaoId: string, id: string) => {
    const { rows } = await pool.query(SQL.buscarRemessa, [orgaoId, id]);
    const remessa = rows[0];
    if (!remessa) return null;

    const lotes = await pool.query(SQL.lotesDaRemessa, [id]);
    return {
      ...remessa,
      lotes: lotes.rows.map((lote) => ({
        ...lote,
        quantidade: numero(lote.quantidade),
        saldo: numero(lote.saldo),
      })) as LoteDaRemessa[],
    } as RemessaResumo & { lotes: LoteDaRemessa[] };
  };

  criarRemessa = async (orgaoId: string, dados: NovaRemessa, tx?: Tx): Promise<string> => {
    const { rows } = await executor(tx).query(SQL.criarRemessa, [
      dados.almoxarifadoId, dados.codigo, dados.titulo, dados.data,
      dados.localArmazenado ?? null, dados.tipoEstoqueId,
      dados.responsavelUsuarioId, dados.notaFiscal ?? null, dados.fornecedorId ?? null,
    ]);
    return rows[0].id as string;
  };

  codigoDeRemessaEmUso = async (
    orgaoId: string, almoxarifadoId: string, codigo: string,
  ): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.codigoEmUso, [orgaoId, almoxarifadoId, codigo]);
    return (rowCount ?? 0) > 0;
  };

  adicionarLote = async (orgaoId: string, dados: NovoLote, tx?: Tx): Promise<string> => {
    const { rows } = await executor(tx).query(SQL.adicionarLote, [
      orgaoId, dados.remessaId, dados.produtoId, dados.quantidade, dados.dataValidade ?? null,
    ]);
    return rows[0].id as string;
  };

  removerLote = async (orgaoId: string, loteId: string): Promise<void> => {
    await pool.query(SQL.removerLote, [orgaoId, loteId]);
  };

  loteTemMovimento = async (orgaoId: string, loteId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.loteTemMovimento, [orgaoId, loteId]);
    return (rowCount ?? 0) > 0;
  };

  // ---- Disponibilidade e solicitação ---------------------------------------

  listarDisponiveis = async (
    orgaoId: string, almoxarifadoId: string, tipoEstoqueId?: string,
  ): Promise<DisponibilidadeDeProduto[]> => {
    const { rows } = await pool.query(SQL.listarDisponiveis, [
      orgaoId, almoxarifadoId, tipoEstoqueId ?? null,
    ]);
    return rows.map((linha) => {
      const saldoTotal = numero(linha.saldoTotal);
      const reservado = numero(linha.reservado);
      return {
        produtoId: linha.produtoId,
        nome: linha.nome,
        unidadeMedida: linha.unidadeMedida,
        saldoTotal,
        reservado,
        // Nunca negativo: reserva maior que saldo seria erro de dado, e mostrar
        // "-3 kg disponíveis" na tela da escola não ajuda ninguém.
        disponivel: Math.max(0, Math.round((saldoTotal - reservado) * 1000) / 1000),
        proximaValidade: linha.proximaValidade,
      };
    });
  };

  listarSolicitacoes = async (
    orgaoId: string,
    filtros: Paginacao & { status?: string; local?: string; almoxarifado?: string },
    alcance: AlcanceDeConsulta,
  ): Promise<Pagina<SolicitacaoResumo>> => {
    const { rows } = await pool.query(SQL.listarSolicitacoes, [
      orgaoId, filtros.porPagina, deslocamentoDe(filtros),
      filtros.status ?? null, filtros.local ?? null, filtros.almoxarifado ?? null,
      alcance.locais,
    ]);
    return montarPagina<SolicitacaoResumo>(
      rows.map((linha) => ({ ...linha, totalItens: numero(linha.totalItens) })) as never,
      filtros,
    );
  };

  buscarSolicitacao = async (
    orgaoId: string, id: string, alcance: AlcanceDeConsulta,
  ): Promise<SolicitacaoEstoque | null> => {
    const { rows } = await pool.query(SQL.buscarSolicitacao, [orgaoId, id, alcance.locais]);
    const solicitacao = rows[0];
    if (!solicitacao) return null;

    const itens = await pool.query(SQL.itensDaSolicitacao, [id]);
    return {
      ...solicitacao,
      itens: itens.rows.map((item) => ({
        ...item,
        quantidadeSolicitada: numero(item.quantidadeSolicitada),
        quantidadeReservada: numero(item.quantidadeReservada),
        saldoDaUnidadeNoMomento:
          item.saldoDaUnidadeNoMomento === null ? null : numero(item.saldoDaUnidadeNoMomento),
        quantidadeLiberada:
          item.quantidadeLiberada === null ? null : numero(item.quantidadeLiberada),
        quantidadeRecebida:
          item.quantidadeRecebida === null ? null : numero(item.quantidadeRecebida),
      })),
    } as SolicitacaoEstoque;
  };

  criarSolicitacao = async (
    orgaoId: string, dados: NovaSolicitacaoEstoque,
  ): Promise<string> => {
    const { rows } = await pool.query(SQL.criarSolicitacao, [
      orgaoId, dados.localSolicitanteId, dados.autorUsuarioId, dados.tipoEstoqueId ?? null,
    ]);
    return rows[0].id as string;
  };

  substituirItens = async (
    orgaoId: string,
    solicitacaoId: string,
    itens: { produtoId: string; quantidadeSolicitada: number }[],
  ): Promise<void> => {
    await pool.query(SQL.apagarItens, [orgaoId, solicitacaoId]);
    for (const item of itens) {
      await pool.query(SQL.inserirItem, [
        solicitacaoId, item.produtoId, item.quantidadeSolicitada,
      ]);
    }
  };

  removerSolicitacao = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerSolicitacao, [orgaoId, id]);
  };

  listarLotesComSaldo = async (
    orgaoId: string, almoxarifadoId: string, produtoIds: string[],
  ): Promise<LoteComSaldo[]> => {
    const { rows } = await pool.query(SQL.lotesComSaldo, [orgaoId, almoxarifadoId, produtoIds]);
    return rows.map((linha) => ({ ...linha, saldo: numero(linha.saldo) })) as LoteComSaldo[];
  };

  bloquearLotesDoProduto = async (
    orgaoId: string, almoxarifadoId: string, produtoIds: string[], tx: Tx,
  ): Promise<LoteComSaldo[]> => {
    const { rows } = await tx.query(SQL.bloquearLotes, [orgaoId, almoxarifadoId, produtoIds]);
    return rows.map((linha) => ({ ...linha, saldo: numero(linha.saldo) })) as LoteComSaldo[];
  };

  reservasPorProduto = async (
    orgaoId: string, almoxarifadoId: string, produtoIds: string[], tx?: Tx,
  ): Promise<Record<string, number>> => {
    const { rows } = await executor(tx).query(SQL.reservasPorProduto, [
      orgaoId, almoxarifadoId, produtoIds,
    ]);
    return Object.fromEntries(rows.map((linha) => [linha.produtoId, numero(linha.reservado)]));
  };

  marcarEnviada = async (
    orgaoId: string,
    solicitacaoId: string,
    reservaExpiraEm: Date | null,
    reservas: { itemId: string; quantidade: number }[],
    tx: Tx,
  ): Promise<void> => {
    await tx.query(SQL.marcarEnviada, [orgaoId, solicitacaoId, reservaExpiraEm]);
    for (const reserva of reservas) {
      await tx.query(SQL.reservarItem, [reserva.itemId, reserva.quantidade]);
    }
  };

  // ---- Liberação e recebimento ---------------------------------------------

  debitarLote = async (loteId: string, quantidade: number, tx: Tx): Promise<void> => {
    await tx.query(SQL.debitarLote, [loteId, quantidade]);
  };

  registrarLiberacoes = async (liberacoes: NovaLiberacao[], tx: Tx): Promise<void> => {
    for (const liberacao of liberacoes) {
      await tx.query(SQL.inserirLiberacao, [
        liberacao.solicitacaoItemId, liberacao.loteId, liberacao.quantidade,
      ]);
    }
  };

  marcarLiberada = async (
    orgaoId: string,
    solicitacaoId: string,
    usuarioId: string,
    liberadoPorItem: { itemId: string; quantidade: number }[],
    tx: Tx,
  ): Promise<void> => {
    await tx.query(SQL.marcarLiberada, [orgaoId, solicitacaoId, usuarioId]);
    // Zera a reserva de TODOS os itens, não só dos atendidos: item pedido e não
    // liberado deixaria saldo preso para sempre.
    await tx.query(SQL.zerarReservaDaSolicitacao, [solicitacaoId]);
    for (const item of liberadoPorItem) {
      await tx.query(SQL.liberarItem, [item.itemId, item.quantidade]);
    }
  };

  listarLiberacoes = async (
    orgaoId: string, solicitacaoId: string,
  ): Promise<LiberacaoParaConferir[]> => {
    const { rows } = await pool.query(SQL.listarLiberacoes, [orgaoId, solicitacaoId]);
    return rows.map((linha) => ({
      ...linha,
      quantidade: numero(linha.quantidade),
      quantidadeConfirmada:
        linha.quantidadeConfirmada === null ? null : numero(linha.quantidadeConfirmada),
    })) as LiberacaoParaConferir[];
  };

  confirmarRecebimento = async (
    orgaoId: string,
    solicitacaoId: string,
    usuarioId: string,
    confirmacoes: ConfirmacaoDeRecebimento[],
    tx: Tx,
  ): Promise<void> => {
    for (const confirmacao of confirmacoes) {
      await tx.query(SQL.confirmarLiberacao, [
        confirmacao.liberacaoId, confirmacao.quantidadeConfirmada,
        confirmacao.motivoPerda ?? null, confirmacao.observacaoPerda ?? null,
      ]);
      await tx.query(SQL.creditarEstoqueLocal, [
        confirmacao.liberacaoId, confirmacao.quantidadeConfirmada,
      ]);
    }
    await tx.query(SQL.totalRecebidoPorItem, [solicitacaoId]);
    await tx.query(SQL.marcarRecebida, [orgaoId, solicitacaoId, usuarioId]);
  };

  recusar = async (
    orgaoId: string, solicitacaoId: string, usuarioId: string, motivo: string,
  ): Promise<void> => {
    await pool.query(SQL.recusar, [orgaoId, solicitacaoId, usuarioId, motivo]);
    await pool.query(SQL.zerarReservaDaSolicitacao, [solicitacaoId]);
  };

  cancelar = async (orgaoId: string, solicitacaoId: string, tx: Tx): Promise<void> => {
    await tx.query(SQL.cancelar, [orgaoId, solicitacaoId]);
    await tx.query(SQL.zerarReservaDaSolicitacao, [solicitacaoId]);
  };

  expirarReservasVencidas = async (): Promise<number> => {
    const { rows } = await pool.query(SQL.expirarReservas, []);
    if (rows.length === 0) return 0;

    await pool.query(SQL.zerarReservasExpiradas, [rows.map((linha) => linha.id)]);
    return rows.length;
  };

  // ---- Estoque da unidade --------------------------------------------------

  listarEstoqueDoLocal = async (
    orgaoId: string, localId: string, alcance: AlcanceDeConsulta,
  ) => {
    const { rows } = await pool.query(SQL.estoqueDoLocal, [orgaoId, localId, alcance.locais]);

    type LoteNaUnidade = {
      id: string; saldo: number; dataValidade: string | null; dataEntrada: string;
    };
    type ProdutoNaUnidade = {
      produtoId: string;
      produtoNome: string;
      unidadeMedida: string;
      saldo: number;
      lotes: LoteNaUnidade[];
    };

    const porProduto = new Map<string, ProdutoNaUnidade>();

    for (const linha of rows) {
      const atual: ProdutoNaUnidade = porProduto.get(linha.produtoId) ?? {
        produtoId: linha.produtoId,
        produtoNome: linha.produtoNome,
        unidadeMedida: linha.unidadeMedida,
        saldo: 0,
        lotes: [],
      };
      atual.saldo = Math.round((atual.saldo + numero(linha.saldo)) * 1000) / 1000;
      atual.lotes.push({
        id: linha.id,
        saldo: numero(linha.saldo),
        dataValidade: linha.dataValidade,
        dataEntrada: linha.dataEntrada,
      });
      porProduto.set(linha.produtoId, atual);
    }

    return [...porProduto.values()];
  };

  // ---- Movimento -----------------------------------------------------------

  buscarAlmoxarifado = async (orgaoId: string, id: string): Promise<Almoxarifado | null> => {
    const { rows } = await pool.query(SQL.buscarAlmoxarifado, [orgaoId, id]);
    const linha = rows[0];
    return linha
      ? { ...linha, locais: numero(linha.locais), remessas: numero(linha.remessas) }
      : null;
  };

  listarLotesDoAlmoxarifado = async (orgaoId: string, almoxarifadoId: string) => {
    const { rows } = await pool.query(SQL.lotesDoAlmoxarifado, [orgaoId, almoxarifadoId]);
    return rows.map((linha) => ({
      ...linha,
      quantidade: numero(linha.quantidade),
      saldo: numero(linha.saldo),
    })) as (LoteDaRemessa & { remessaCodigo: string })[];
  };

  bloquearEstoqueLocal = async (
    orgaoId: string, localId: string, produtoId: string, tx: Tx,
  ) => {
    const { rows } = await tx.query(SQL.bloquearEstoqueLocal, [orgaoId, localId, produtoId]);
    return rows.map((linha) => ({
      id: linha.id as string,
      saldo: numero(linha.saldo),
      dataValidade: linha.dataValidade as string | null,
    }));
  };

  bloquearLoteDaUnidade = async (
    orgaoId: string, id: string, tx: Tx,
  ): Promise<LoteBloqueado | null> => {
    const { rows } = await tx.query(SQL.bloquearLoteDaUnidade, [orgaoId, id]);
    return rows[0] ? comSaldoNumerico(rows[0]) : null;
  };

  bloquearLotePorId = async (
    orgaoId: string, id: string, tx: Tx,
  ): Promise<LoteBloqueado | null> => {
    const { rows } = await tx.query(SQL.bloquearLotePorId, [orgaoId, id]);
    return rows[0] ? comSaldoNumerico(rows[0]) : null;
  };

  registrarConsumo = async (dados: NovoConsumo, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criarConsumo, [
      dados.localId, dados.produtoId, dados.quantidade, dados.forma,
      dados.periodoInicio, dados.periodoFim, dados.usuarioId, dados.observacao,
    ]);
    const id = rows[0].id as string;

    for (const retirada of dados.retiradas) {
      await tx.query(SQL.criarConsumoLote, [id, retirada.estoqueLocalId, retirada.quantidade]);
      await tx.query(SQL.debitarEstoqueLocal, [retirada.estoqueLocalId, retirada.quantidade]);
    }
    return id;
  };

  listarConsumo = async (
    orgaoId: string,
    filtros: Paginacao & { local?: string; produto?: string; de?: string; ate?: string },
    alcance: AlcanceDeConsulta,
  ): Promise<Pagina<ConsumoRegistrado>> => {
    const { rows } = await pool.query(SQL.listarConsumo, [
      orgaoId, filtros.porPagina, deslocamentoDe(filtros),
      filtros.local ?? null, filtros.produto ?? null,
      filtros.de ?? null, filtros.ate ?? null, alcance.locais,
    ]);
    return montarPagina<ConsumoRegistrado>(
      rows.map((linha) => ({
        ...linha,
        quantidade: numero(linha.quantidade),
        lotes: numero(linha.lotes),
      })) as never,
      filtros,
    );
  };

  criarDevolucao = async (dados: NovaDevolucao, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criarDevolucao, [
      dados.localId, dados.almoxarifadoId, dados.produtoId, dados.estoqueLocalId,
      dados.quantidade, dados.motivo, dados.solicitadaPorUsuarioId,
    ]);
    // O saldo da escola baixa AQUI, não no aceite: enquanto a devolução espera
    // resposta, aquele material não pode ser consumido nem devolvido de novo.
    await tx.query(SQL.debitarEstoqueLocal, [dados.estoqueLocalId, dados.quantidade]);
    return rows[0].id as string;
  };

  bloquearDevolucao = async (
    orgaoId: string, id: string, tx: Tx,
  ): Promise<DevolucaoResumo | null> => {
    const { rows } = await tx.query(SQL.bloquearDevolucao, [orgaoId, id]);
    return rows[0] ? { ...rows[0], quantidade: numero(rows[0].quantidade) } as DevolucaoResumo : null;
  };

  responderDevolucao = async (
    id: string, usuarioId: string, aceitar: boolean, motivoRecusa: string | null, tx: Tx,
  ): Promise<void> => {
    const alvo = (await tx.query(SQL.bloquearDevolucaoSimples, [id])).rows[0] as
      | {
          estoqueLocalId: string;
          quantidade: string;
          status: string;
          loteOrigemId: string | null;
        }
      | undefined;
    if (!alvo) return;

    await tx.query(SQL.responderDevolucao, [id, usuarioId, aceitar, motivoRecusa]);

    if (aceitar) {
      // Volta ao lote de ORIGEM, preservando a validade: criar lote novo
      // duplicaria a mesma caixa no estoque do almoxarifado. Sem lote de
      // origem — material que chegou por ajuste, não por entrega — não há para
      // onde creditar, e o saldo simplesmente sai da unidade.
      if (alvo.loteOrigemId) {
        await tx.query(SQL.creditarLoteDeOrigem, [alvo.loteOrigemId, alvo.quantidade]);
      }
    } else {
      // Recusa devolve o material à unidade — ele nunca saiu de lá de fato.
      await tx.query(SQL.devolverSaldoAUnidade, [alvo.estoqueLocalId, alvo.quantidade]);
    }
  };

  listarDevolucoes = async (
    orgaoId: string,
    filtros: Paginacao & { status?: string; almoxarifado?: string; local?: string },
    alcance: AlcanceDeConsulta,
  ): Promise<Pagina<DevolucaoResumo>> => {
    const { rows } = await pool.query(SQL.listarDevolucoes, [
      orgaoId, filtros.porPagina, deslocamentoDe(filtros),
      filtros.status ?? null, filtros.almoxarifado ?? null, filtros.local ?? null,
      alcance.locais,
    ]);
    return montarPagina<DevolucaoResumo>(
      rows.map((linha) => ({ ...linha, quantidade: numero(linha.quantidade) })) as never,
      filtros,
    );
  };

  transferirLote = async (
    dados: NovaTransferencia, tx: Tx,
  ): Promise<{ id: string; remessaDestinoId: string }> => {
    const { rows } = await tx.query(SQL.criarTransferencia, [
      dados.almoxarifadoOrigemId, dados.almoxarifadoDestinoId, dados.loteId,
      dados.quantidade, dados.usuarioId, dados.motivo,
    ]);
    const id = rows[0].id as string;

    await tx.query(SQL.debitarLote, [dados.loteId, dados.quantidade]);

    const remessa = await tx.query(SQL.criarRemessaDeTransferencia, [
      id, dados.almoxarifadoDestinoId, dados.usuarioId, dados.loteId,
    ]);
    const remessaDestinoId = remessa.rows[0].id as string;

    await tx.query(SQL.criarLoteDeTransferencia, [
      remessaDestinoId, dados.loteId, dados.quantidade,
    ]);

    return { id, remessaDestinoId };
  };

  listarTransferencias = async (
    orgaoId: string, filtros: Paginacao & { almoxarifado?: string },
  ): Promise<Pagina<TransferenciaResumo>> => {
    const { rows } = await pool.query(SQL.listarTransferencias, [
      orgaoId, filtros.porPagina, deslocamentoDe(filtros), filtros.almoxarifado ?? null,
    ]);
    return montarPagina<TransferenciaResumo>(
      rows.map((linha) => ({ ...linha, quantidade: numero(linha.quantidade) })) as never,
      filtros,
    );
  };

  registrarAjuste = async (dados: NovoAjuste, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criarAjuste, [
      dados.almoxarifadoId, dados.loteId, dados.estoqueLocalId,
      dados.saldoAnterior, dados.saldoCorrigido, dados.motivo,
      dados.observacao, dados.usuarioId,
    ]);

    // O ajuste GRAVA o saldo, não soma a diferença: é uma contagem física
    // substituindo o que o sistema achava que tinha.
    if (dados.loteId) {
      await tx.query(SQL.aplicarAjusteNoLote, [dados.loteId, dados.saldoCorrigido]);
    } else {
      await tx.query(SQL.aplicarAjusteNaUnidade, [dados.estoqueLocalId, dados.saldoCorrigido]);
    }
    return rows[0].id as string;
  };

  listarAjustes = async (
    orgaoId: string, filtros: Paginacao & { almoxarifado?: string; local?: string },
    alcance: AlcanceDeConsulta,
  ): Promise<Pagina<AjusteResumo>> => {
    const { rows } = await pool.query(SQL.listarAjustes, [
      orgaoId, filtros.porPagina, deslocamentoDe(filtros),
      filtros.almoxarifado ?? null, filtros.local ?? null,
      alcance.locais, alcance.almoxarifados,
    ]);
    return montarPagina<AjusteResumo>(
      rows.map((linha) => ({
        ...linha,
        saldoAnterior: numero(linha.saldoAnterior),
        saldoCorrigido: numero(linha.saldoCorrigido),
        diferenca: numero(linha.diferenca),
      })) as never,
      filtros,
    );
  };
}

const comSaldoNumerico = (linha: Record<string, unknown>): LoteBloqueado => ({
  id: String(linha.id),
  produtoId: String(linha.produtoId),
  produtoNome: String(linha.produtoNome),
  saldo: numero(linha.saldo),
  tetoDoLote: linha.tetoDoLote === null ? null : numero(linha.tetoDoLote),
  localId: String(linha.localId ?? ""),
  almoxarifadoId: String(linha.almoxarifadoId ?? ""),
});
