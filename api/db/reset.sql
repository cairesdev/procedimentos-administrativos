-- Zera os dados de todas as prefeituras e preserva o acesso do administrador
-- master. A estrutura das tabelas fica intacta: não é preciso rodar migrations
-- de novo. Depois disto, cadastre a primeira prefeitura por /admin.
--
-- Uso: psql procedimentos -f api/db/reset.sql

DO $$
DECLARE
  alvos TEXT;
BEGIN
  -- Os modelos GLOBAIS de documento (orgao_id nulo) são configuração do
  -- produto, não dado de prefeitura. Eles vêm de migration, e como o reset
  -- preserva `schema_migrations`, a migration não roda de novo — sem esta
  -- cópia, a base voltaria sem nenhum modelo e ninguém conseguiria emitir
  -- peça alguma, sem erro visível até alguém tentar. O TRUNCATE ... CASCADE
  -- alcança `documento_modelo` mesmo se ela ficasse de fora da lista, porque
  -- referencia `orgao`.
  CREATE TEMP TABLE modelos_globais ON COMMIT DROP AS
    SELECT * FROM documento_modelo WHERE orgao_id IS NULL;

  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO alvos
    FROM pg_tables
   WHERE schemaname = 'public'
     -- admin_sistema é a única ilha: sem ela ninguém entra em /admin.
     -- schema_migrations guarda o que já foi aplicado.
     AND tablename NOT IN ('admin_sistema', 'schema_migrations');

  IF alvos IS NULL THEN
    RAISE NOTICE 'Nada a truncar.';
    RETURN;
  END IF;

  EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE', alvos);

  INSERT INTO documento_modelo SELECT * FROM modelos_globais;

  RAISE NOTICE 'Base zerada. Preservados: admin_sistema, schema_migrations e % modelo(s) global(is).',
    (SELECT count(*) FROM modelos_globais);
END $$;
