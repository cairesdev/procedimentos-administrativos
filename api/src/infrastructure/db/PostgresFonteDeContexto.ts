import { pool } from "./pool";
import { valorPorExtenso } from "../../domain/documento/PorExtenso";
import type { FonteDeContexto } from "../../application/documento/EmitirDocumento";
import type { ContextoDeDocumento } from "../../domain/documento/Marcadores";

/**
 * Junta os dados que o modelo pode interpolar.
 *
 * O `referenciaId` muda de significado conforme o tipo: peça de tramitação
 * aponta para o processo, ordem de fornecimento aponta para a própria ordem.
 * Quem chama a rota já sabe disso; aqui só se traduz para o contexto.
 */

const ORGAO = `
  SELECT o.nome, o.cnpj, o.municipio, o.uf, coalesce(o.endereco, '') AS endereco
    FROM orgao o WHERE o.id = $1`;

const PROCESSO = `
  SELECT p.numero_protocolo AS "numeroProtocolo",
         p.numero_processo_adm AS "numeroProcessoAdm",
         p.tipo_processo AS "tipo", p.status,
         to_char(p.data_abertura AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "dataAbertura",
         coalesce(s.nome, '—') AS "setorAtual",
         coalesce(u.nome, '—') AS "unidadeSolicitante"
    FROM processo p
    LEFT JOIN setor s ON s.id = p.setor_atual_id
    LEFT JOIN solicitacao sol ON sol.processo_id = p.id
    LEFT JOIN unidade u ON u.id = sol.unidade_solicitante_id
   WHERE p.orgao_id = $1 AND p.id = $2`;

/** Contrato ligado ao processo pela solicitação — o caminho que o modelo usa. */
const CONTRATO_DO_PROCESSO = `
  SELECT DISTINCT ON (c.id)
         c.numero, coalesce(a.objeto, l.objeto, '') AS objeto,
         to_char(c.data_inicio, 'DD/MM/YYYY') AS "dataInicio",
         coalesce(to_char(c.data_fim, 'DD/MM/YYYY'), 'sem termo') AS "dataFim",
         c.valor_total AS "valorTotal",
         coalesce(c.fiscal_nome_matricula, '—') AS fiscal,
         CASE WHEN c.ata_id IS NOT NULL THEN 'Ata' ELSE 'Licitação' END AS origem,
         coalesce(a.numero, l.numero, '—') AS "origemNumero",
         f.razao_social AS "fornecedorRazaoSocial", f.documento AS "fornecedorDocumento",
         coalesce(f.endereco, '') AS "fornecedorEndereco",
         coalesce(f.email, '') AS "fornecedorEmail",
         coalesce(f.telefone, '') AS "fornecedorTelefone",
         coalesce(f.inscricao_estadual, '') AS "fornecedorInscricaoEstadual",
         coalesce(f.inscricao_municipal, '') AS "fornecedorInscricaoMunicipal"
    FROM contrato c
    JOIN fornecedor f ON f.id = c.fornecedor_id
    LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
    LEFT JOIN licitacao l ON l.id = c.licitacao_id
    JOIN item i ON i.contrato_id = c.id
    JOIN solicitacao_item si ON si.item_id = i.id
    JOIN solicitacao s ON s.id = si.solicitacao_id
   WHERE c.orgao_id = $1 AND s.processo_id = $2
   ORDER BY c.id
   LIMIT 1`;

const ORDEM = `
  SELECT o.numero, coalesce(o.numero_empenho, '') AS "numeroEmpenho",
         coalesce(o.numero_requisicao, '') AS "numeroRequisicao",
         coalesce(o.projeto_atividade, '') AS "projetoAtividade",
         coalesce(o.elemento_despesa, '') AS "elementoDespesa",
         coalesce(o.fonte_recurso, '') AS "fonteRecurso",
         coalesce(o.numero_parcelas, 1) AS "numeroParcelas",
         coalesce(o.numero_nota_fiscal, '') AS "numeroNotaFiscal",
         o.valor, o.processo_id AS "processoId", o.contrato_id AS "contratoId"
    FROM ordem_fornecimento o
   WHERE o.orgao_id = $1 AND o.id = $2`;

const CONTRATO_POR_ID = `
  SELECT c.numero, coalesce(a.objeto, l.objeto, '') AS objeto,
         to_char(c.data_inicio, 'DD/MM/YYYY') AS "dataInicio",
         coalesce(to_char(c.data_fim, 'DD/MM/YYYY'), 'sem termo') AS "dataFim",
         c.valor_total AS "valorTotal",
         coalesce(c.fiscal_nome_matricula, '—') AS fiscal,
         CASE WHEN c.ata_id IS NOT NULL THEN 'Ata' ELSE 'Licitação' END AS origem,
         coalesce(a.numero, l.numero, '—') AS "origemNumero",
         f.razao_social AS "fornecedorRazaoSocial", f.documento AS "fornecedorDocumento",
         coalesce(f.endereco, '') AS "fornecedorEndereco",
         coalesce(f.email, '') AS "fornecedorEmail",
         coalesce(f.telefone, '') AS "fornecedorTelefone",
         coalesce(f.inscricao_estadual, '') AS "fornecedorInscricaoEstadual",
         coalesce(f.inscricao_municipal, '') AS "fornecedorInscricaoMunicipal"
    FROM contrato c
    JOIN fornecedor f ON f.id = c.fornecedor_id
    LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
    LEFT JOIN licitacao l ON l.id = c.licitacao_id
   WHERE c.orgao_id = $1 AND c.id = $2`;

/** Itens da solicitação do processo — o que a ordem manda entregar. */
const ITENS_DO_PROCESSO = `
  SELECT i.produto, coalesce(i.descricao, '') AS descricao,
         i.unidade_medida AS "unidadeMedida", coalesce(i.marca, '') AS marca,
         si.quantidade_solicitada AS quantidade,
         i.valor_unitario AS "valorUnitario",
         si.valor_calculado AS "valorTotal"
    FROM solicitacao_item si
    JOIN item i ON i.id = si.item_id
    JOIN solicitacao s ON s.id = si.solicitacao_id
   WHERE s.processo_id = $1
   ORDER BY i.produto`;

const SOLICITACAO = `
  SELECT s.situacao, s.processo_id AS "processoId",
         to_char(s.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "criadaEm",
         coalesce((SELECT sum(si.valor_calculado) FROM solicitacao_item si
                    WHERE si.solicitacao_id = s.id), 0) AS "valorTotal"
    FROM solicitacao s
   WHERE s.orgao_id = $1 AND s.id = $2`;

const ITENS_DA_SOLICITACAO = `
  SELECT i.produto, coalesce(i.descricao, '') AS descricao,
         i.unidade_medida AS "unidadeMedida", coalesce(i.marca, '') AS marca,
         si.quantidade_solicitada AS quantidade,
         i.valor_unitario AS "valorUnitario",
         si.valor_calculado AS "valorTotal"
    FROM solicitacao_item si
    JOIN item i ON i.id = si.item_id
   WHERE si.solicitacao_id = $1
   ORDER BY i.produto`;

const PARECER = `
  SELECT d.tipo, coalesce(d.texto, '') AS texto,
         coalesce(s.nome, '—') AS "setorDestino"
    FROM despacho d
    LEFT JOIN setor s ON s.id = d.setor_id
   WHERE d.processo_id = $1
   ORDER BY d.data DESC
   LIMIT 1`;

const dinheiro = (valor: unknown) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(Number(valor ?? 0));

const numero = (valor: unknown) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(valor ?? 0));

/** Item no formato que o modelo consome, com números já formatados. */
const itemParaContexto = (linha: Record<string, unknown>) => ({
  produto: String(linha.produto ?? ""),
  descricao: String(linha.descricao ?? ""),
  unidadeMedida: String(linha.unidadeMedida ?? ""),
  marca: String(linha.marca ?? ""),
  quantidade: numero(linha.quantidade),
  valorUnitario: dinheiro(linha.valorUnitario),
  valorTotal: dinheiro(linha.valorTotal),
});

const contratoParaContexto = (linha: Record<string, unknown>) => ({
  contrato: {
    numero: String(linha.numero ?? ""),
    objeto: String(linha.objeto ?? ""),
    dataInicio: String(linha.dataInicio ?? ""),
    dataFim: String(linha.dataFim ?? "—"),
    valorTotal: dinheiro(linha.valorTotal),
    valorTotalPorExtenso: valorPorExtenso(Number(linha.valorTotal ?? 0)),
    fiscal: String(linha.fiscal ?? ""),
    origem: String(linha.origem ?? ""),
    origemNumero: String(linha.origemNumero ?? ""),
  },
  fornecedor: {
    razaoSocial: String(linha.fornecedorRazaoSocial ?? ""),
    documento: String(linha.fornecedorDocumento ?? ""),
    endereco: String(linha.fornecedorEndereco ?? ""),
    email: String(linha.fornecedorEmail ?? ""),
    telefone: String(linha.fornecedorTelefone ?? ""),
    inscricaoEstadual: String(linha.fornecedorInscricaoEstadual ?? ""),
    inscricaoMunicipal: String(linha.fornecedorInscricaoMunicipal ?? ""),
  },
});

export class PostgresFonteDeContexto implements FonteDeContexto {
  /**
   * O escopo do modelo decide o que buscar e o que o `referenciaId` significa.
   * Antes isso era decidido pelo `tipo`, o que impedia peça nova sem código.
   */
  montar = async (
    orgaoId: string,
    escopo: string,
    referenciaId: string,
  ): Promise<ContextoDeDocumento | null> => {
    const orgao = (await pool.query(ORGAO, [orgaoId])).rows[0];
    if (!orgao) return null;

    if (escopo === "PROCESSO" || escopo === "PROCESSO_CONTRATO") {
      return this.doProcesso(orgaoId, escopo, referenciaId, orgao);
    }
    if (escopo === "ORDEM_FORNECIMENTO") return this.daOrdem(orgaoId, referenciaId, orgao);
    if (escopo === "SOLICITACAO") return this.daSolicitacao(orgaoId, referenciaId, orgao);
    return null;
  };

  private doProcesso = async (
    orgaoId: string,
    escopo: string,
    processoId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const processo = (await pool.query(PROCESSO, [orgaoId, processoId])).rows[0];
    if (!processo) return null;

    // Último despacho: serve de texto ao despacho e de justificativa ao
    // parecer. Vem sempre, porque qualquer peça de trâmite pode citá-lo.
    const ultimo = (await pool.query(PARECER, [processoId])).rows[0];
    const contexto: ContextoDeDocumento = {
      orgao,
      processo,
      despacho: {
        texto: String(ultimo?.texto ?? ""),
        setorDestino: String(ultimo?.setorDestino ?? "—"),
      },
      parecer: {
        favoravel: ultimo?.tipo === "PARECER" ? "favorável" : "—",
        justificativa: String(ultimo?.texto ?? ""),
      },
    };

    if (escopo === "PROCESSO_CONTRATO") {
      const contrato = (await pool.query(CONTRATO_DO_PROCESSO, [orgaoId, processoId])).rows[0];
      // Sem contrato ligado, os marcadores viriam vazios e o documento sairia
      // afirmando coisa sobre um contrato que não existe.
      if (!contrato) return null;
      Object.assign(contexto, contratoParaContexto(contrato));
    }

    return contexto;
  };

  private daOrdem = async (
    orgaoId: string,
    ordemId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const ordem = (await pool.query(ORDEM, [orgaoId, ordemId])).rows[0];
    if (!ordem) return null;

    const [processo, contrato, itens] = await Promise.all([
      pool.query(PROCESSO, [orgaoId, ordem.processoId]),
      pool.query(CONTRATO_POR_ID, [orgaoId, ordem.contratoId]),
      pool.query(ITENS_DO_PROCESSO, [ordem.processoId]),
    ]);
    if (!processo.rows[0] || !contrato.rows[0]) return null;

    return {
      orgao,
      processo: processo.rows[0],
      ...contratoParaContexto(contrato.rows[0]),
      ordem: {
        numero: String(ordem.numero),
        numeroEmpenho: String(ordem.numeroEmpenho),
        numeroRequisicao: String(ordem.numeroRequisicao),
        projetoAtividade: String(ordem.projetoAtividade),
        elementoDespesa: String(ordem.elementoDespesa),
        fonteRecurso: String(ordem.fonteRecurso),
        numeroParcelas: String(ordem.numeroParcelas),
        numeroNotaFiscal: String(ordem.numeroNotaFiscal),
        valor: dinheiro(ordem.valor),
        valorPorExtenso: valorPorExtenso(Number(ordem.valor)),
      },
      itens: itens.rows.map(itemParaContexto),
    };
  };

  private daSolicitacao = async (
    orgaoId: string,
    solicitacaoId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const solicitacao = (await pool.query(SOLICITACAO, [orgaoId, solicitacaoId])).rows[0];
    if (!solicitacao) return null;

    const itens = await pool.query(ITENS_DA_SOLICITACAO, [solicitacaoId]);
    // Rascunho ainda não tem processo; os marcadores vêm com traço em vez de
    // vazio, para a peça não sair com lacuna muda.
    const processo = solicitacao.processoId
      ? (await pool.query(PROCESSO, [orgaoId, solicitacao.processoId])).rows[0]
      : null;

    return {
      orgao,
      processo: processo ?? {
        numeroProtocolo: "—", numeroProcessoAdm: "—", tipo: "—", status: "RASCUNHO",
        dataAbertura: "—", setorAtual: "—", unidadeSolicitante: "—",
      },
      solicitacao: {
        situacao: String(solicitacao.situacao),
        criadaEm: String(solicitacao.criadaEm),
        valorTotal: dinheiro(solicitacao.valorTotal),
        valorTotalPorExtenso: valorPorExtenso(Number(solicitacao.valorTotal)),
      },
      itens: itens.rows.map(itemParaContexto),
    };
  };
}
