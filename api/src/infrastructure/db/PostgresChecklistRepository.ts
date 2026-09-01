import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  ChecklistCompleto, ChecklistRepository, ChecklistResumo, ItemDeChecklist,
  ItemDeModelo, ItemParaCumprir, ModeloDeChecklist, NovoChecklist,
  NovoItemDeChecklist, NovoItemDeModelo, UltimoCiclo,
} from "../../application/ports/ChecklistRepository";

/**
 * A situação de um item, em SQL.
 *
 * Espelha `situacaoDoItem` do domínio, e existe porque contar "quantos em
 * aberto" item a item em JavaScript significaria trazer todos os ciclos de
 * todos os checklists para contar no servidor.
 *
 * As duas cópias precisam concordar, e um teste confere isso: a lista traz o
 * número e a tela traz o detalhe, e divergirem seria a lista dizendo "3 em
 * aberto" sobre um checklist que mostra 2.
 */
const SITUACAO = `
  CASE
    WHEN i.dispensado_em IS NOT NULL THEN 'DISPENSADO'
    WHEN c.id IS NULL THEN 'PENDENTE'
    WHEN c.situacao = 'AGUARDANDO' THEN 'AGUARDANDO_CONFERENCIA'
    WHEN c.situacao = 'RECUSADO' THEN 'PENDENTE'
    WHEN c.vigencia_ate IS NULL THEN 'CUMPRIDO'
    WHEN c.vigencia_ate >= current_date THEN 'CUMPRIDO'
    ELSE 'VENCIDO'
  END`;

/** O último ciclo de cada item — `DISTINCT ON` é o que o projeto já usa. */
const ULTIMO_CICLO = `
  LEFT JOIN LATERAL (
    SELECT cc.* FROM checklist_item_cumprimento cc
     WHERE cc.item_id = i.id
     ORDER BY cc.ciclo DESC
     LIMIT 1
  ) c ON TRUE`;

const COLUNAS_CICLO = `
  cu.id, cu.ciclo, cu.situacao, cu.vigencia_ate AS "vigenciaAte",
  cu.cumprido_em AS "cumpridoEm", cu.observacao,
  cu.recusa_motivo AS "recusaMotivo", cu.conferido_em AS "conferidoEm",
  usc.nome AS "cumpridoPorNome", usv.nome AS "conferidoPorNome"`;

const SQL = {
  // ---- Modelos -------------------------------------------------------------
  /**
   * Os modelos que esta prefeitura enxerga.
   *
   * `orgao_id IS NULL` é o modelo que veio com o sistema — o roteiro do PNTP
   * é o mesmo para todo município, e copiá-lo para cada órgão na instalação
   * significaria 53 itens que envelhecem em separado a cada correção.
   *
   * A exceção é **deliberada e só de leitura**: escrita continua exigindo
   * `orgao_id = $1`, logo o global é intocável por qualquer prefeitura.
   */
  listarModelos: `
    SELECT m.id, m.nome, m.descricao, m.ativo,
           (m.orgao_id IS NULL) AS global,
           (SELECT count(*) FROM checklist_modelo_item mi WHERE mi.modelo_id = m.id)
             AS "totalItens"
      FROM checklist_modelo m
     WHERE m.orgao_id = $1 OR m.orgao_id IS NULL
     ORDER BY m.ativo DESC, global, m.nome`,

  buscarModelo: `
    SELECT m.id, m.nome, m.descricao, m.ativo,
           (m.orgao_id IS NULL) AS global,
           (SELECT count(*) FROM checklist_modelo_item mi WHERE mi.modelo_id = m.id)
             AS "totalItens"
      FROM checklist_modelo m
     WHERE (m.orgao_id = $1 OR m.orgao_id IS NULL) AND m.id = $2`,

  itensDoModelo: `
    SELECT id, ordem, titulo, descricao, exige_anexo AS "exigeAnexo",
           prazo_dias AS "prazoDias", recorrente,
           periodicidade_dias AS "periodicidadeDias",
           setor_id AS "setorId", departamento_id AS "departamentoId",
           para_fornecedor AS "paraFornecedor",
           secao, codigo, classificacao,
           modelo_arquivo AS "modeloArquivo",
           modelo_nome_original AS "modeloNomeOriginal"
      FROM checklist_modelo_item
     WHERE modelo_id = $1
     ORDER BY ordem`,

  apoiosDoModelo: `
    SELECT a.modelo_item_id AS "itemId", a.setor_id AS "setorId",
           a.departamento_id AS "departamentoId",
           coalesce(s.nome, d.nome) AS nome
      FROM checklist_modelo_item_apoio a
      JOIN checklist_modelo_item mi ON mi.id = a.modelo_item_id
      LEFT JOIN setor s ON s.id = a.setor_id
      LEFT JOIN departamento d ON d.id = a.departamento_id
     WHERE mi.modelo_id = $1`,

  criarModelo: `
    INSERT INTO checklist_modelo (orgao_id, nome, descricao)
    VALUES ($1, $2, $3) RETURNING id`,

  atualizarModelo: `
    UPDATE checklist_modelo SET nome = $3, descricao = $4, ativo = $5
     WHERE orgao_id = $1 AND id = $2`,

  removerModelo: `DELETE FROM checklist_modelo WHERE orgao_id = $1 AND id = $2`,

  limparItensDoModelo: `
    DELETE FROM checklist_modelo_item
     WHERE modelo_id IN (
       SELECT m.id FROM checklist_modelo m WHERE m.orgao_id = $1 AND m.id = $2
     )`,

  inserirItemDeModelo: `
    INSERT INTO checklist_modelo_item
      (modelo_id, ordem, titulo, descricao, exige_anexo, prazo_dias,
       recorrente, periodicidade_dias, setor_id, departamento_id, para_fornecedor,
       secao, codigo, classificacao, modelo_arquivo, modelo_nome_original)
    SELECT $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      FROM checklist_modelo m WHERE m.orgao_id = $1 AND m.id = $2
    RETURNING id`,

  inserirApoioDeModelo: `
    INSERT INTO checklist_modelo_item_apoio (modelo_item_id, setor_id, departamento_id)
    VALUES ($1, $2, $3)`,

  modeloEstaEmUso: `
    SELECT 1 FROM checklist WHERE orgao_id = $1 AND modelo_id = $2 LIMIT 1`,

  /**
   * Busca o registro a que o checklist vai se prender.
   *
   * O formulário pedia o **UUID colado à mão** — ninguém faz isso. Aqui o
   * servidor digita o número do processo ou do contrato, como ele o conhece.
   *
   * Uma consulta por tipo, unidas: cada tabela tem seu número e seu rótulo, e
   * uma view genérica sobre todas custaria mais que as quatro linhas de UNION.
   */
  buscarAlvos: `
    SELECT 'PROCESSO' AS tipo, p.id, p.numero_processo_adm AS numero,
           coalesce(r.nome, 'Processo administrativo') AS rotulo
      FROM processo p
      LEFT JOIN requerente r ON r.id = p.requerente_id
     WHERE p.orgao_id = $1 AND $2 = 'PROCESSO'
       AND (p.numero_processo_adm ILIKE $3 OR p.numero_protocolo ILIKE $3)
    UNION ALL
    SELECT 'CONTRATO', c.id, c.numero, f.razao_social
      FROM contrato c
      JOIN fornecedor f ON f.id = c.fornecedor_id
     WHERE c.orgao_id = $1 AND $2 = 'CONTRATO'
       AND (c.numero ILIKE $3 OR f.razao_social ILIKE $3)
    UNION ALL
    SELECT 'LICITACAO', l.id, l.numero, l.objeto
      FROM licitacao l
     WHERE l.orgao_id = $1 AND $2 = 'LICITACAO'
       AND (l.numero ILIKE $3 OR l.objeto ILIKE $3)
    UNION ALL
    SELECT 'FORNECEDOR', f.id, f.documento, f.razao_social
      FROM fornecedor f
     WHERE $2 = 'FORNECEDOR'
       AND (f.documento ILIKE $3 OR f.razao_social ILIKE $3)
       -- Fornecedor é cadastro global: só os que esta prefeitura contratou.
       AND EXISTS (SELECT 1 FROM contrato c
                    WHERE c.fornecedor_id = f.id AND c.orgao_id = $1)
    ORDER BY numero
    LIMIT 20`,

  // ---- Checklists ----------------------------------------------------------
  listar: `
    SELECT ck.id, ck.titulo, ck.alvo_tipo AS "alvoTipo", ck.alvo_id AS "alvoId",
           ck.criado_em AS "criadoEm",
           contagem.total AS "totalItens", contagem.em_aberto AS "emAberto",
           ${TOTAL_DA_JANELA}
      FROM checklist ck
      JOIN LATERAL (
        SELECT count(*) AS total,
               count(*) FILTER (WHERE situacao IN ('PENDENTE', 'VENCIDO')) AS em_aberto
          FROM (
            SELECT ${SITUACAO} AS situacao
              FROM checklist_item i
              ${ULTIMO_CICLO}
             WHERE i.checklist_id = ck.id
          ) s
      ) contagem ON TRUE
     WHERE ck.orgao_id = $1
       AND ($4::text IS NULL OR ck.alvo_tipo = $4)
       AND ($5::uuid IS NULL OR ck.alvo_id = $5)
       AND (NOT $6 OR contagem.em_aberto > 0)
     ORDER BY ck.criado_em DESC
     LIMIT $2 OFFSET $3`,

  listarDoAlvo: `
    SELECT ck.id, ck.titulo, ck.alvo_tipo AS "alvoTipo", ck.alvo_id AS "alvoId",
           ck.criado_em AS "criadoEm",
           contagem.total AS "totalItens", contagem.em_aberto AS "emAberto"
      FROM checklist ck
      JOIN LATERAL (
        SELECT count(*) AS total,
               count(*) FILTER (WHERE situacao IN ('PENDENTE', 'VENCIDO')) AS em_aberto
          FROM (
            SELECT ${SITUACAO} AS situacao
              FROM checklist_item i
              ${ULTIMO_CICLO}
             WHERE i.checklist_id = ck.id
          ) s
      ) contagem ON TRUE
     WHERE ck.orgao_id = $1 AND ck.alvo_tipo = $2 AND ck.alvo_id = $3
     ORDER BY ck.criado_em DESC`,

  buscar: `
    SELECT ck.id, ck.titulo, ck.descricao, ck.modelo_id AS "modeloId",
           m.nome AS "modeloNome",
           ck.alvo_tipo AS "alvoTipo", ck.alvo_id AS "alvoId",
           ck.setor_id AS "setorId", s.nome AS "setorNome",
           ck.departamento_id AS "departamentoId", d.nome AS "departamentoNome",
           u.nome AS "criadoPorNome", ck.criado_em AS "criadoEm"
      FROM checklist ck
      LEFT JOIN checklist_modelo m ON m.id = ck.modelo_id
      LEFT JOIN setor s ON s.id = ck.setor_id
      LEFT JOIN departamento d ON d.id = ck.departamento_id
      LEFT JOIN usuario u ON u.id = ck.criado_por
     WHERE ck.orgao_id = $1 AND ck.id = $2`,

  itensDoChecklist: `
    SELECT i.id, i.ordem, i.titulo, i.descricao, i.exige_anexo AS "exigeAnexo",
           i.prazo_limite AS "prazoLimite", i.recorrente,
           i.periodicidade_dias AS "periodicidadeDias",
           i.setor_id AS "setorId", s.nome AS "setorNome",
           i.departamento_id AS "departamentoId", d.nome AS "departamentoNome",
           i.para_fornecedor AS "paraFornecedor",
           i.secao, i.codigo, i.classificacao,
           i.modelo_arquivo AS "modeloArquivo",
           i.modelo_nome_original AS "modeloNomeOriginal",
           i.dispensado_em AS "dispensadoEm", i.dispensa_motivo AS "dispensaMotivo",
           ud.nome AS "dispensadoPorNome"
      FROM checklist_item i
      LEFT JOIN setor s ON s.id = i.setor_id
      LEFT JOIN departamento d ON d.id = i.departamento_id
      LEFT JOIN usuario ud ON ud.id = i.dispensado_por
     WHERE i.checklist_id = $1
     ORDER BY i.ordem`,

  ciclosDoChecklist: `
    SELECT cu.item_id AS "itemId", ${COLUNAS_CICLO}
      FROM checklist_item_cumprimento cu
      JOIN checklist_item i ON i.id = cu.item_id
      LEFT JOIN usuario usc ON usc.id = cu.cumprido_por
      LEFT JOIN usuario usv ON usv.id = cu.conferido_por
     WHERE i.checklist_id = $1
     ORDER BY cu.item_id, cu.ciclo DESC`,

  apoiosDoChecklist: `
    SELECT a.item_id AS "itemId", a.setor_id AS "setorId",
           a.departamento_id AS "departamentoId",
           coalesce(s.nome, d.nome) AS nome
      FROM checklist_item_apoio a
      JOIN checklist_item i ON i.id = a.item_id
      LEFT JOIN setor s ON s.id = a.setor_id
      LEFT JOIN departamento d ON d.id = a.departamento_id
     WHERE i.checklist_id = $1`,

  anexosDoChecklist: `
    SELECT a.id, a.cumprimento_id AS "cumprimentoId",
           a.nome_original AS "nomeOriginal", a.tamanho_bytes AS "tamanhoBytes"
      FROM checklist_anexo a
      JOIN checklist_item_cumprimento cu ON cu.id = a.cumprimento_id
      JOIN checklist_item i ON i.id = cu.item_id
     WHERE i.checklist_id = $1
     ORDER BY a.enviado_em`,

  criar: `
    INSERT INTO checklist
      (orgao_id, modelo_id, titulo, descricao, alvo_tipo, alvo_id,
       setor_id, departamento_id, criado_por)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,

  atualizar: `
    UPDATE checklist SET titulo = $3, descricao = $4, setor_id = $5, departamento_id = $6
     WHERE orgao_id = $1 AND id = $2`,

  remover: `DELETE FROM checklist WHERE orgao_id = $1 AND id = $2`,

  limparItens: `
    DELETE FROM checklist_item
     WHERE checklist_id IN (
       SELECT ck.id FROM checklist ck WHERE ck.orgao_id = $1 AND ck.id = $2
     )`,

  inserirItem: `
    INSERT INTO checklist_item
      (checklist_id, ordem, titulo, descricao, exige_anexo, prazo_limite,
       recorrente, periodicidade_dias, setor_id, departamento_id, para_fornecedor,
       secao, codigo, classificacao, modelo_arquivo, modelo_nome_original)
    SELECT $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      FROM checklist ck WHERE ck.orgao_id = $1 AND ck.id = $2
    RETURNING id`,

  inserirApoio: `
    INSERT INTO checklist_item_apoio (item_id, setor_id, departamento_id)
    VALUES ($1, $2, $3)`,

  // ---- Cumprimento ---------------------------------------------------------
  buscarItemParaCumprir: `
    SELECT i.id, i.checklist_id AS "checklistId", i.titulo,
           i.exige_anexo AS "exigeAnexo", i.recorrente,
           i.periodicidade_dias AS "periodicidadeDias",
           i.dispensado_em AS "dispensadoEm",
           c.id AS "ultimoCicloId", c.situacao AS "ultimoCicloSituacao",
           c.vigencia_ate AS "ultimoCicloVigenciaAte",
           coalesce(c.ciclo, 0) AS "ultimoCiclo"
      FROM checklist_item i
      JOIN checklist ck ON ck.id = i.checklist_id
      ${ULTIMO_CICLO}
     WHERE ck.orgao_id = $1 AND i.id = $2`,

  abrirCiclo: `
    INSERT INTO checklist_item_cumprimento
      (item_id, ciclo, cumprido_por, cumprido_por_externo, observacao, vigencia_ate)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,

  responderCiclo: `
    UPDATE checklist_item_cumprimento
       SET situacao = CASE WHEN $3 THEN 'ACEITO' ELSE 'RECUSADO' END,
           conferido_por = $2, conferido_em = now(), recusa_motivo = $4
     WHERE id = $1 AND situacao = 'AGUARDANDO'`,

  dispensarItem: `
    UPDATE checklist_item
       SET dispensado_em = now(), dispensado_por = $3, dispensa_motivo = $4
     WHERE id = $2
       AND checklist_id IN (SELECT ck.id FROM checklist ck WHERE ck.orgao_id = $1)`,

  reabrirItem: `
    UPDATE checklist_item
       SET dispensado_em = NULL, dispensado_por = NULL, dispensa_motivo = NULL
     WHERE id = $2
       AND checklist_id IN (SELECT ck.id FROM checklist ck WHERE ck.orgao_id = $1)`,

  // ---- Anexo ---------------------------------------------------------------
  registrarAnexo: `
    INSERT INTO checklist_anexo (cumprimento_id, arquivo, nome_original, tamanho_bytes)
    VALUES ($1, $2, $3, $4) RETURNING id`,

  modeloDoItem: `
    SELECT i.modelo_arquivo AS arquivo, i.modelo_nome_original AS "nomeOriginal"
      FROM checklist_item i
      JOIN checklist ck ON ck.id = i.checklist_id
     WHERE ck.orgao_id = $1 AND i.id = $2 AND i.modelo_arquivo IS NOT NULL`,

  buscarAnexo: `
    SELECT a.arquivo, a.nome_original AS "nomeOriginal"
      FROM checklist_anexo a
      JOIN checklist_item_cumprimento cu ON cu.id = a.cumprimento_id
      JOIN checklist_item i ON i.id = cu.item_id
      JOIN checklist ck ON ck.id = i.checklist_id
     WHERE ck.orgao_id = $1 AND a.id = $2`,
};

const numero = (valor: unknown) => Number(valor ?? 0);

export class PostgresChecklistRepository implements ChecklistRepository {
  // ---- Modelos -------------------------------------------------------------

  listarModelos = async (orgaoId: string): Promise<ModeloDeChecklist[]> => {
    const { rows } = await pool.query(SQL.listarModelos, [orgaoId]);
    return rows.map((linha) => ({ ...linha, totalItens: numero(linha.totalItens) }));
  };

  buscarModelo = async (orgaoId: string, id: string) => {
    const { rows } = await pool.query(SQL.buscarModelo, [orgaoId, id]);
    const modelo = rows[0];
    if (!modelo) return null;

    const [itens, apoios] = await Promise.all([
      pool.query(SQL.itensDoModelo, [id]),
      pool.query(SQL.apoiosDoModelo, [id]),
    ]);

    return {
      ...modelo,
      totalItens: numero(modelo.totalItens),
      itens: itens.rows.map((item) => ({
        ...item,
        apoios: agruparApoios(apoios.rows, item.id),
      })) as ItemDeModelo[],
    };
  };

  criarModelo = async (
    orgaoId: string, dados: { nome: string; descricao?: string | null },
  ): Promise<string> => {
    const { rows } = await pool.query(SQL.criarModelo, [
      orgaoId, dados.nome, dados.descricao ?? null,
    ]);
    return rows[0].id as string;
  };

  atualizarModelo = async (orgaoId: string, id: string, dados: {
    nome: string; descricao?: string | null; ativo: boolean;
  }): Promise<void> => {
    await pool.query(SQL.atualizarModelo, [
      orgaoId, id, dados.nome, dados.descricao ?? null, dados.ativo,
    ]);
  };

  removerModelo = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerModelo, [orgaoId, id]);
  };

  substituirItensDoModelo = async (
    orgaoId: string, modeloId: string, itens: NovoItemDeModelo[], tx: Tx,
  ): Promise<void> => {
    await tx.query(SQL.limparItensDoModelo, [orgaoId, modeloId]);
    for (const item of itens) {
      const { rows } = await tx.query(SQL.inserirItemDeModelo, [
        orgaoId, modeloId, item.ordem, item.titulo, item.descricao ?? null,
        item.exigeAnexo, item.prazoDias ?? null, item.recorrente,
        item.periodicidadeDias ?? null, item.setorId ?? null,
        item.departamentoId ?? null, item.paraFornecedor,
        item.secao ?? null, item.codigo ?? null, item.classificacao ?? null,
        item.modeloArquivo ?? null, item.modeloNomeOriginal ?? null,
      ]);
      // Sem linha inserida, o modelo é de outra prefeitura: o `SELECT ... FROM
      // checklist_modelo WHERE orgao_id` filtrou, e não há a que pendurar apoio.
      const criado = rows[0]?.id as string | undefined;
      if (!criado) continue;

      for (const apoio of item.apoios ?? []) {
        await tx.query(SQL.inserirApoioDeModelo, [
          criado, apoio.setorId ?? null, apoio.departamentoId ?? null,
        ]);
      }
    }
  };

  modeloEstaEmUso = async (orgaoId: string, modeloId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.modeloEstaEmUso, [orgaoId, modeloId]);
    return (rowCount ?? 0) > 0;
  };

  // ---- Checklists ----------------------------------------------------------

  buscarAlvos = async (orgaoId: string, tipo: string, busca: string) => {
    const { rows } = await pool.query(SQL.buscarAlvos, [orgaoId, tipo, `%${busca}%`]);
    return rows as { tipo: string; id: string; numero: string; rotulo: string }[];
  };

  listar = async (orgaoId: string, filtros: Paginacao & {
    alvoTipo?: string; alvoId?: string; emAberto?: boolean;
  }): Promise<Pagina<ChecklistResumo>> => {
    const { rows } = await pool.query(SQL.listar, [
      orgaoId, filtros.porPagina, deslocamentoDe(filtros),
      filtros.alvoTipo ?? null, filtros.alvoId ?? null, filtros.emAberto ?? false,
    ]);
    return montarPagina<ChecklistResumo>(
      rows.map((linha) => ({
        ...linha,
        totalItens: numero(linha.totalItens),
        emAberto: numero(linha.emAberto),
      })) as never,
      filtros,
    );
  };

  listarDoAlvo = async (
    orgaoId: string, alvoTipo: string, alvoId: string,
  ): Promise<ChecklistResumo[]> => {
    const { rows } = await pool.query(SQL.listarDoAlvo, [orgaoId, alvoTipo, alvoId]);
    return rows.map((linha) => ({
      ...linha,
      totalItens: numero(linha.totalItens),
      emAberto: numero(linha.emAberto),
    })) as ChecklistResumo[];
  };

  buscar = async (orgaoId: string, id: string): Promise<ChecklistCompleto | null> => {
    const { rows } = await pool.query(SQL.buscar, [orgaoId, id]);
    const checklist = rows[0];
    if (!checklist) return null;

    const [itens, ciclos, anexos, apoios] = await Promise.all([
      pool.query(SQL.itensDoChecklist, [id]),
      pool.query(SQL.ciclosDoChecklist, [id]),
      pool.query(SQL.anexosDoChecklist, [id]),
      pool.query(SQL.apoiosDoChecklist, [id]),
    ]);

    // Os anexos pendem do ciclo; agrupá-los aqui evita uma consulta por ciclo.
    const anexosPorCiclo = new Map<string, UltimoCiclo["anexos"]>();
    for (const anexo of anexos.rows) {
      const lista = anexosPorCiclo.get(anexo.cumprimentoId) ?? [];
      lista.push({
        id: anexo.id,
        nomeOriginal: anexo.nomeOriginal,
        tamanhoBytes: numero(anexo.tamanhoBytes),
      });
      anexosPorCiclo.set(anexo.cumprimentoId, lista);
    }

    const ciclosPorItem = new Map<string, UltimoCiclo[]>();
    for (const linha of ciclos.rows) {
      const lista = ciclosPorItem.get(linha.itemId) ?? [];
      lista.push({
        id: linha.id,
        ciclo: numero(linha.ciclo),
        situacao: linha.situacao,
        vigenciaAte: linha.vigenciaAte,
        cumpridoEm: linha.cumpridoEm,
        cumpridoPorNome: linha.cumpridoPorNome,
        observacao: linha.observacao,
        recusaMotivo: linha.recusaMotivo,
        conferidoPorNome: linha.conferidoPorNome,
        conferidoEm: linha.conferidoEm,
        anexos: anexosPorCiclo.get(linha.id) ?? [],
      });
      ciclosPorItem.set(linha.itemId, lista);
    }

    return {
      ...checklist,
      totalItens: itens.rows.length,
      // Contado no domínio pela tela; aqui basta o número de itens.
      emAberto: 0,
      itens: itens.rows.map((item) => {
        // Já vêm do mais novo para o mais antigo: o primeiro é o que vale.
        const doItem = ciclosPorItem.get(item.id) ?? [];
        return {
          ...item,
          apoios: agruparApoios(apoios.rows, item.id),
          ultimoCiclo: doItem[0] ?? null,
          historico: doItem.slice(1),
        } as ItemDeChecklist;
      }),
    } as ChecklistCompleto;
  };

  criar = async (
    dados: NovoChecklist, itens: NovoItemDeChecklist[], tx: Tx,
  ): Promise<string> => {
    const { rows } = await tx.query(SQL.criar, [
      dados.orgaoId, dados.modeloId ?? null, dados.titulo, dados.descricao ?? null,
      dados.alvoTipo ?? null, dados.alvoId ?? null,
      dados.setorId ?? null, dados.departamentoId ?? null, dados.criadoPor,
    ]);
    const id = rows[0].id as string;

    for (const item of itens) {
      await this.inserirItem(dados.orgaoId, id, item, tx);
    }
    return id;
  };

  atualizar = async (orgaoId: string, id: string, dados: {
    titulo: string; descricao?: string | null;
    setorId?: string | null; departamentoId?: string | null;
  }): Promise<void> => {
    await pool.query(SQL.atualizar, [
      orgaoId, id, dados.titulo, dados.descricao ?? null,
      dados.setorId ?? null, dados.departamentoId ?? null,
    ]);
  };

  remover = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.remover, [orgaoId, id]);
  };

  substituirItens = async (
    orgaoId: string, checklistId: string, itens: NovoItemDeChecklist[], tx: Tx,
  ): Promise<void> => {
    await tx.query(SQL.limparItens, [orgaoId, checklistId]);
    for (const item of itens) {
      await this.inserirItem(orgaoId, checklistId, item, tx);
    }
  };

  /**
   * Um item e seus apoios, na mesma transação.
   *
   * Extraído porque criar e substituir faziam a mesma coisa, e a segunda cópia
   * é onde o campo novo é esquecido.
   */
  private inserirItem = async (
    orgaoId: string, checklistId: string, item: NovoItemDeChecklist, tx: Tx,
  ): Promise<void> => {
    const { rows } = await tx.query(SQL.inserirItem, [
      orgaoId, checklistId, item.ordem, item.titulo, item.descricao ?? null,
      item.exigeAnexo, item.prazoLimite ?? null, item.recorrente,
      item.periodicidadeDias ?? null, item.setorId ?? null,
      item.departamentoId ?? null, item.paraFornecedor,
      item.secao ?? null, item.codigo ?? null, item.classificacao ?? null,
      item.modeloArquivo ?? null, item.modeloNomeOriginal ?? null,
    ]);

    const criado = rows[0]?.id as string | undefined;
    if (!criado) return;

    for (const apoio of item.apoios ?? []) {
      await tx.query(SQL.inserirApoio, [
        criado, apoio.setorId ?? null, apoio.departamentoId ?? null,
      ]);
    }
  };

  // ---- Cumprimento ---------------------------------------------------------

  buscarItemParaCumprir = async (
    orgaoId: string, itemId: string,
  ): Promise<ItemParaCumprir | null> => {
    const { rows } = await pool.query(SQL.buscarItemParaCumprir, [orgaoId, itemId]);
    const linha = rows[0];
    return linha ? { ...linha, ultimoCiclo: numero(linha.ultimoCiclo) } as ItemParaCumprir : null;
  };

  abrirCiclo = async (dados: {
    itemId: string; ciclo: number; cumpridoPor: string | null;
    cumpridoPorExterno: boolean; observacao: string | null; vigenciaAte: string | null;
  }, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.abrirCiclo, [
      dados.itemId, dados.ciclo, dados.cumpridoPor, dados.cumpridoPorExterno,
      dados.observacao, dados.vigenciaAte,
    ]);
    return rows[0].id as string;
  };

  responderCiclo = async (dados: {
    cicloId: string; usuarioId: string; aceitar: boolean; recusaMotivo: string | null;
  }, tx: Tx): Promise<void> => {
    await tx.query(SQL.responderCiclo, [
      dados.cicloId, dados.usuarioId, dados.aceitar, dados.recusaMotivo,
    ]);
  };

  dispensarItem = async (
    orgaoId: string, itemId: string, usuarioId: string, motivo: string,
  ): Promise<void> => {
    await pool.query(SQL.dispensarItem, [orgaoId, itemId, usuarioId, motivo]);
  };

  reabrirItem = async (orgaoId: string, itemId: string): Promise<void> => {
    await pool.query(SQL.reabrirItem, [orgaoId, itemId]);
  };

  // ---- Anexo ---------------------------------------------------------------

  registrarAnexo = async (dados: {
    cumprimentoId: string; arquivo: string; nomeOriginal: string; tamanhoBytes: number;
  }): Promise<string> => {
    const { rows } = await pool.query(SQL.registrarAnexo, [
      dados.cumprimentoId, dados.arquivo, dados.nomeOriginal, dados.tamanhoBytes,
    ]);
    return rows[0].id as string;
  };

  modeloDoItem = async (orgaoId: string, itemId: string) => {
    const { rows } = await pool.query(SQL.modeloDoItem, [orgaoId, itemId]);
    return (rows[0] as { arquivo: string; nomeOriginal: string }) ?? null;
  };

  buscarAnexo = async (orgaoId: string, anexoId: string) => {
    const { rows } = await pool.query(SQL.buscarAnexo, [orgaoId, anexoId]);
    return (rows[0] as { arquivo: string; nomeOriginal: string }) ?? null;
  };
}


/** Os apoios de um item, do resultado plano da consulta. */
const agruparApoios = (
  linhas: { itemId: string; setorId: string | null; departamentoId: string | null; nome: string }[],
  itemId: string,
) => linhas
  .filter((linha) => linha.itemId === itemId)
  .map(({ setorId, departamentoId, nome }) => ({ setorId, departamentoId, nome }));
