import { pool, executarEmTransacao } from "./pool";
import type {
  AbastecimentoResumo, DadosFinalizacao, DadosRetirada, EdicaoMotorista, EdicaoVeiculo,
  EncerramentoManutencao, FrotaRepository, LinhaDaAgenda, LinhaDoRelatorio, ManutencaoResumo,
  MotoristaResumo, NovaManutencao, NovaViagem, NovoAbastecimento, NovoMotorista, NovoVeiculo,
  StatusViagem, VeiculoResumo, ViagemDetalhe, ViagemResumo,
} from "../../application/ports/FrotaRepository";

// Janela usada para avisar sobre choque de agenda do mesmo veículo. A decisão
// do projeto é avisar, nunca bloquear — o gestor decide.
const JANELA_CONFLITO_HORAS = 4;

const SQL = {
  compartilhamento: `
    SELECT compartilha_entre_secretarias AS "compartilha"
      FROM frota_config WHERE orgao_id = $1`,

  listarVeiculos: `
    SELECT v.id, v.placa, v.modelo, v.ano, v.tipo, v.unidade_id AS "unidadeId",
           v.quilometragem_atual AS "quilometragemAtual", v.ativo,
           EXISTS (SELECT 1 FROM manutencao m
                    WHERE m.veiculo_id = v.id AND m.data_fim IS NULL) AS "emManutencao",
           (SELECT count(*) FROM viagem t WHERE t.veiculo_id = v.id) AS viagens
      FROM veiculo v
     WHERE v.orgao_id = $1
     ORDER BY v.placa`,
  buscarVeiculo: `
    SELECT v.id, v.placa, v.modelo, v.ano, v.tipo, v.unidade_id AS "unidadeId",
           v.quilometragem_atual AS "quilometragemAtual", v.ativo,
           EXISTS (SELECT 1 FROM manutencao m
                    WHERE m.veiculo_id = v.id AND m.data_fim IS NULL) AS "emManutencao",
           (SELECT count(*) FROM viagem t WHERE t.veiculo_id = v.id) AS viagens
      FROM veiculo v
     WHERE v.orgao_id = $1 AND v.id = $2`,
  existePlaca: `
    SELECT 1 FROM veiculo
     WHERE orgao_id = $1 AND upper(placa) = upper($2) AND ($3::uuid IS NULL OR id <> $3)`,
  criarVeiculo: `
    INSERT INTO veiculo (orgao_id, unidade_id, placa, modelo, ano, tipo)
    VALUES ($1, $2, upper($3), $4, $5, $6) RETURNING id`,
  atualizarVeiculo: `
    UPDATE veiculo
       SET modelo = COALESCE($3, modelo),
           ano = CASE WHEN $4::boolean THEN $5 ELSE ano END,
           tipo = CASE WHEN $6::boolean THEN $7 ELSE tipo END,
           unidade_id = CASE WHEN $8::boolean THEN $9 ELSE unidade_id END,
           ativo = COALESCE($10, ativo)
     WHERE orgao_id = $1 AND id = $2`,
  removerVeiculo: `DELETE FROM veiculo WHERE orgao_id = $1 AND id = $2`,

  listarMotoristas: `
    SELECT m.id, m.nome, m.cnh, m.categoria_cnh AS "categoriaCnh",
           m.validade_cnh AS "validadeCnh", m.usuario_id AS "usuarioId", m.ativo,
           (m.validade_cnh - CURRENT_DATE) AS "diasParaVencerCnh",
           (SELECT count(*) FROM viagem t WHERE t.motorista_id = m.id) AS viagens
      FROM motorista m
     WHERE m.orgao_id = $1
     ORDER BY m.nome`,
  buscarMotorista: `
    SELECT m.id, m.nome, m.cnh, m.categoria_cnh AS "categoriaCnh",
           m.validade_cnh AS "validadeCnh", m.usuario_id AS "usuarioId", m.ativo,
           (m.validade_cnh - CURRENT_DATE) AS "diasParaVencerCnh",
           (SELECT count(*) FROM viagem t WHERE t.motorista_id = m.id) AS viagens
      FROM motorista m
     WHERE m.orgao_id = $1 AND m.id = $2`,
  criarMotorista: `
    INSERT INTO motorista (orgao_id, usuario_id, nome, cnh, categoria_cnh, validade_cnh)
    VALUES ($1, $2, $3, $4, upper($5), $6) RETURNING id`,
  atualizarMotorista: `
    UPDATE motorista
       SET nome = COALESCE($3, nome),
           cnh = COALESCE($4, cnh),
           categoria_cnh = COALESCE(upper($5), categoria_cnh),
           validade_cnh = COALESCE($6, validade_cnh),
           usuario_id = CASE WHEN $7::boolean THEN $8 ELSE usuario_id END,
           ativo = COALESCE($9, ativo)
     WHERE orgao_id = $1 AND id = $2`,
  removerMotorista: `DELETE FROM motorista WHERE orgao_id = $1 AND id = $2`,

  listarViagens: `
    SELECT t.id, t.unidade_solicitante_id AS "unidadeSolicitanteId",
           u.nome AS "unidadeSolicitanteNome",
           t.veiculo_id AS "veiculoId", v.placa AS "veiculoPlaca", v.modelo AS "veiculoModelo",
           t.motorista_id AS "motoristaId", m.nome AS "motoristaNome",
           t.data_hora_desejada AS "dataHoraDesejada",
           t.data_hora_remarcada AS "dataHoraRemarcada",
           t.motivo, t.responsavel, t.status, t.created_at AS "createdAt"
      FROM viagem t
      JOIN unidade u ON u.id = t.unidade_solicitante_id
      JOIN veiculo v ON v.id = t.veiculo_id
      JOIN motorista m ON m.id = t.motorista_id
     WHERE t.orgao_id = $1
       AND ($2::text IS NULL OR t.status = $2)
       AND ($3::uuid IS NULL OR t.veiculo_id = $3)
       AND ($4::timestamptz IS NULL OR coalesce(t.data_hora_remarcada, t.data_hora_desejada) >= $4)
       AND ($5::timestamptz IS NULL OR coalesce(t.data_hora_remarcada, t.data_hora_desejada) <= $5)
     ORDER BY coalesce(t.data_hora_remarcada, t.data_hora_desejada) DESC`,
  buscarViagem: `
    SELECT t.id, t.unidade_solicitante_id AS "unidadeSolicitanteId",
           u.nome AS "unidadeSolicitanteNome",
           t.veiculo_id AS "veiculoId", v.placa AS "veiculoPlaca", v.modelo AS "veiculoModelo",
           t.motorista_id AS "motoristaId", m.nome AS "motoristaNome",
           t.data_hora_desejada AS "dataHoraDesejada",
           t.data_hora_remarcada AS "dataHoraRemarcada",
           t.motivo, t.responsavel, t.status, t.created_at AS "createdAt",
           r.km_inicial AS "retiradaKmInicial", r.data_hora AS "retiradaDataHora",
           r.motorista_id AS "retiradaMotoristaId", rm.nome AS "retiradaMotoristaNome",
           r.nota_combustivel_tipo AS "retiradaNotaTipo",
           r.nota_combustivel_quantidade AS "retiradaNotaQuantidade",
           f.data_hora AS "finalizacaoDataHora", f.km_final AS "finalizacaoKmFinal",
           f.sinistro AS "finalizacaoSinistro"
      FROM viagem t
      JOIN unidade u ON u.id = t.unidade_solicitante_id
      JOIN veiculo v ON v.id = t.veiculo_id
      JOIN motorista m ON m.id = t.motorista_id
      LEFT JOIN retirada r ON r.viagem_id = t.id
      LEFT JOIN motorista rm ON rm.id = r.motorista_id
      LEFT JOIN finalizacao f ON f.viagem_id = t.id
     WHERE t.orgao_id = $1 AND t.id = $2`,
  criarViagem: `
    INSERT INTO viagem (orgao_id, unidade_solicitante_id, veiculo_id, motorista_id,
                        data_hora_desejada, motivo, responsavel)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
  // Só avisa: viagens vivas do mesmo veículo dentro da janela.
  conflitos: `
    SELECT t.id, t.unidade_solicitante_id AS "unidadeSolicitanteId",
           u.nome AS "unidadeSolicitanteNome",
           t.veiculo_id AS "veiculoId", v.placa AS "veiculoPlaca", v.modelo AS "veiculoModelo",
           t.motorista_id AS "motoristaId", m.nome AS "motoristaNome",
           t.data_hora_desejada AS "dataHoraDesejada",
           t.data_hora_remarcada AS "dataHoraRemarcada",
           t.motivo, t.responsavel, t.status, t.created_at AS "createdAt"
      FROM viagem t
      JOIN unidade u ON u.id = t.unidade_solicitante_id
      JOIN veiculo v ON v.id = t.veiculo_id
      JOIN motorista m ON m.id = t.motorista_id
     WHERE t.orgao_id = $1
       AND t.veiculo_id = $2
       AND t.status IN ('SOLICITADA', 'APROVADA', 'REMARCADA', 'RETIRADA')
       AND ($4::uuid IS NULL OR t.id <> $4)
       AND coalesce(t.data_hora_remarcada, t.data_hora_desejada)
             BETWEEN $3::timestamptz - ($5 || ' hours')::interval
                 AND $3::timestamptz + ($5 || ' hours')::interval
     ORDER BY coalesce(t.data_hora_remarcada, t.data_hora_desejada)`,
  mudarStatus: `
    UPDATE viagem
       SET status = $3,
           data_hora_remarcada = COALESCE($4, data_hora_remarcada)
     WHERE orgao_id = $1 AND id = $2`,
  registrarRetirada: `
    INSERT INTO retirada (viagem_id, km_inicial, data_hora, motorista_id,
                          nota_combustivel_tipo, nota_combustivel_quantidade)
    VALUES ($1, $2, $3, $4, $5, $6)`,
  registrarFinalizacao: `
    INSERT INTO finalizacao (viagem_id, data_hora, km_final, sinistro)
    VALUES ($1, $2, $3, $4)`,
  atualizarKmVeiculo: `
    UPDATE veiculo SET quilometragem_atual = $3 WHERE orgao_id = $1 AND id = $2`,

  // O órgão é alcançado pela viagem: abastecimento não tem orgao_id próprio.
  listarAbastecimentos: `
    SELECT a.id, a.viagem_id AS "viagemId", a.data, a.litros, a.valor
      FROM abastecimento a
      JOIN viagem t ON t.id = a.viagem_id
     WHERE t.orgao_id = $1 AND a.viagem_id = $2
     ORDER BY a.data`,
  buscarAbastecimento: `
    SELECT a.id, a.viagem_id AS "viagemId", a.data, a.litros, a.valor
      FROM abastecimento a
      JOIN viagem t ON t.id = a.viagem_id
     WHERE t.orgao_id = $1 AND a.id = $2`,
  registrarAbastecimento: `
    INSERT INTO abastecimento (viagem_id, data, litros, valor)
    VALUES ($1, $2, $3, $4) RETURNING id`,
  removerAbastecimento: `DELETE FROM abastecimento WHERE id = $1`,

  // LEFT JOIN para o veículo sem viagem na semana continuar aparecendo na grade.
  agenda: `
    SELECT v.id AS "veiculoId", v.placa, v.modelo, v.ativo,
           EXISTS (SELECT 1 FROM manutencao m
                    WHERE m.veiculo_id = v.id AND m.data_fim IS NULL) AS "emManutencao",
           t.id, t.unidade_solicitante_id AS "unidadeSolicitanteId",
           u.nome AS "unidadeSolicitanteNome",
           t.veiculo_id AS "viagemVeiculoId", t.motorista_id AS "motoristaId",
           mo.nome AS "motoristaNome",
           t.data_hora_desejada AS "dataHoraDesejada",
           t.data_hora_remarcada AS "dataHoraRemarcada",
           t.motivo, t.responsavel, t.status, t.created_at AS "createdAt"
      FROM veiculo v
      LEFT JOIN viagem t
             ON t.veiculo_id = v.id
            AND t.status NOT IN ('RECUSADA', 'CANCELADA')
            AND coalesce(t.data_hora_remarcada, t.data_hora_desejada) >= $2::timestamptz
            AND coalesce(t.data_hora_remarcada, t.data_hora_desejada) < $3::timestamptz
      LEFT JOIN unidade u ON u.id = t.unidade_solicitante_id
      LEFT JOIN motorista mo ON mo.id = t.motorista_id
     WHERE v.orgao_id = $1
     ORDER BY v.placa, coalesce(t.data_hora_remarcada, t.data_hora_desejada)`,

  // Subconsultas em vez de joins: join múltiplo multiplicaria as somas.
  relatorioDeUso: `
    SELECT v.id AS "veiculoId", v.placa, v.modelo,
           (SELECT count(*) FROM viagem t
              JOIN finalizacao f ON f.viagem_id = t.id
             WHERE t.veiculo_id = v.id
               AND f.data_hora >= $2::timestamptz AND f.data_hora < $3::timestamptz
           ) AS "viagensFinalizadas",
           coalesce((SELECT sum(f.km_final - r.km_inicial) FROM viagem t
              JOIN finalizacao f ON f.viagem_id = t.id
              JOIN retirada r ON r.viagem_id = t.id
             WHERE t.veiculo_id = v.id
               AND f.data_hora >= $2::timestamptz AND f.data_hora < $3::timestamptz
           ), 0) AS "kmRodado",
           coalesce((SELECT sum(a.litros) FROM abastecimento a
              JOIN viagem t ON t.id = a.viagem_id
             WHERE t.veiculo_id = v.id
               AND a.data >= $2::timestamptz AND a.data < $3::timestamptz
           ), 0) AS litros,
           coalesce((SELECT sum(a.valor) FROM abastecimento a
              JOIN viagem t ON t.id = a.viagem_id
             WHERE t.veiculo_id = v.id
               AND a.data >= $2::timestamptz AND a.data < $3::timestamptz
           ), 0) AS "valorCombustivel",
           coalesce((SELECT sum(m.custo) FROM manutencao m
             WHERE m.veiculo_id = v.id
               AND m.data_inicio >= $2::date AND m.data_inicio < $3::date
           ), 0) AS "custoManutencao"
      FROM veiculo v
     WHERE v.orgao_id = $1
     ORDER BY v.placa`,

  listarManutencoes: `
    SELECT m.id, m.veiculo_id AS "veiculoId", v.placa AS "veiculoPlaca", m.tipo,
           m.data_inicio AS "dataInicio", m.data_fim AS "dataFim",
           m.descricao, m.oficina, m.custo
      FROM manutencao m
      JOIN veiculo v ON v.id = m.veiculo_id
     WHERE v.orgao_id = $1
       AND ($2::uuid IS NULL OR m.veiculo_id = $2)
       AND ($3::boolean IS NULL OR (m.data_fim IS NULL) = $3)
     ORDER BY m.data_inicio DESC`,
  buscarManutencao: `
    SELECT m.id, m.veiculo_id AS "veiculoId", v.placa AS "veiculoPlaca", m.tipo,
           m.data_inicio AS "dataInicio", m.data_fim AS "dataFim",
           m.descricao, m.oficina, m.custo
      FROM manutencao m
      JOIN veiculo v ON v.id = m.veiculo_id
     WHERE v.orgao_id = $1 AND m.id = $2`,
  abrirManutencao: `
    INSERT INTO manutencao (veiculo_id, tipo, data_inicio, descricao, oficina, custo)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
  encerrarManutencao: `
    UPDATE manutencao
       SET data_fim = $2, custo = COALESCE($3, custo), descricao = COALESCE($4, descricao)
     WHERE id = $1`,
  removerManutencao: `DELETE FROM manutencao WHERE id = $1`,
};

const numerico = <T extends Record<string, unknown>>(linha: T, campos: string[]): T => {
  const convertido = { ...linha };
  for (const campo of campos) {
    if (convertido[campo] !== null && convertido[campo] !== undefined) {
      convertido[campo as keyof T] = Number(linha[campo]) as never;
    }
  }
  return convertido;
};

// O detalhe vem achatado do SQL; aqui vira o objeto aninhado do port.
const montarDetalhe = (linha: Record<string, unknown>): ViagemDetalhe => {
  const {
    retiradaKmInicial, retiradaDataHora, retiradaMotoristaId, retiradaMotoristaNome,
    retiradaNotaTipo, retiradaNotaQuantidade,
    finalizacaoDataHora, finalizacaoKmFinal, finalizacaoSinistro,
    ...viagem
  } = linha;

  return {
    ...(viagem as unknown as ViagemResumo),
    retirada: retiradaDataHora
      ? {
          kmInicial: Number(retiradaKmInicial),
          dataHora: retiradaDataHora as string,
          motoristaId: retiradaMotoristaId as string,
          motoristaNome: retiradaMotoristaNome as string,
          notaCombustivelTipo: (retiradaNotaTipo as "LITRO" | "VALOR" | null) ?? null,
          notaCombustivelQuantidade:
            retiradaNotaQuantidade === null || retiradaNotaQuantidade === undefined
              ? null
              : Number(retiradaNotaQuantidade),
        }
      : null,
    finalizacao: finalizacaoDataHora
      ? {
          dataHora: finalizacaoDataHora as string,
          kmFinal: Number(finalizacaoKmFinal),
          sinistro: (finalizacaoSinistro as string | null) ?? null,
        }
      : null,
  };
};

export class PostgresFrotaRepository implements FrotaRepository {
  compartilhaEntreSecretarias = async (orgaoId: string): Promise<boolean> => {
    const { rows } = await pool.query(SQL.compartilhamento, [orgaoId]);
    return rows[0]?.compartilha ?? false;
  };

  listarVeiculos = async (orgaoId: string): Promise<VeiculoResumo[]> => {
    const { rows } = await pool.query(SQL.listarVeiculos, [orgaoId]);
    return rows.map((linha) => numerico(linha, ["quilometragemAtual", "viagens"]));
  };

  buscarVeiculo = async (orgaoId: string, id: string): Promise<VeiculoResumo | null> => {
    const { rows } = await pool.query(SQL.buscarVeiculo, [orgaoId, id]);
    return rows[0] ? numerico(rows[0], ["quilometragemAtual", "viagens"]) : null;
  };

  existePlaca = async (orgaoId: string, placa: string, ignorarId?: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existePlaca, [orgaoId, placa, ignorarId ?? null]);
    return (rowCount ?? 0) > 0;
  };

  criarVeiculo = async (dados: NovoVeiculo): Promise<string> => {
    const { rows } = await pool.query(SQL.criarVeiculo, [
      dados.orgaoId, dados.unidadeId ?? null, dados.placa, dados.modelo,
      dados.ano ?? null, dados.tipo ?? null,
    ]);
    return rows[0].id;
  };

  atualizarVeiculo = async (
    orgaoId: string,
    id: string,
    dados: EdicaoVeiculo,
  ): Promise<void> => {
    await pool.query(SQL.atualizarVeiculo, [
      orgaoId, id,
      dados.modelo ?? null,
      "ano" in dados, dados.ano ?? null,
      "tipo" in dados, dados.tipo ?? null,
      "unidadeId" in dados, dados.unidadeId ?? null,
      dados.ativo ?? null,
    ]);
  };

  removerVeiculo = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerVeiculo, [orgaoId, id]);
  };

  listarMotoristas = async (orgaoId: string): Promise<MotoristaResumo[]> => {
    const { rows } = await pool.query(SQL.listarMotoristas, [orgaoId]);
    return rows.map((linha) => numerico(linha, ["diasParaVencerCnh", "viagens"]));
  };

  buscarMotorista = async (orgaoId: string, id: string): Promise<MotoristaResumo | null> => {
    const { rows } = await pool.query(SQL.buscarMotorista, [orgaoId, id]);
    return rows[0] ? numerico(rows[0], ["diasParaVencerCnh", "viagens"]) : null;
  };

  criarMotorista = async (dados: NovoMotorista): Promise<string> => {
    const { rows } = await pool.query(SQL.criarMotorista, [
      dados.orgaoId, dados.usuarioId ?? null, dados.nome, dados.cnh,
      dados.categoriaCnh, dados.validadeCnh,
    ]);
    return rows[0].id;
  };

  atualizarMotorista = async (
    orgaoId: string,
    id: string,
    dados: EdicaoMotorista,
  ): Promise<void> => {
    await pool.query(SQL.atualizarMotorista, [
      orgaoId, id,
      dados.nome ?? null, dados.cnh ?? null, dados.categoriaCnh ?? null,
      dados.validadeCnh ?? null,
      "usuarioId" in dados, dados.usuarioId ?? null,
      dados.ativo ?? null,
    ]);
  };

  removerMotorista = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerMotorista, [orgaoId, id]);
  };

  listarViagens = async (
    orgaoId: string,
    filtros: { status?: string; veiculoId?: string; de?: string; ate?: string },
  ): Promise<ViagemResumo[]> => {
    const { rows } = await pool.query(SQL.listarViagens, [
      orgaoId, filtros.status ?? null, filtros.veiculoId ?? null,
      filtros.de ?? null, filtros.ate ?? null,
    ]);
    return rows;
  };

  buscarViagem = async (orgaoId: string, id: string): Promise<ViagemDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscarViagem, [orgaoId, id]);
    return rows[0] ? montarDetalhe(rows[0]) : null;
  };

  criarViagem = async (dados: NovaViagem): Promise<string> => {
    const { rows } = await pool.query(SQL.criarViagem, [
      dados.orgaoId, dados.unidadeSolicitanteId, dados.veiculoId, dados.motoristaId,
      dados.dataHoraDesejada, dados.motivo, dados.responsavel,
    ]);
    return rows[0].id;
  };

  conflitosDeAgenda = async (
    orgaoId: string,
    veiculoId: string,
    dataHora: string,
    ignorarViagemId?: string,
  ): Promise<ViagemResumo[]> => {
    const { rows } = await pool.query(SQL.conflitos, [
      orgaoId, veiculoId, dataHora, ignorarViagemId ?? null, String(JANELA_CONFLITO_HORAS),
    ]);
    return rows;
  };

  mudarStatusViagem = async (
    orgaoId: string,
    id: string,
    status: StatusViagem,
    dataHoraRemarcada?: string,
  ): Promise<void> => {
    await pool.query(SQL.mudarStatus, [orgaoId, id, status, dataHoraRemarcada ?? null]);
  };

  registrarRetirada = async (viagemId: string, dados: DadosRetirada): Promise<void> => {
    await pool.query(SQL.registrarRetirada, [
      viagemId, dados.kmInicial, dados.dataHora, dados.motoristaId,
      dados.notaCombustivelTipo ?? null, dados.notaCombustivelQuantidade ?? null,
    ]);
  };

  // Finalizar grava a finalização, muda o status e atualiza o km do veículo:
  // ou os três acontecem, ou nenhum.
  registrarFinalizacao = async (
    orgaoId: string,
    viagemId: string,
    veiculoId: string,
    dados: DadosFinalizacao,
  ): Promise<void> => {
    await executarEmTransacao(async (tx) => {
      await tx.query(SQL.registrarFinalizacao, [
        viagemId, dados.dataHora, dados.kmFinal, dados.sinistro ?? null,
      ]);
      await tx.query(SQL.mudarStatus, [orgaoId, viagemId, "FINALIZADA", null]);
      await tx.query(SQL.atualizarKmVeiculo, [orgaoId, veiculoId, dados.kmFinal]);
    });
  };

  listarAbastecimentos = async (
    orgaoId: string,
    viagemId: string,
  ): Promise<AbastecimentoResumo[]> => {
    const { rows } = await pool.query(SQL.listarAbastecimentos, [orgaoId, viagemId]);
    return rows.map((linha) => numerico(linha, ["litros", "valor"]));
  };

  buscarAbastecimento = async (
    orgaoId: string,
    id: string,
  ): Promise<AbastecimentoResumo | null> => {
    const { rows } = await pool.query(SQL.buscarAbastecimento, [orgaoId, id]);
    return rows[0] ? numerico(rows[0], ["litros", "valor"]) : null;
  };

  registrarAbastecimento = async (dados: NovoAbastecimento): Promise<string> => {
    const { rows } = await pool.query(SQL.registrarAbastecimento, [
      dados.viagemId, dados.data, dados.litros ?? null, dados.valor ?? null,
    ]);
    return rows[0].id;
  };

  removerAbastecimento = async (id: string): Promise<void> => {
    await pool.query(SQL.removerAbastecimento, [id]);
  };

  // O SQL devolve uma linha por (veículo × viagem); aqui vira uma por veículo.
  agenda = async (orgaoId: string, de: string, ate: string): Promise<LinhaDaAgenda[]> => {
    const { rows } = await pool.query(SQL.agenda, [orgaoId, de, ate]);
    const porVeiculo = new Map<string, LinhaDaAgenda>();

    for (const linha of rows) {
      if (!porVeiculo.has(linha.veiculoId)) {
        porVeiculo.set(linha.veiculoId, {
          veiculoId: linha.veiculoId,
          placa: linha.placa,
          modelo: linha.modelo,
          ativo: linha.ativo,
          emManutencao: linha.emManutencao,
          viagens: [],
        });
      }
      // LEFT JOIN sem viagem: id nulo.
      if (!linha.id) continue;

      porVeiculo.get(linha.veiculoId)!.viagens.push({
        id: linha.id,
        unidadeSolicitanteId: linha.unidadeSolicitanteId,
        unidadeSolicitanteNome: linha.unidadeSolicitanteNome,
        veiculoId: linha.viagemVeiculoId,
        veiculoPlaca: linha.placa,
        veiculoModelo: linha.modelo,
        motoristaId: linha.motoristaId,
        motoristaNome: linha.motoristaNome,
        dataHoraDesejada: linha.dataHoraDesejada,
        dataHoraRemarcada: linha.dataHoraRemarcada,
        motivo: linha.motivo,
        responsavel: linha.responsavel,
        status: linha.status,
        createdAt: linha.createdAt,
      });
    }

    return [...porVeiculo.values()];
  };

  relatorioDeUso = async (
    orgaoId: string,
    de: string,
    ate: string,
  ): Promise<LinhaDoRelatorio[]> => {
    const { rows } = await pool.query(SQL.relatorioDeUso, [orgaoId, de, ate]);
    return rows.map((linha) =>
      numerico(linha, [
        "viagensFinalizadas", "kmRodado", "litros", "valorCombustivel", "custoManutencao",
      ]),
    );
  };

  listarManutencoes = async (
    orgaoId: string,
    filtros: { veiculoId?: string; abertas?: boolean },
  ): Promise<ManutencaoResumo[]> => {
    const { rows } = await pool.query(SQL.listarManutencoes, [
      orgaoId, filtros.veiculoId ?? null,
      filtros.abertas === undefined ? null : filtros.abertas,
    ]);
    return rows.map((linha) => numerico(linha, ["custo"]));
  };

  buscarManutencao = async (orgaoId: string, id: string): Promise<ManutencaoResumo | null> => {
    const { rows } = await pool.query(SQL.buscarManutencao, [orgaoId, id]);
    return rows[0] ? numerico(rows[0], ["custo"]) : null;
  };

  abrirManutencao = async (dados: NovaManutencao): Promise<string> => {
    const { rows } = await pool.query(SQL.abrirManutencao, [
      dados.veiculoId, dados.tipo, dados.dataInicio,
      dados.descricao ?? null, dados.oficina ?? null, dados.custo ?? null,
    ]);
    return rows[0].id;
  };

  encerrarManutencao = async (id: string, dados: EncerramentoManutencao): Promise<void> => {
    await pool.query(SQL.encerrarManutencao, [
      id, dados.dataFim, dados.custo ?? null, dados.descricao ?? null,
    ]);
  };

  removerManutencao = async (id: string): Promise<void> => {
    await pool.query(SQL.removerManutencao, [id]);
  };
}
