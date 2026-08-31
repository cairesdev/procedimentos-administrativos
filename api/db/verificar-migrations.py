#!/usr/bin/env python3
"""
Aplica todas as migrations num Postgres de verdade e confere os invariantes.

Por que existe, se `npm test` já confere o SQL: o parser estático diz se a
sintaxe é válida, mas não sabe se `DROP CONSTRAINT produto_orgao_id_nome_key`
acerta o nome que o Postgres gerou, nem se um CHECK recusa o que deveria. Isso
só o Postgres responde — e responderia na VPS, no meio do deploy.

Não entra no `npm test` porque exige um Postgres: a suíte do Node roda sem banco
e sem rede, de propósito. Rode isto antes de subir migration nova.

    pip install --break-system-packages pgserver
    python3 api/db/verificar-migrations.py

O `pgserver` baixa um Postgres próprio e roda como usuário comum — não precisa
de root, de Docker, nem do banco de desenvolvimento.
"""
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

try:
    import pgserver
except ImportError:
    sys.exit("Falta o pgserver: pip install --break-system-packages pgserver")

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MIGRATIONS = RAIZ / "db" / "migrations"
REPOSITORIOS = RAIZ / "src" / "infrastructure" / "db"

COMPARTILHADOS = {"TOTAL_DA_JANELA": 'COUNT(*) OVER() AS "_total"'}


class Banco:
    """Um Postgres descartável, criado do zero a cada execução."""

    def __init__(self) -> None:
        self.pasta = tempfile.mkdtemp(prefix="verificar-migrations-")
        self.servidor = pgserver.get_server(self.pasta)
        self.host = str(self.servidor.get_postmaster_info().socket_dir)
        self.psql = str(
            pathlib.Path(pgserver.__file__).parent / "pginstall" / "bin" / "psql"
        )

    def executar(self, sql: str) -> tuple[bool, str]:
        resultado = subprocess.run(
            [self.psql, "-h", self.host, "-U", "postgres", "-d", "postgres",
             "-v", "ON_ERROR_STOP=1", "-t", "-A"],
            capture_output=True, text=True, input=sql,
        )
        return resultado.returncode == 0, (resultado.stdout + resultado.stderr).strip()

    def limpar(self) -> None:
        shutil.rmtree(self.pasta, ignore_errors=True)


def aplicar_migrations(banco: Banco) -> None:
    arquivos = sorted(MIGRATIONS.glob("*.sql"))
    if not arquivos:
        sys.exit("Nenhuma migration encontrada")

    for arquivo in arquivos:
        sql = arquivo.read_text(encoding="utf-8")
        # O pgcrypto não vem no pacote do pip. `gen_random_uuid()` é nativo
        # desde o PG13, então a extensão não faz falta para conferir o schema.
        sql = re.sub(r"CREATE EXTENSION[^;]*pgcrypto[^;]*;", "", sql, flags=re.I)

        ok, saida = banco.executar(sql)
        if not ok:
            print(f"FALHA em {arquivo.name}\n{saida[-2500:]}")
            sys.exit(1)
        print(f"  ok   {arquivo.name}")

    print(f"\n{len(arquivos)} migrations aplicadas em sequência.\n")


CENARIO = """
INSERT INTO orgao (id, nome, cnpj, municipio, uf)
VALUES ('11111111-1111-1111-1111-111111111111','Prefeitura Teste','06125389000188','Teste','MA');
INSERT INTO almoxarifado (id, orgao_id, nome)
VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Central');
INSERT INTO local (id, orgao_id, codigo, nome, almoxarifado_id, cnpj, endereco)
VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','001',
        'Escola Municipal','22222222-2222-2222-2222-222222222222','06125389000188','Rua A, 100');
INSERT INTO tipo_estoque (id, orgao_id, nome)
VALUES ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Alimentacao');
INSERT INTO produto (id, nome, unidade_medida)
VALUES ('55555555-5555-5555-5555-555555555555','CORANTE NATURAL','KG');
INSERT INTO remessa_estoque (id, almoxarifado_id, codigo, titulo, data, tipo_estoque_id)
VALUES ('66666666-6666-6666-6666-666666666666','22222222-2222-2222-2222-222222222222',
        'R-001','Remessa de teste', current_date,'44444444-4444-4444-4444-444444444444');
INSERT INTO lote (id, remessa_id, produto_id, quantidade, saldo, data_validade)
VALUES ('77777777-7777-7777-7777-777777777777','66666666-6666-6666-6666-666666666666',
        '55555555-5555-5555-5555-555555555555', 100, 100, current_date + 90);
INSERT INTO usuario (id, orgao_id, nome, email, senha_hash, papel_base, username)
VALUES ('88888888-8888-8888-8888-888888888888','11111111-1111-1111-1111-111111111111',
        'Maria','maria@teste.gov.br','x','ADMIN','maria');
INSERT INTO solicitacao_estoque (id, local_solicitante_id, autor_usuario_id, tipo_estoque_id,
                                 status, enviada_em)
VALUES ('99999999-9999-9999-9999-999999999999','33333333-3333-3333-3333-333333333333',
        '88888888-8888-8888-8888-888888888888','44444444-4444-4444-4444-444444444444',
        'SOLICITADA', now());
INSERT INTO solicitacao_estoque_item (id, solicitacao_id, produto_id, quantidade_solicitada,
                                      quantidade_reservada)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','99999999-9999-9999-9999-999999999999',
        '55555555-5555-5555-5555-555555555555', 10, 10);
INSERT INTO liberacao_lote (id, solicitacao_item_id, lote_id, quantidade)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '77777777-7777-7777-7777-777777777777', 10);
"""

# A 2a fatia move o lote que ja esta na unidade: consumo, devolucao e ajuste
# partem dele.
#
# Usa uma liberacao PROPRIA (`b2`), e nao a do cenario base: um dos casos ali
# testa justamente que a entrega `bbbb` gera a primeira linha de estoque, e
# criar essa linha aqui faria aquele caso falhar por conflito de indice.
CENARIO_MOVIMENTO = """
INSERT INTO liberacao_lote (id, solicitacao_item_id, lote_id, quantidade)
VALUES ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '77777777-7777-7777-7777-777777777777', 7);
INSERT INTO estoque_local (id, local_id, produto_id, lote_origem_id, liberacao_lote_id,
                           quantidade_recebida, saldo, data_validade)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc','33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555','77777777-7777-7777-7777-777777777777',
        'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 7, 7, current_date + 90);
INSERT INTO consumo (id, local_id, produto_id, quantidade, forma, usuario_id)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd','33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555', 3, 'ITEM_A_ITEM',
        '88888888-8888-8888-8888-888888888888');
"""

# Primeiro caso da 2ª fatia — é aqui que o cenário de movimento é montado.
MARCO_DA_SEGUNDA_FATIA = "consumo item a item nao tem periodo"

# Cada caso descreve um estado que o banco tem de aceitar ou recusar sozinho.
# Regra que só o caso de uso garante some quando alguém escreve direto no banco,
# e num módulo de estoque o estado quebrado sobrevive à correção do código.
CASOS: list[tuple[str, str, bool]] = [
    ("perda sem motivo é recusada",
     "UPDATE liberacao_lote SET quantidade_perdida = 3 WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'",
     False),
    ("confirmado + perdido tem de fechar com o liberado",
     "UPDATE liberacao_lote SET quantidade_confirmada = 8, quantidade_perdida = 1, "
     "motivo_perda = 'AVARIA' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'",
     False),
    ("recebimento que fecha é aceito",
     "UPDATE liberacao_lote SET quantidade_confirmada = 7, quantidade_perdida = 3, "
     "motivo_perda = 'QUEBRA_TRANSPORTE' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'",
     True),
    ("rascunho com data de envio é recusado",
     "INSERT INTO solicitacao_estoque (local_solicitante_id, autor_usuario_id, status, enviada_em) "
     "VALUES ('33333333-3333-3333-3333-333333333333','88888888-8888-8888-8888-888888888888',"
     "'RASCUNHO', now())",
     False),
    ("enviada sem data de envio é recusada",
     "INSERT INTO solicitacao_estoque (local_solicitante_id, autor_usuario_id, status) "
     "VALUES ('33333333-3333-3333-3333-333333333333','88888888-8888-8888-8888-888888888888',"
     "'SOLICITADA')",
     False),
    ("produto repetido em nome+unidade é recusado",
     "INSERT INTO produto (nome, unidade_medida) VALUES ('CORANTE NATURAL','KG')",
     False),
    ("mesmo nome com outra unidade é aceito",
     "INSERT INTO produto (nome, unidade_medida) VALUES ('CORANTE NATURAL','LITRO')",
     True),
    ("entrega gera uma linha de estoque na unidade",
     "INSERT INTO estoque_local (local_id, produto_id, lote_origem_id, liberacao_lote_id, "
     "quantidade_recebida, saldo, data_validade) VALUES "
     "('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555',"
     "'77777777-7777-7777-7777-777777777777','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',7,7,"
     "current_date + 90)",
     True),
    ("reprocessar a mesma entrega não duplica o saldo",
     "INSERT INTO estoque_local (local_id, produto_id, lote_origem_id, liberacao_lote_id, "
     "quantidade_recebida, saldo) VALUES "
     "('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555',"
     "'77777777-7777-7777-7777-777777777777','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',7,7)",
     False),
    ("consumo não deixa saldo negativo na unidade",
     "UPDATE estoque_local SET saldo = -1 WHERE liberacao_lote_id = "
     "'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'",
     False),
    ("saldo maior que o recebido é recusado",
     "UPDATE estoque_local SET saldo = 99 WHERE liberacao_lote_id = "
     "'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'",
     False),
    ("dois locais sob o mesmo CNPJ são aceitos",
     "INSERT INTO local (orgao_id, codigo, nome, cnpj) VALUES "
     "('11111111-1111-1111-1111-111111111111','002','Outra Escola','06125389000188')",
     True),
    ("saldo do lote não passa da quantidade",
     "UPDATE lote SET saldo = 200 WHERE id = '77777777-7777-7777-7777-777777777777'",
     False),
    # ---- 2a fatia: consumo, devolucao, transferencia e ajuste --------------
    (MARCO_DA_SEGUNDA_FATIA,
     "INSERT INTO consumo (local_id, produto_id, quantidade, forma, periodo_inicio, periodo_fim) "
     "VALUES ('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555',"
     "1,'ITEM_A_ITEM', current_date, current_date)",
     False),
    ("declaracao periodica exige o periodo",
     "INSERT INTO consumo (local_id, produto_id, quantidade, forma) "
     "VALUES ('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555',"
     "1,'DECLARACAO_PERIODICA')",
     False),
    ("periodo que termina antes de comecar e recusado",
     "INSERT INTO consumo (local_id, produto_id, quantidade, forma, periodo_inicio, periodo_fim) "
     "VALUES ('33333333-3333-3333-3333-333333333333','55555555-5555-5555-5555-555555555555',"
     "1,'DECLARACAO_PERIODICA', current_date, current_date - 5)",
     False),
    ("consumo aponta o lote de onde saiu",
     "INSERT INTO consumo_lote (consumo_id, estoque_local_id, quantidade) "
     "VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',"
     "'cccccccc-cccc-cccc-cccc-cccccccccccc', 3)",
     True),
    ("devolucao pendente nao tem data de resposta",
     "INSERT INTO devolucao (local_id, almoxarifado_id, produto_id, quantidade, status, "
     "respondida_em) VALUES ('33333333-3333-3333-3333-333333333333',"
     "'22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555',"
     "2,'PENDENTE', now())",
     False),
    ("recusa de devolucao exige motivo",
     "INSERT INTO devolucao (local_id, almoxarifado_id, produto_id, quantidade, status, "
     "respondida_em) VALUES ('33333333-3333-3333-3333-333333333333',"
     "'22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555',"
     "2,'RECUSADA', now())",
     False),
    ("devolucao recusada com motivo e aceita",
     "INSERT INTO devolucao (local_id, almoxarifado_id, produto_id, quantidade, status, "
     "respondida_em, recusa_motivo) VALUES ('33333333-3333-3333-3333-333333333333',"
     "'22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555',"
     "2,'RECUSADA', now(), 'Embalagem violada')",
     True),
    ("transferencia para o proprio almoxarifado e recusada",
     "INSERT INTO transferencia_almoxarifado (almoxarifado_origem_id, almoxarifado_destino_id, "
     "lote_id, quantidade, usuario_id) VALUES ('22222222-2222-2222-2222-222222222222',"
     "'22222222-2222-2222-2222-222222222222','77777777-7777-7777-7777-777777777777',1,"
     "'88888888-8888-8888-8888-888888888888')",
     False),
    ("ajuste aponta o lote OU o estoque da unidade, nunca os dois",
     "INSERT INTO ajuste_estoque (almoxarifado_id, lote_id, estoque_local_id, saldo_anterior, "
     "saldo_corrigido, motivo, usuario_id) VALUES ('22222222-2222-2222-2222-222222222222',"
     "'77777777-7777-7777-7777-777777777777','cccccccc-cccc-cccc-cccc-cccccccccccc',"
     "10, 8,'CONTAGEM','88888888-8888-8888-8888-888888888888')",
     False),
    ("ajuste que nao muda nada e recusado",
     "INSERT INTO ajuste_estoque (estoque_local_id, saldo_anterior, saldo_corrigido, motivo, "
     "usuario_id) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 7, 7,'CONTAGEM',"
     "'88888888-8888-8888-8888-888888888888')",
     False),
    ("ajuste do armario da escola e aceito",
     "INSERT INTO ajuste_estoque (estoque_local_id, saldo_anterior, saldo_corrigido, motivo, "
     "usuario_id) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 7, 5,'PERDA',"
     "'88888888-8888-8888-8888-888888888888')",
     True),
    ("contagem que acha material a mais e aceita",
     "INSERT INTO ajuste_estoque (estoque_local_id, saldo_anterior, saldo_corrigido, motivo, "
     "usuario_id) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 5, 6,'SOBRA',"
     "'88888888-8888-8888-8888-888888888888')",
     True),
    ("reserva negativa é recusada",
     "UPDATE solicitacao_estoque_item SET quantidade_reservada = -1 WHERE id = "
     "'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'",
     False),

    # ---- 0025: o documento nasce em rascunho ---------------------------------
    # A edicao acontece antes de emitir. Depois, a peca responde por um codigo
    # publico e mudar o corpo faria a conferencia mentir.
    ("rascunho com data de emissao e recusado",
     "INSERT INTO documento_emitido (orgao_id, modulo, tipo, codigo, titulo, corpo, "
     "dados, referencia_id, emitido_por_nome, emitido_por_cargo, situacao, data) VALUES "
     "('11111111-1111-1111-1111-111111111111','PROCESSOS','DESPACHO','AAAA-BBBB-CCC1',"
     "'D','<p>x</p>','{}'::jsonb,'11111111-1111-1111-1111-111111111111','Maria','Admin','RASCUNHO', now())",
     False),
    ("documento emitido sem data e recusado",
     "INSERT INTO documento_emitido (orgao_id, modulo, tipo, codigo, titulo, corpo, "
     "dados, referencia_id, emitido_por_nome, emitido_por_cargo, situacao, data) VALUES "
     "('11111111-1111-1111-1111-111111111111','PROCESSOS','DESPACHO','AAAA-BBBB-CCC2',"
     "'D','<p>x</p>','{}'::jsonb,'11111111-1111-1111-1111-111111111111','Maria','Admin','EMITIDO', NULL)",
     False),
    ("rascunho sem data e aceito",
     "INSERT INTO documento_emitido (id, orgao_id, modulo, tipo, codigo, titulo, corpo, "
     "dados, referencia_id, emitido_por_nome, emitido_por_cargo, situacao, data) VALUES "
     "('d0c00000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',"
     "'PROCESSOS','DESPACHO','AAAA-BBBB-CCC3','D','<p>x</p>','{}'::jsonb,"
     "'11111111-1111-1111-1111-111111111111','Maria','Admin','RASCUNHO', NULL)",
     True),
    ("cancelar rascunho e recusado",
     "UPDATE documento_emitido SET cancelado_em = now(), cancelado_motivo = 'x' "
     "WHERE id = 'd0c00000-0000-0000-0000-000000000001'",
     False),
    ("edicao sem autor e recusada",
     "UPDATE documento_emitido SET editado_em = now() "
     "WHERE id = 'd0c00000-0000-0000-0000-000000000001'",
     False),
    ("edicao com quem e quando e aceita",
     "UPDATE documento_emitido SET editado_em = now(), "
     "editado_por_usuario_id = '88888888-8888-8888-8888-888888888888' "
     "WHERE id = 'd0c00000-0000-0000-0000-000000000001'",
     True),
    ("rascunho vira documento com data",
     "UPDATE documento_emitido SET situacao = 'EMITIDO', data = now() "
     "WHERE id = 'd0c00000-0000-0000-0000-000000000001'",
     True),
    ("situacao fora do vocabulario e recusada",
     "UPDATE documento_emitido SET situacao = 'PUBLICADO' "
     "WHERE id = 'd0c00000-0000-0000-0000-000000000001'",
     False),

    # ---- 0026: papeis e excecoes de permissao -------------------------------
    ("papel UNIDADE e aceito no cadastro",
     "INSERT INTO usuario (id, orgao_id, nome, email, senha_hash, papel_base, username) "
     "VALUES ('e5c00000-0000-0000-0000-000000000001',"
     "'11111111-1111-1111-1111-111111111111','Diretora','dir@e.br','x','UNIDADE','diretora')",
     True),
    ("papel inventado e recusado",
     "INSERT INTO usuario (orgao_id, nome, email, senha_hash, papel_base, username) "
     "VALUES ('11111111-1111-1111-1111-111111111111','X','x@e.br','x','ALMOXARIFE','xis')",
     False),
    ("permissao fora do formato e recusada",
     "INSERT INTO usuario_permissao (usuario_id, permissao) VALUES "
     "('88888888-8888-8888-8888-888888888888','estoque')",
     False),
    ("excecao de permissao bem formada e aceita",
     "INSERT INTO usuario_permissao (usuario_id, permissao, concedida) VALUES "
     "('88888888-8888-8888-8888-888888888888','fleet:read', TRUE)",
     True),
    ("a mesma permissao nao entra duas vezes",
     "INSERT INTO usuario_permissao (usuario_id, permissao, concedida) VALUES "
     "('88888888-8888-8888-8888-888888888888','fleet:read', FALSE)",
     False),

    # ---- 0027: modelo por setor e segunda logomarca -------------------------
    ("modelo amarrado a tipo de setor conhecido e aceito",
     "INSERT INTO documento_modelo_setor (modelo_id, tipo_setor) "
     "SELECT id, 'CONTROLADORIA' FROM documento_modelo LIMIT 1",
     True),
    ("tipo de setor inventado e recusado",
     "INSERT INTO documento_modelo_setor (modelo_id, tipo_setor) "
     "SELECT id, 'JURIDICO' FROM documento_modelo LIMIT 1",
     False),
    ("o mesmo setor nao entra duas vezes no modelo",
     "INSERT INTO documento_modelo_setor (modelo_id, tipo_setor) "
     "SELECT id, 'CONTROLADORIA' FROM documento_modelo LIMIT 1",
     False),
    ("apagar o modelo leva os setores junto",
     "DELETE FROM documento_modelo WHERE id IN "
     "(SELECT modelo_id FROM documento_modelo_setor LIMIT 1)",
     True),
    ("as duas logomarcas convivem",
     "INSERT INTO orgao_documento_config "
     "(orgao_id, arquivo_logomarca, arquivo_logomarca_direita, cabecalho_timbre) VALUES "
     "('11111111-1111-1111-1111-111111111111','a/brasao.png','b/fundeb.png','PREFEITURA')",
     True),

    # ---- 0028: relatorio de consumo (PNAE) ----------------------------------
    ("periodo invertido e recusado",
     "INSERT INTO relatorio_consumo (orgao_id, almoxarifado_id, periodo_inicio, periodo_fim) "
     "VALUES ('11111111-1111-1111-1111-111111111111',"
     "'22222222-2222-2222-2222-222222222222','2026-03-31','2026-03-01')",
     False),
    ("periodo de um dia so e aceito",
     "INSERT INTO relatorio_consumo (id, orgao_id, almoxarifado_id, periodo_inicio, periodo_fim) "
     "VALUES ('4e100000-0000-0000-0000-000000000001',"
     "'11111111-1111-1111-1111-111111111111',"
     "'22222222-2222-2222-2222-222222222222','2026-03-01','2026-03-01')",
     True),
    ("relatorio sem tipo de estoque e aceito (todos os tipos)",
     "INSERT INTO relatorio_consumo (orgao_id, almoxarifado_id, tipo_estoque_id, "
     "periodo_inicio, periodo_fim) VALUES "
     "('11111111-1111-1111-1111-111111111111',"
     "'22222222-2222-2222-2222-222222222222', NULL,'2026-01-01','2026-12-31')",
     True),
    ("fornecedor nasce fora da agricultura familiar",
     "INSERT INTO fornecedor (documento, razao_social) "
     "VALUES ('11222333000144','COOPERATIVA TESTE') "
     "RETURNING (agricultura_familiar = FALSE)",
     True),
    ("escopo RELATORIO_CONSUMO e aceito no modelo",
     "INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo) VALUES "
     "(NULL,'ALMOXARIFADO','RELATORIO_CONSUMO','RELATORIO_TESTE','x','X','<p>x</p>')",
     True),

    # ---- 0029: convite do fornecedor ----------------------------------------
    ("convite com prazo no futuro e aceito",
     "INSERT INTO fornecedor_convite (id, fornecedor_id, orgao_id, token_hash, expira_em) "
     "SELECT 'c0000000-0000-0000-0000-000000000001', f.id,"
     "'11111111-1111-1111-1111-111111111111', repeat('a',64), now() + interval '30 days' "
     "FROM fornecedor f LIMIT 1",
     True),
    ("um convite aberto por fornecedor e prefeitura",
     "INSERT INTO fornecedor_convite (fornecedor_id, orgao_id, token_hash, expira_em) "
     "SELECT f.id,'11111111-1111-1111-1111-111111111111', repeat('b',64), "
     "now() + interval '30 days' FROM fornecedor f LIMIT 1",
     False),
    ("depois de revogar, cabe outro convite",
     "UPDATE fornecedor_convite SET revogado_em = now() "
     "WHERE id = 'c0000000-0000-0000-0000-000000000001'",
     True),
    ("segundo convite entra apos a revogacao",
     "INSERT INTO fornecedor_convite (fornecedor_id, orgao_id, token_hash, expira_em) "
     "SELECT f.id,'11111111-1111-1111-1111-111111111111', repeat('c',64), "
     "now() + interval '30 days' FROM fornecedor f LIMIT 1",
     True),
    ("prazo no passado e recusado",
     "INSERT INTO fornecedor_convite (fornecedor_id, orgao_id, token_hash, expira_em) "
     "SELECT f.id,'11111111-1111-1111-1111-111111111111', repeat('d',64), "
     "now() - interval '1 day' FROM fornecedor f LIMIT 1",
     False),
    # ---- 0030: qualidade do lote --------------------------------------------
    ("registro apontando o lote do almoxarifado e aceito",
     "INSERT INTO qualidade_lote (lote_id, tipo, observacao, usuario_id) VALUES "
     "('77777777-7777-7777-7777-777777777777','DANO','Duas caixas amassadas',"
     "'88888888-8888-8888-8888-888888888888')",
     True),
    ("os dois lados ao mesmo tempo e recusado",
     "INSERT INTO qualidade_lote (lote_id, estoque_local_id, tipo, observacao, usuario_id) "
     "VALUES ('77777777-7777-7777-7777-777777777777',"
     "'cccccccc-cccc-cccc-cccc-cccccccccccc','DANO','x y z',"
     "'88888888-8888-8888-8888-888888888888')",
     False),
    ("nenhum dos dois e recusado",
     "INSERT INTO qualidade_lote (tipo, observacao, usuario_id) VALUES "
     "('DANO','sem alvo nenhum','88888888-8888-8888-8888-888888888888')",
     False),
    ("observacao curta demais e recusada",
     "INSERT INTO qualidade_lote (lote_id, tipo, observacao, usuario_id) VALUES "
     "('77777777-7777-7777-7777-777777777777','DANO','  x  ',"
     "'88888888-8888-8888-8888-888888888888')",
     False),
    ("quantidade e opcional",
     "INSERT INTO qualidade_lote (estoque_local_id, tipo, observacao, usuario_id) VALUES "
     "('cccccccc-cccc-cccc-cccc-cccccccccccc','ARMAZENAMENTO',"
     "'Camara fria oscilou de madrugada','88888888-8888-8888-8888-888888888888')",
     True),
    ("quantidade zero e recusada",
     "INSERT INTO qualidade_lote (lote_id, tipo, observacao, quantidade, usuario_id) VALUES "
     "('77777777-7777-7777-7777-777777777777','DANO','texto valido', 0,"
     "'88888888-8888-8888-8888-888888888888')",
     False),
    ("tipo fora do vocabulario e recusado",
     "INSERT INTO qualidade_lote (lote_id, tipo, observacao, usuario_id) VALUES "
     "('77777777-7777-7777-7777-777777777777','SUSPEITA','texto valido',"
     "'88888888-8888-8888-8888-888888888888')",
     False),
    ("o mesmo hash nao entra duas vezes",
     "INSERT INTO fornecedor_convite (fornecedor_id, orgao_id, token_hash, expira_em) "
     "SELECT f.id,'11111111-1111-1111-1111-111111111111', repeat('c',64), "
     "now() + interval '10 days' FROM fornecedor f LIMIT 1",
     False),
]


def conferir_invariantes(banco: Banco) -> int:
    ok, saida = banco.executar(CENARIO)
    if not ok:
        print(f"FALHA ao montar o cenário\n{saida[-2000:]}")
        return 1

    falhas = 0
    for nome, sql, esperado_ok in CASOS:
        # O cenário da 2ª fatia entra no meio da lista, depois dos casos que
        # dependem de a unidade ainda não ter recebido nada.
        if nome == MARCO_DA_SEGUNDA_FATIA:
            ok, saida = banco.executar(CENARIO_MOVIMENTO)
            if not ok:
                print(f"FALHA ao montar o cenário de movimento\n{saida[-2000:]}")
                return falhas + 1

        aceito, saida = banco.executar(sql)
        if aceito == esperado_ok:
            print(f"  ok   {nome}")
            continue

        falhas += 1
        motivo = (
            "passou e deveria ser recusado" if aceito
            else f"recusou: {saida.splitlines()[0][:110]}"
        )
        print(f"  FALHA {nome} — {motivo}")

    print(f"\n{len(CASOS) - falhas}/{len(CASOS)} invariantes corretos")
    return falhas


def conferir_consultas(banco: Banco) -> int:
    """
    Submete cada consulta dos repositórios a um `PREPARE`.

    `PREPARE` valida sintaxe, nomes de tabela e de coluna, e a dedução de tipo
    dos parâmetros — sem executar nada. Foi assim que apareceu um `$2` usado ao
    mesmo tempo como valor inserido e como comparação, que o Postgres recusa com
    "inconsistent types deduced". O parser estático do `npm test` aceitava.
    """
    falhas = 0
    total = 0

    for arquivo in sorted(REPOSITORIOS.glob("*.ts")):
        texto = arquivo.read_text(encoding="utf-8")
        locais = dict(re.findall(r"^const ([A-Z_0-9]+) = `([\s\S]*?)`;$", texto, re.M))
        consultas = re.findall(r"^  (\w+): `([\s\S]*?)`,\s*$", texto, re.M)

        for nome, sql in consultas:
            for chave, valor in {**locais, **COMPARTILHADOS}.items():
                sql = sql.replace("${" + chave + "}", valor)
            if "${" in sql:
                continue  # interpolação que só o TypeScript resolve

            total += 1
            maior = max([int(x) for x in re.findall(r"\$(\d+)", sql)] or [0])
            tipos = ", ".join(["unknown"] * maior)
            declaracao = (
                f"PREPARE p_{arquivo.stem}_{nome} "
                f"{f'({tipos})' if tipos else ''} AS {sql}"
            )

            ok, saida = banco.executar(declaracao)
            if not ok:
                falhas += 1
                print(f"  FALHA {arquivo.name} → SQL.{nome}")
                print(f"         {saida.splitlines()[0][:150]}")

    print(f"\n{total - falhas}/{total} consultas aceitas pelo Postgres")
    return falhas


def main() -> int:
    banco = Banco()
    try:
        print("Aplicando migrations:")
        aplicar_migrations(banco)
        print("Conferindo invariantes:")
        falhas = conferir_invariantes(banco)
        print("\nConferindo as consultas dos repositórios:")
        falhas += conferir_consultas(banco)
        return 1 if falhas else 0
    finally:
        banco.limpar()


if __name__ == "__main__":
    sys.exit(main())
