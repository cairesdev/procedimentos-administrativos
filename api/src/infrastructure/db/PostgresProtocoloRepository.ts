import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  AcompanhamentoPublico, AssuntoDeProtocolo, AtendimentoDetalhe, AtendimentoResumo,
  NovoAssunto, NovoAtendimento,
  Exigencia, NovaExigencia, NovoRequerente, PrefeituraPublica, ProtocoloRepository, Requerente,
} from "../../application/ports/ProtocoloRepository";

const COLUNAS_ASSUNTO = `
  a.id, a.nome, a.descricao, a.setor_id AS "setorId", s.nome AS "setorNome",
  a.prazo_dias AS "prazoDias", a.ativo,
  (SELECT count(*) FROM processo p WHERE p.assunto_id = a.id) AS atendimentos`;

const COLUNAS_REQUERENTE = `
  id, tipo, documento, nome,
  contato_email AS "contatoEmail", contato_telefone AS "contatoTelefone"`;

const SQL = {
  listarAssuntos: `
    SELECT ${COLUNAS_ASSUNTO}
      FROM assunto_protocolo a
      LEFT JOIN setor s ON s.id = a.setor_id
     WHERE a.orgao_id = $1 AND ($2::boolean IS NOT TRUE OR a.ativo)
     ORDER BY a.nome`,
  buscarAssunto: `
    SELECT ${COLUNAS_ASSUNTO}
      FROM assunto_protocolo a
      LEFT JOIN setor s ON s.id = a.setor_id
     WHERE a.orgao_id = $1 AND a.id = $2`,
  criarAssunto: `
    INSERT INTO assunto_protocolo (orgao_id, nome, descricao, setor_id, prazo_dias, ativo)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
  atualizarAssunto: `
    UPDATE assunto_protocolo
       SET nome = $3, descricao = $4, setor_id = $5, prazo_dias = $6, ativo = $7
     WHERE orgao_id = $1 AND id = $2`,
  removerAssunto: `DELETE FROM assunto_protocolo WHERE orgao_id = $1 AND id = $2`,

  requerentePorDocumento: `
    SELECT ${COLUNAS_REQUERENTE} FROM requerente
     WHERE orgao_id = $1 AND documento = $2`,
  criarRequerente: `
    INSERT INTO requerente
      (orgao_id, tipo, fornecedor_id, documento, nome, contato_email, contato_telefone)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
  atualizarContato: `
    UPDATE requerente
       SET nome = $2,
           contato_email = COALESCE($3, contato_email),
           contato_telefone = COALESCE($4, contato_telefone)
     WHERE id = $1`,

  criarAtendimento: `
    INSERT INTO processo
      (orgao_id, numero_protocolo, numero_processo_adm, tipo_processo, requerente_id,
       assunto_id, descricao_pedido, origem_atendimento, setor_atual_id, departamento_atual_id,
       status)
    VALUES ($1, $2, $3, 'ATENDIMENTO_EXTERNO', $4, $5, $6, $7, $8, $9, 'ABERTO')
    RETURNING id`,

  listarAtendimentos: `
    SELECT p.id, p.numero_protocolo AS "numeroProtocolo",
           p.numero_processo_adm AS "numeroProcessoAdm", p.status,
           p.data_abertura AS "dataAbertura",
           p.origem_atendimento AS "origemAtendimento",
           a.nome AS "assuntoNome", s.nome AS "setorAtualNome",
           r.nome AS "requerenteNome", r.documento AS "requerenteDocumento",
           ${TOTAL_DA_JANELA}
      FROM processo p
      JOIN requerente r ON r.id = p.requerente_id
      LEFT JOIN assunto_protocolo a ON a.id = p.assunto_id
      LEFT JOIN setor s ON s.id = p.setor_atual_id
     WHERE p.orgao_id = $1
       AND p.tipo_processo = 'ATENDIMENTO_EXTERNO'
       AND ($4::text IS NULL OR p.status = $4)
       AND ($5::uuid IS NULL OR p.assunto_id = $5)
       AND ($6::text IS NULL
            OR p.numero_protocolo ILIKE '%' || $6 || '%'
            OR r.nome ILIKE '%' || $6 || '%'
            OR r.documento LIKE $6 || '%')
     ORDER BY p.data_abertura DESC, p.id
     LIMIT $2 OFFSET $3`,

  buscarAtendimento: `
    SELECT p.id, p.numero_protocolo AS "numeroProtocolo",
           p.numero_processo_adm AS "numeroProcessoAdm", p.status,
           p.data_abertura AS "dataAbertura", p.data_encerramento AS "dataEncerramento",
           p.origem_atendimento AS "origemAtendimento",
           p.descricao_pedido AS "descricaoPedido",
           a.nome AS "assuntoNome", a.prazo_dias AS "prazoDias",
           s.nome AS "setorAtualNome",
           r.nome AS "requerenteNome", r.documento AS "requerenteDocumento",
           r.tipo AS "requerenteTipo",
           r.contato_email AS "requerenteEmail", r.contato_telefone AS "requerenteTelefone"
      FROM processo p
      JOIN requerente r ON r.id = p.requerente_id
      LEFT JOIN assunto_protocolo a ON a.id = p.assunto_id
      LEFT JOIN setor s ON s.id = p.setor_atual_id
     WHERE p.orgao_id = $1 AND p.id = $2
       AND p.tipo_processo = 'ATENDIMENTO_EXTERNO'`,

  prefeituraPorCnpj: `
    SELECT id, nome, municipio, uf FROM orgao WHERE cnpj = $1 AND ativo`,

  // Freio por documento: conta o que a mesma pessoa abriu na janela, em
  // qualquer prefeitura. Robô que gira CPF válido esbarra aqui mesmo trocando
  // de IP; pessoa de verdade raramente abre vários pedidos no mesmo dia.
  aberturasRecentes: `
    SELECT count(*) AS total
      FROM processo p
      JOIN requerente r ON r.id = p.requerente_id
     WHERE r.documento = $1
       AND p.origem_atendimento = 'PORTAL'
       AND p.data_abertura >= $2`,

  // Consulta pública: protocolo + documento, sem órgão na chamada — o par já
  // é único no produto porque o documento pertence a um órgão só.
  acompanhar: `
    SELECT p.id, p.numero_protocolo AS "numeroProtocolo",
           p.numero_processo_adm AS "numeroProcessoAdm", p.status,
           p.data_abertura AS "dataAbertura", p.data_encerramento AS "dataEncerramento",
           a.nome AS "assuntoNome", a.prazo_dias AS "prazoDias",
           p.descricao_pedido AS "descricaoPedido",
           s.nome AS "setorAtualNome",
           r.nome AS "requerenteNome", o.nome AS "orgaoNome"
      FROM processo p
      JOIN requerente r ON r.id = p.requerente_id
      JOIN orgao o ON o.id = p.orgao_id
      LEFT JOIN assunto_protocolo a ON a.id = p.assunto_id
      LEFT JOIN setor s ON s.id = p.setor_atual_id
     WHERE p.tipo_processo = 'ATENDIMENTO_EXTERNO'
       AND p.numero_protocolo = $1
       AND r.documento = $2`,

  // Credencial do canal público: o par tem de casar, e devolve o mínimo.
  processoDoRequerente: `
    SELECT p.id AS "processoId", p.orgao_id AS "orgaoId",
           p.requerente_id AS "requerenteId", p.status
      FROM processo p
      JOIN requerente r ON r.id = p.requerente_id
     WHERE p.tipo_processo = 'ATENDIMENTO_EXTERNO'
       AND p.numero_protocolo = $1
       AND r.documento = $2`,

  listarExigencias: `
    SELECT e.id, e.processo_id AS "processoId", e.texto,
           e.prazo_dias AS "prazoDias", e.prazo_limite AS "prazoLimite",
           e.status, e.criada_em AS "criadaEm",
           coalesce(u.nome, '—') AS "criadaPorNome",
           e.resposta_texto AS "respostaTexto", e.respondida_em AS "respondidaEm",
           e.cancelada_motivo AS "canceladaMotivo",
           (SELECT count(*) FROM anexo a WHERE a.exigencia_id = e.id) AS anexos
      FROM exigencia e
      LEFT JOIN usuario u ON u.id = e.criada_por_usuario_id
     WHERE ($1::uuid IS NULL OR e.orgao_id = $1) AND e.processo_id = $2
     ORDER BY e.criada_em DESC`,
  buscarExigencia: `
    SELECT e.id, e.processo_id AS "processoId", e.texto,
           e.prazo_dias AS "prazoDias", e.prazo_limite AS "prazoLimite",
           e.status, e.criada_em AS "criadaEm",
           coalesce(u.nome, '—') AS "criadaPorNome",
           e.resposta_texto AS "respostaTexto", e.respondida_em AS "respondidaEm",
           e.cancelada_motivo AS "canceladaMotivo",
           (SELECT count(*) FROM anexo a WHERE a.exigencia_id = e.id) AS anexos
      FROM exigencia e
      LEFT JOIN usuario u ON u.id = e.criada_por_usuario_id
     WHERE e.id = $1`,
  criarExigencia: `
    INSERT INTO exigencia
      (orgao_id, processo_id, texto, prazo_dias, prazo_limite, criada_por_usuario_id)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
  responderExigencia: `
    UPDATE exigencia
       SET status = 'RESPONDIDA', resposta_texto = $2, respondida_em = now()
     WHERE id = $1 AND status = 'PENDENTE'`,
  cancelarExigencia: `
    UPDATE exigencia
       SET status = 'CANCELADA', cancelada_motivo = $3
     WHERE orgao_id = $1 AND id = $2 AND status = 'PENDENTE'`,

  // Andamento sem texto: só para onde o pedido foi e quando. O que o servidor
  // escreveu no despacho é peça de trabalho interna, não resposta ao cidadão.
  andamento: `
    SELECT d.data, s.nome AS "setorNome"
      FROM despacho d
      LEFT JOIN setor s ON s.id = d.setor_id
     WHERE d.processo_id = $1 AND d.tipo = 'ENCAMINHAMENTO'
     ORDER BY d.data`,
};

const numerico = (linha: Record<string, unknown>): AssuntoDeProtocolo => ({
  ...(linha as unknown as AssuntoDeProtocolo),
  atendimentos: Number(linha.atendimentos),
});

const comAnexos = (linha: Record<string, unknown>): Exigencia => ({
  ...(linha as unknown as Exigencia),
  anexos: Number(linha.anexos),
});

export class PostgresProtocoloRepository implements ProtocoloRepository {
  listarAssuntos = async (
    orgaoId: string,
    apenasAtivos = false,
  ): Promise<AssuntoDeProtocolo[]> => {
    const { rows } = await pool.query(SQL.listarAssuntos, [orgaoId, apenasAtivos]);
    return rows.map(numerico);
  };

  buscarAssunto = async (orgaoId: string, id: string): Promise<AssuntoDeProtocolo | null> => {
    const { rows } = await pool.query(SQL.buscarAssunto, [orgaoId, id]);
    return rows[0] ? numerico(rows[0]) : null;
  };

  criarAssunto = async (dados: NovoAssunto): Promise<string> => {
    const { rows } = await pool.query(SQL.criarAssunto, [
      dados.orgaoId, dados.nome, dados.descricao ?? null,
      dados.setorId ?? null, dados.prazoDias ?? null, dados.ativo,
    ]);
    return rows[0].id;
  };

  atualizarAssunto = async (
    orgaoId: string,
    id: string,
    dados: Omit<NovoAssunto, "orgaoId">,
  ): Promise<void> => {
    await pool.query(SQL.atualizarAssunto, [
      orgaoId, id, dados.nome, dados.descricao ?? null,
      dados.setorId ?? null, dados.prazoDias ?? null, dados.ativo,
    ]);
  };

  removerAssunto = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerAssunto, [orgaoId, id]);
  };

  buscarRequerentePorDocumento = async (
    orgaoId: string,
    documento: string,
  ): Promise<Requerente | null> => {
    const { rows } = await pool.query(SQL.requerentePorDocumento, [orgaoId, documento]);
    return rows[0] ?? null;
  };

  criarRequerente = async (dados: NovoRequerente, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criarRequerente, [
      dados.orgaoId, dados.tipo, dados.fornecedorId ?? null, dados.documento,
      dados.nome, dados.contatoEmail ?? null, dados.contatoTelefone ?? null,
    ]);
    return rows[0].id;
  };

  atualizarContato = async (
    id: string,
    dados: { nome: string; contatoEmail?: string; contatoTelefone?: string },
    tx: Tx,
  ): Promise<void> => {
    await tx.query(SQL.atualizarContato, [
      id, dados.nome, dados.contatoEmail ?? null, dados.contatoTelefone ?? null,
    ]);
  };

  criarAtendimento = async (dados: NovoAtendimento, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criarAtendimento, [
      dados.orgaoId, dados.numeroProtocolo, dados.numeroProcessoAdm, dados.requerenteId,
      dados.assuntoId, dados.descricaoPedido, dados.origem,
      dados.setorAtualId ?? null, dados.departamentoAtualId ?? null,
    ]);
    return rows[0].id;
  };

  listarAtendimentos = async (
    orgaoId: string,
    filtros: { status?: string; assuntoId?: string; busca?: string },
    paginacao: Paginacao,
  ): Promise<Pagina<AtendimentoResumo>> => {
    const { rows } = await pool.query(SQL.listarAtendimentos, [
      orgaoId, paginacao.porPagina, deslocamentoDe(paginacao),
      filtros.status ?? null, filtros.assuntoId ?? null, filtros.busca ?? null,
    ]);
    return montarPagina(rows, paginacao);
  };

  buscarPrefeituraPorCnpj = async (cnpj: string): Promise<PrefeituraPublica | null> => {
    const { rows } = await pool.query(SQL.prefeituraPorCnpj, [cnpj.replace(/\D/g, "")]);
    return rows[0] ?? null;
  };

  contarAberturasRecentes = async (documento: string, desde: Date): Promise<number> => {
    const { rows } = await pool.query(SQL.aberturasRecentes, [documento, desde]);
    return Number(rows[0].total);
  };

  processoDoRequerente = async (numeroProtocolo: string, documento: string) => {
    const { rows } = await pool.query(SQL.processoDoRequerente, [numeroProtocolo, documento]);
    return rows[0] ?? null;
  };

  buscarAtendimento = async (orgaoId: string, id: string): Promise<AtendimentoDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscarAtendimento, [orgaoId, id]);
    return rows[0] ?? null;
  };

  listarExigencias = async (orgaoId: string, processoId: string): Promise<Exigencia[]> => {
    const { rows } = await pool.query(SQL.listarExigencias, [orgaoId, processoId]);
    return rows.map(comAnexos);
  };

  /** Sem órgão na chamada: quem já provou o par protocolo + documento passa. */
  exigenciasDoRequerente = async (processoId: string): Promise<Exigencia[]> => {
    const { rows } = await pool.query(SQL.listarExigencias, [null, processoId]);
    return rows.map(comAnexos);
  };

  buscarExigencia = async (id: string): Promise<Exigencia | null> => {
    const { rows } = await pool.query(SQL.buscarExigencia, [id]);
    return rows[0] ? comAnexos(rows[0]) : null;
  };

  criarExigencia = async (dados: NovaExigencia, prazoLimite: string | null): Promise<string> => {
    const { rows } = await pool.query(SQL.criarExigencia, [
      dados.orgaoId, dados.processoId, dados.texto,
      dados.prazoDias ?? null, prazoLimite, dados.criadaPorUsuarioId,
    ]);
    return rows[0].id;
  };

  responderExigencia = async (id: string, texto: string): Promise<void> => {
    await pool.query(SQL.responderExigencia, [id, texto]);
  };

  cancelarExigencia = async (orgaoId: string, id: string, motivo: string): Promise<void> => {
    await pool.query(SQL.cancelarExigencia, [orgaoId, id, motivo]);
  };

  acompanhar = async (
    numeroProtocolo: string,
    documento: string,
  ): Promise<AcompanhamentoPublico | null> => {
    const { rows } = await pool.query(SQL.acompanhar, [numeroProtocolo, documento]);
    const processo = rows[0];
    if (!processo) return null;

    const andamento = await pool.query(SQL.andamento, [processo.id]);
    // `id` não sai daqui: identificador interno não tem uso na rua e só
    // aumentaria o que um raspador junta sobre a prefeitura.
    const { id, ...publico } = processo;
    return { ...publico, andamento: andamento.rows };
  };
}
