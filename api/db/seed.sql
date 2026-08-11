-- Seed de bootstrap. Idempotente: pode rodar mais de uma vez.
-- Cria a prefeitura demo, habilita o módulo PROCESSOS e o primeiro ADMIN
-- (criar usuário pela API exige papel ADMIN — este é o ovo inicial).
-- Senha do admin: 12345678

INSERT INTO orgao (id, cnpj, nome, uf, municipio, endereco)
VALUES ('00000000-0000-4000-8000-000000000001', '06104863000195',
        'Prefeitura Municipal Demo', 'MA', 'Demo', 'Praça Central, s/n')
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO orgao_modulo (orgao_id, modulo)
SELECT id, m FROM orgao, unnest(ARRAY['PROCESSOS']) AS m
 WHERE cnpj = '06104863000195'
ON CONFLICT (orgao_id, modulo) DO NOTHING;

INSERT INTO orgao_documento_config (orgao_id, cabecalho_timbre, rodape_timbre)
SELECT id, 'PREFEITURA MUNICIPAL DEMO — ESTADO DO MARANHÃO', 'Praça Central, s/n — CEP 65400-000'
  FROM orgao WHERE cnpj = '06104863000195'
ON CONFLICT (orgao_id) DO NOTHING;

INSERT INTO usuario (orgao_id, nome, email, username, senha_hash, papel_base)
SELECT id, 'Administrador Demo', 'admin@demo.gov.br', 'admin.demo',
       '$2a$10$Q1fltW34zX1pC4Z.YQi5DuQQ8KetZaP.bhEiJijRl3G.ajocJIbOi', 'ADMIN'
  FROM orgao WHERE cnpj = '06104863000195'
ON CONFLICT (email) DO NOTHING;
