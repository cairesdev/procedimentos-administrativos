import { pool } from "./pool";
import type {
  FiltrosDoRelatorio, LinhaDeContrato, LinhaDeFornecedor, LinhaDeLicitacao,
  DossieDoProcesso, LinhaDeSetor, LinhaDeUnidade, Panorama, PorSetor,
  ProcessoEncontrado, RelatorioProcessoRepository,
} from "../../application/ports/RelatorioProcessoRepository";
import type {
  RecorteRepository, RecorteSalvo, TipoDeRelatorio,
} from "../../application/relatorio/ApurarRelatorioDeProcessos";

/**
 * O que cada contrato já teve pedido.
 *
 * Uma solicitação escolhe itens, e cada item pertence a um contrato — então o
 * pedido de um contrato é a soma dos itens dele em qualquer solicitação. Fica
 * numa CTE reusada porque três das quatro consultas do panorama precisam do
 * mesmo número, e calculá-lo três vezes daria três chances de divergir.
 */
const PEDIDO_POR_CONTRATO = `
  pedido AS (
    SELECT i.contrato_id, sum(si.valor_calculado) AS valor
      FROM solicitacao_item si
      JOIN item i ON i.id = si.item_id
     GROUP BY i.contrato_id
  )`;

/**
 * Os filtros opcionais, sempre no mesmo formato: `$n IS NULL OR ...`.
 *
 * Montar SQL por concatenação conforme o filtro presente daria uma consulta
 * diferente por combinação — e o `PREPARE` do verificador de migrations só
 * conferiria a que eu lembrasse de escrever.
 */
const SQL = {
  contratos: `
    WITH ${PEDIDO_POR_CONTRATO}
    SELECT c.id, c.numero, f.razao_social AS fornecedor,
           coalesce(a.objeto, l.objeto, '') AS objeto,
           to_char(c.data_inicio, 'DD/MM/YYYY') AS "dataInicio",
           to_char(c.data_fim, 'DD/MM/YYYY') AS "dataFim",
           c.valor_total AS "valorContratado",
           coalesce(p.valor, 0) AS "valorPedido",
           c.valor_total - coalesce(p.valor, 0) AS saldo
      FROM contrato c
      JOIN fornecedor f ON f.id = c.fornecedor_id
      LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
      LEFT JOIN licitacao l ON l.id = c.licitacao_id
      LEFT JOIN pedido p ON p.contrato_id = c.id
     WHERE c.orgao_id = $1
       AND c.data_inicio BETWEEN $2 AND $3
       AND ($4::uuid IS NULL OR EXISTS (
             SELECT 1 FROM contrato_unidade cu
              WHERE cu.contrato_id = c.id AND cu.unidade_id = $4))
       AND ($5::uuid IS NULL OR c.fornecedor_id = $5)
       AND ($6::text IS NULL OR l.modalidade = $6)
     ORDER BY c.data_inicio DESC, c.numero`,

  licitacoes: `
    SELECT l.id, l.numero, l.modalidade,
           l.objeto,
           to_char(l.data_assinatura, 'DD/MM/YYYY') AS "dataAssinatura",
           l.valor_total AS "valorTotal",
           count(c.id) AS contratos,
           coalesce(sum(c.valor_total), 0) AS "valorContratado"
      FROM licitacao l
      LEFT JOIN contrato c ON c.licitacao_id = l.id
     WHERE l.orgao_id = $1
       AND l.data_assinatura BETWEEN $2 AND $3
       AND ($4::uuid IS NULL OR EXISTS (
             SELECT 1 FROM licitacao_unidade lu
              WHERE lu.licitacao_id = l.id AND lu.unidade_id = $4))
       AND ($5::uuid IS NULL OR c.fornecedor_id = $5)
       AND ($6::text IS NULL OR l.modalidade = $6)
     GROUP BY l.id, l.numero, l.modalidade, l.objeto, l.data_assinatura, l.valor_total
     ORDER BY l.data_assinatura DESC, l.numero`,

  fornecedores: `
    WITH ${PEDIDO_POR_CONTRATO}
    SELECT f.id, f.razao_social AS "razaoSocial", f.documento,
           count(c.id) AS contratos,
           coalesce(sum(c.valor_total), 0) AS "valorContratado",
           coalesce(sum(p.valor), 0) AS "valorPedido"
      FROM fornecedor f
      JOIN contrato c ON c.fornecedor_id = f.id
      LEFT JOIN licitacao l ON l.id = c.licitacao_id
      LEFT JOIN pedido p ON p.contrato_id = c.id
     WHERE c.orgao_id = $1
       AND c.data_inicio BETWEEN $2 AND $3
       AND ($4::uuid IS NULL OR EXISTS (
             SELECT 1 FROM contrato_unidade cu
              WHERE cu.contrato_id = c.id AND cu.unidade_id = $4))
       AND ($5::uuid IS NULL OR c.fornecedor_id = $5)
       AND ($6::text IS NULL OR l.modalidade = $6)
     GROUP BY f.id, f.razao_social, f.documento
     ORDER BY coalesce(sum(c.valor_total), 0) DESC, f.razao_social`,

  /**
   * A unidade conta contratos destinados a ela e processos abertos por ela.
   *
   * São dois caminhos diferentes — `contrato_unidade` e a solicitação —, e
   * juntá-los num `JOIN` só multiplicaria as linhas: um contrato de três
   * unidades com duas solicitações viraria seis. Daí as subconsultas.
   */
  unidades: `
    SELECT u.id, u.nome,
           (SELECT count(*)
              FROM contrato_unidade cu
              JOIN contrato c ON c.id = cu.contrato_id
              LEFT JOIN licitacao l ON l.id = c.licitacao_id
             WHERE cu.unidade_id = u.id AND c.orgao_id = $1
               AND c.data_inicio BETWEEN $2 AND $3
               AND ($5::uuid IS NULL OR c.fornecedor_id = $5)
               -- A modalidade recorta aqui também: filtrado o panorama por
               -- dispensa, a contagem da unidade não pode continuar somando os
               -- pregões dela.
               AND ($6::text IS NULL OR l.modalidade = $6)) AS contratos,
           (SELECT count(*)
              FROM solicitacao s
              JOIN processo pr ON pr.id = s.processo_id
             WHERE s.unidade_solicitante_id = u.id AND s.orgao_id = $1
               AND pr.data_abertura::date BETWEEN $2 AND $3) AS processos,
           (SELECT coalesce(sum(si.valor_calculado), 0)
              FROM solicitacao s
              JOIN processo pr ON pr.id = s.processo_id
              JOIN solicitacao_item si ON si.solicitacao_id = s.id
             WHERE s.unidade_solicitante_id = u.id AND s.orgao_id = $1
               AND pr.data_abertura::date BETWEEN $2 AND $3) AS "valorPedido"
      FROM unidade u
     WHERE u.orgao_id = $1
       AND ($4::uuid IS NULL OR u.id = $4)
     ORDER BY u.nome`,

  /**
   * Por onde o processo andou, reconstruído dos despachos.
   *
   * O despacho grava **de onde** o processo saiu, não para onde foi: o destino
   * vira `processo.setor_atual_id` e o registro anterior se perde. Mas a
   * sequência basta — o setor onde o processo esteve entre um despacho e o
   * seguinte é o setor de quem fez o seguinte, porque só se despacha de onde o
   * processo está. `lag()` recompõe a chegada; a abertura serve de chegada para
   * o primeiro trecho.
   *
   * `atual` fecha a conta com quem ainda não saiu: processo não encerrado está
   * parado no setor atual desde o último despacho, ou desde a abertura se nunca
   * houve nenhum.
   */

  /**
   * O processo e de onde ele nasceu.
   *
   * O contrato chega pela solicitação, e a origem pelo contrato — nem todo
   * processo tem os dois. `LEFT JOIN` do começo ao fim: processo de protocolo,
   * aberto no balcão e sem compra nenhuma, também tem dossiê, e é justamente
   * nele que um `JOIN` interno devolveria zero linhas e a tela diria
   * "não encontrado" sobre um processo que existe.
   */
  dossieProcesso: `
    SELECT p.id, p.numero_protocolo AS "numeroProtocolo",
           p.numero_processo_adm AS "numeroProcessoAdm",
           p.tipo_processo AS tipo, p.status,
           to_char(p.data_abertura AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "dataAbertura",
           to_char(p.data_encerramento AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "dataEncerramento",
           p.descricao_pedido AS "descricaoPedido",
           sa.nome AS "setorAtual",
           u.nome AS "unidadeSolicitante",
           c.id AS "contratoId", c.numero AS "contratoNumero",
           to_char(c.data_inicio, 'DD/MM/YYYY') AS "contratoInicio",
           to_char(c.data_fim, 'DD/MM/YYYY') AS "contratoFim",
           c.valor_total AS "contratoValor",
           f.razao_social AS "fornecedorNome", f.documento AS "fornecedorDocumento",
           coalesce(a.objeto, l.objeto) AS "origemObjeto",
           coalesce(a.numero, l.numero) AS "origemNumero",
           CASE WHEN c.ata_id IS NOT NULL THEN 'ATA' ELSE 'LICITACAO' END AS "origemTipo",
           l.modalidade AS "origemModalidade",
           coalesce(a.valor_total, l.valor_total) AS "origemValor"
      FROM processo p
      LEFT JOIN setor sa ON sa.id = p.setor_atual_id
      LEFT JOIN solicitacao s ON s.processo_id = p.id
      LEFT JOIN unidade u ON u.id = s.unidade_solicitante_id
      LEFT JOIN solicitacao_item si ON si.solicitacao_id = s.id
      LEFT JOIN item i ON i.id = si.item_id
      LEFT JOIN contrato c ON c.id = i.contrato_id
      LEFT JOIN fornecedor f ON f.id = c.fornecedor_id
      LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
      LEFT JOIN licitacao l ON l.id = c.licitacao_id
     WHERE p.orgao_id = $1 AND p.id = $2
     LIMIT 1`,

  dossieItens: `
    SELECT i.produto, i.categoria, i.unidade_medida AS "unidadeMedida",
           si.quantidade_solicitada AS "quantidadeSolicitada",
           si.valor_calculado AS "valorCalculado",
           i.saldo_disponivel AS "saldoDisponivel"
      FROM solicitacao s
      JOIN solicitacao_item si ON si.solicitacao_id = s.id
      JOIN item i ON i.id = si.item_id
     WHERE s.orgao_id = $1 AND s.processo_id = $2
     ORDER BY i.categoria NULLS LAST, i.produto`,

  /**
   * A tramitação, com quanto tempo o processo ficou em cada setor.
   *
   * Mesma reconstrução do relatório por setor: o despacho diz de onde o
   * processo saiu, e a chegada é o despacho anterior — ou a abertura, no
   * primeiro trecho.
   */
  dossieTramitacao: `
    SELECT to_char(d.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS data,
           s.nome AS setor, us.nome AS usuario, d.tipo, d.texto,
           floor(EXTRACT(EPOCH FROM (
             d.data - coalesce(
               lag(d.data) OVER (PARTITION BY d.processo_id ORDER BY d.data),
               p.data_abertura
             )
           )) / 86400) AS "diasNoSetor"
      FROM despacho d
      JOIN processo p ON p.id = d.processo_id
      JOIN setor s ON s.id = d.setor_id
      JOIN usuario us ON us.id = d.usuario_id
     WHERE p.orgao_id = $1 AND d.processo_id = $2
     ORDER BY d.data`,

  dossieOrdens: `
    SELECT o.numero,
           to_char(o.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
           o.valor, o.numero_empenho AS "numeroEmpenho",
           o.numero_nota_fiscal AS "numeroNotaFiscal"
      FROM ordem_fornecimento o
     WHERE o.orgao_id = $1 AND o.processo_id = $2
     ORDER BY o.data`,

  dossieDocumentos: `
    SELECT de.id, de.codigo, de.titulo,
           to_char(de.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
           de.emitido_por_nome AS "emitidoPor"
      FROM documento_emitido de
     WHERE de.orgao_id = $1 AND de.referencia_id = $2
     ORDER BY de.data`,

  /**
   * Achar o processo pelo que o servidor conhece: o número.
   *
   * Dois caracteres é o piso — uma letra casaria com metade da prefeitura, e
   * uma lista de vinte resultados aleatórios não ajuda ninguém.
   */
  buscarProcessos: `
    SELECT p.id, p.numero_processo_adm AS "numeroProcessoAdm",
           p.numero_protocolo AS "numeroProtocolo",
           coalesce(nullif(btrim(p.descricao_pedido), ''), p.tipo_processo) AS descricao,
           to_char(p.data_abertura AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "dataAbertura"
      FROM processo p
     WHERE p.orgao_id = $1
       AND (p.numero_processo_adm ILIKE $2
         OR p.numero_protocolo ILIKE $2
         OR coalesce(p.descricao_pedido, '') ILIKE $2)
     ORDER BY p.data_abertura DESC
     LIMIT 20`,

  passagens: `
    WITH passagem AS (
      SELECT d.setor_id,
             coalesce(
               lag(d.data) OVER (PARTITION BY d.processo_id ORDER BY d.data),
               p.data_abertura
             ) AS entrou_em,
             d.data AS saiu_em
        FROM despacho d
        JOIN processo p ON p.id = d.processo_id
       WHERE p.orgao_id = $1
    ),
    atual AS (
      SELECT p.setor_atual_id AS setor_id,
             coalesce(max(d.data), p.data_abertura) AS entrou_em,
             NULL::timestamptz AS saiu_em
        FROM processo p
        LEFT JOIN despacho d ON d.processo_id = p.id
       WHERE p.orgao_id = $1
         AND p.status <> 'ENCERRADO'
         AND p.setor_atual_id IS NOT NULL
       GROUP BY p.id, p.setor_atual_id, p.data_abertura
    ),
    tudo AS (
      SELECT * FROM passagem
      UNION ALL
      SELECT * FROM atual
    )
    SELECT s.id, s.nome,
           count(*) FILTER (
             WHERE t.entrou_em::date BETWEEN $2 AND $3
           ) AS entraram,
           count(*) FILTER (
             WHERE t.saiu_em IS NOT NULL AND t.saiu_em::date BETWEEN $2 AND $3
           ) AS sairam,
           count(*) FILTER (WHERE t.saiu_em IS NULL) AS parados,
           coalesce(round(avg(
             EXTRACT(EPOCH FROM (t.saiu_em - t.entrou_em)) / 86400
           ) FILTER (
             WHERE t.saiu_em IS NOT NULL AND t.saiu_em::date BETWEEN $2 AND $3
           ), 0), 0) AS "diasMedia",
           coalesce(floor(max(
             EXTRACT(EPOCH FROM (now() - t.entrou_em)) / 86400
           ) FILTER (WHERE t.saiu_em IS NULL)), 0) AS "diasMaisAntigo"
      FROM tudo t
      JOIN setor s ON s.id = t.setor_id
     WHERE s.orgao_id = $1
       AND ($4::uuid IS NULL OR s.id = $4)
     GROUP BY s.id, s.nome
    HAVING count(*) FILTER (WHERE t.entrou_em::date BETWEEN $2 AND $3) > 0
        OR count(*) FILTER (WHERE t.saiu_em IS NULL) > 0
     ORDER BY count(*) FILTER (WHERE t.saiu_em IS NULL) DESC, s.nome`,
};

/** `NUMERIC` e `count` vêm como string do driver; a tela soma e compara. */
const numero = (valor: unknown): number => Number(valor ?? 0);

const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

export class PostgresRelatorioProcessoRepository implements RelatorioProcessoRepository {
  panorama = async (orgaoId: string, filtros: FiltrosDoRelatorio): Promise<Panorama> => {
    const parametros = [
      orgaoId, filtros.periodoInicio, filtros.periodoFim,
      filtros.unidadeId ?? null, filtros.fornecedorId ?? null, filtros.modalidade ?? null,
    ];

    const [contratos, licitacoes, fornecedores, unidades] = await Promise.all([
      pool.query(SQL.contratos, parametros),
      pool.query(SQL.licitacoes, parametros),
      pool.query(SQL.fornecedores, parametros),
      pool.query(SQL.unidades, parametros),
    ]);

    const linhasDeContrato: LinhaDeContrato[] = contratos.rows.map((linha) => ({
      ...linha,
      valorContratado: numero(linha.valorContratado),
      valorPedido: numero(linha.valorPedido),
      saldo: numero(linha.saldo),
    }));

    // Os totais saem das linhas, e não de um `sum` à parte: se a consulta
    // filtrar uma linha, o total tem de filtrar junto. Dois caminhos para o
    // mesmo número é a receita de o rodapé não bater com a tabela.
    const valorContratado = arredondar(
      linhasDeContrato.reduce((soma, item) => soma + item.valorContratado, 0),
    );
    const valorPedido = arredondar(
      linhasDeContrato.reduce((soma, item) => soma + item.valorPedido, 0),
    );

    return {
      totais: {
        licitacoes: licitacoes.rows.length,
        contratos: linhasDeContrato.length,
        fornecedores: fornecedores.rows.length,
        valorContratado,
        valorPedido,
        saldo: arredondar(valorContratado - valorPedido),
      },
      contratos: linhasDeContrato,
      licitacoes: licitacoes.rows.map((linha) => ({
        ...linha,
        valorTotal: numero(linha.valorTotal),
        valorContratado: numero(linha.valorContratado),
        contratos: numero(linha.contratos),
      })) as LinhaDeLicitacao[],
      fornecedores: fornecedores.rows.map((linha) => ({
        ...linha,
        contratos: numero(linha.contratos),
        valorContratado: numero(linha.valorContratado),
        valorPedido: numero(linha.valorPedido),
      })) as LinhaDeFornecedor[],
      unidades: unidades.rows.map((linha) => ({
        ...linha,
        contratos: numero(linha.contratos),
        processos: numero(linha.processos),
        valorPedido: numero(linha.valorPedido),
      })) as LinhaDeUnidade[],
    };
  };


  dossie = async (
    orgaoId: string, processoId: string,
  ): Promise<DossieDoProcesso | null> => {
    const { rows } = await pool.query(SQL.dossieProcesso, [orgaoId, processoId]);
    const linha = rows[0];
    if (!linha) return null;

    const [itens, tramitacao, ordens, documentos] = await Promise.all([
      pool.query(SQL.dossieItens, [orgaoId, processoId]),
      pool.query(SQL.dossieTramitacao, [orgaoId, processoId]),
      pool.query(SQL.dossieOrdens, [orgaoId, processoId]),
      pool.query(SQL.dossieDocumentos, [orgaoId, processoId]),
    ]);

    return {
      processo: {
        id: String(linha.id),
        numeroProtocolo: String(linha.numeroProtocolo),
        numeroProcessoAdm: String(linha.numeroProcessoAdm),
        tipo: String(linha.tipo),
        status: String(linha.status),
        dataAbertura: String(linha.dataAbertura),
        dataEncerramento: linha.dataEncerramento ?? null,
        descricaoPedido: linha.descricaoPedido ?? null,
        setorAtual: linha.setorAtual ?? null,
        unidadeSolicitante: linha.unidadeSolicitante ?? null,
      },
      // Processo de balcão não tem contrato, e isso não é erro: é um processo
      // que ainda não virou compra, ou que nunca vai virar.
      contrato: linha.contratoId
        ? {
          id: String(linha.contratoId),
          numero: String(linha.contratoNumero),
          fornecedor: String(linha.fornecedorNome ?? ""),
          documento: String(linha.fornecedorDocumento ?? ""),
          objeto: String(linha.origemObjeto ?? ""),
          dataInicio: String(linha.contratoInicio),
          dataFim: linha.contratoFim ?? null,
          valorTotal: numero(linha.contratoValor),
        }
        : null,
      origem: linha.origemNumero
        ? {
          tipo: linha.origemTipo === "ATA" ? "ATA" : "LICITACAO",
          numero: String(linha.origemNumero),
          modalidade: linha.origemModalidade ?? null,
          objeto: String(linha.origemObjeto ?? ""),
          valorTotal: numero(linha.origemValor),
        }
        : null,
      itens: itens.rows.map((item) => ({
        produto: String(item.produto),
        categoria: item.categoria ?? null,
        unidadeMedida: String(item.unidadeMedida),
        quantidadeSolicitada: numero(item.quantidadeSolicitada),
        valorCalculado: numero(item.valorCalculado),
        saldoDisponivel: numero(item.saldoDisponivel),
      })),
      tramitacao: tramitacao.rows.map((passo) => ({
        data: String(passo.data),
        setor: String(passo.setor),
        usuario: String(passo.usuario),
        tipo: String(passo.tipo),
        texto: passo.texto ?? null,
        diasNoSetor: numero(passo.diasNoSetor),
      })),
      ordens: ordens.rows.map((ordem) => ({
        numero: String(ordem.numero),
        data: String(ordem.data),
        valor: numero(ordem.valor),
        numeroEmpenho: ordem.numeroEmpenho ?? null,
        numeroNotaFiscal: ordem.numeroNotaFiscal ?? null,
      })),
      documentos: documentos.rows.map((documento) => ({
        id: String(documento.id),
        codigo: String(documento.codigo),
        titulo: String(documento.titulo),
        data: String(documento.data),
        emitidoPor: String(documento.emitidoPor ?? ""),
      })),
    };
  };

  buscarProcessos = async (
    orgaoId: string, busca: string,
  ): Promise<ProcessoEncontrado[]> => {
    const texto = busca.trim();
    if (texto.length < 2) return [];

    const { rows } = await pool.query(SQL.buscarProcessos, [orgaoId, `%${texto}%`]);
    return rows as ProcessoEncontrado[];
  };

  porSetor = async (orgaoId: string, filtros: FiltrosDoRelatorio): Promise<PorSetor> => {
    const { rows } = await pool.query(SQL.passagens, [
      orgaoId, filtros.periodoInicio, filtros.periodoFim, filtros.setorId ?? null,
    ]);

    const setores: LinhaDeSetor[] = rows.map((linha) => ({
      id: String(linha.id),
      nome: String(linha.nome),
      entraram: numero(linha.entraram),
      sairam: numero(linha.sairam),
      parados: numero(linha.parados),
      diasMedia: arredondar(numero(linha.diasMedia)),
      diasMaisAntigo: numero(linha.diasMaisAntigo),
    }));

    return {
      totais: {
        entraram: setores.reduce((soma, setor) => soma + setor.entraram, 0),
        sairam: setores.reduce((soma, setor) => soma + setor.sairam, 0),
        parados: setores.reduce((soma, setor) => soma + setor.parados, 0),
      },
      setores,
    };
  };
}

/**
 * O recorte salvo — a pergunta, não a resposta.
 *
 * Fica no mesmo arquivo da apuração de propósito: são as duas metades do mesmo
 * assunto, e separá-las obrigaria quem lê a consulta a procurar noutro lugar o
 * formato do que ela guarda.
 */
const RECORTE = {
  salvar: `
    INSERT INTO relatorio_processo
      (orgao_id, tipo, periodo_inicio, periodo_fim, filtros, criado_por)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    RETURNING id`,
  buscar: `
    SELECT id, tipo,
           to_char(periodo_inicio, 'YYYY-MM-DD') AS "periodoInicio",
           to_char(periodo_fim, 'YYYY-MM-DD') AS "periodoFim",
           filtros
      FROM relatorio_processo
     WHERE orgao_id = $1 AND id = $2`,
};

export class PostgresRecorteRepository implements RecorteRepository {
  salvar = async (
    orgaoId: string,
    usuarioId: string,
    tipo: TipoDeRelatorio,
    filtros: FiltrosDoRelatorio,
  ): Promise<{ id: string }> => {
    // O período tem coluna própria — é o filtro que todo relatório tem, e o
    // CHECK do banco o confere. O resto vai no JSONB, sem as chaves vazias:
    // filtro ausente é ausência, não um nulo a interpretar depois.
    const { periodoInicio: _inicio, periodoFim: _fim, ...opcionais } = filtros;
    const guardados = Object.fromEntries(
      Object.entries(opcionais).filter(([, valor]) => valor),
    );

    const { rows } = await pool.query(RECORTE.salvar, [
      orgaoId, tipo, filtros.periodoInicio, filtros.periodoFim,
      JSON.stringify(guardados), usuarioId,
    ]);
    return { id: rows[0].id as string };
  };

  buscar = async (orgaoId: string, id: string): Promise<RecorteSalvo | null> => {
    const { rows } = await pool.query(RECORTE.buscar, [orgaoId, id]);
    const linha = rows[0];
    return linha
      ? {
        id: String(linha.id),
        tipo: String(linha.tipo) as TipoDeRelatorio,
        periodoInicio: String(linha.periodoInicio),
        periodoFim: String(linha.periodoFim),
        filtros: (linha.filtros ?? {}) as Record<string, string | null>,
      }
      : null;
  };
}
