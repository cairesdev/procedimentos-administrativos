-- 0008 — Administrador da aplicação (equipe do produto).
-- Fica fora do isolamento por órgão de propósito: é quem cadastra as prefeituras,
-- habilita módulos e configura o timbre. Autentica por escopo de token próprio.

CREATE TABLE IF NOT EXISTS admin_sistema (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(150) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  senha_hash  VARCHAR(100) NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
