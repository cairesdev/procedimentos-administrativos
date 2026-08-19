-- Zera os dados de todas as prefeituras e preserva o acesso do administrador
-- master. A estrutura das tabelas fica intacta: não é preciso rodar migrations
-- de novo. Depois disto, cadastre a primeira prefeitura por /admin.
--
-- Uso: psql procedimentos -f api/db/reset.sql

DO $$
DECLARE
  alvos TEXT;
BEGIN
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
  RAISE NOTICE 'Base zerada. Preservados: admin_sistema, schema_migrations.';
END $$;
