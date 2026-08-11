-- 0007 — Login por email OU username, sem CNPJ do órgão.
-- email e username passam a ser únicos globalmente; o órgão vem do registro.

ALTER TABLE usuario ADD COLUMN username VARCHAR(40);

UPDATE usuario
   SET username = split_part(email, '@', 1) || '.' || substr(id::text, 1, 4)
 WHERE username IS NULL;

ALTER TABLE usuario
  ALTER COLUMN username SET NOT NULL,
  DROP CONSTRAINT usuario_orgao_id_email_key,
  ADD CONSTRAINT usuario_email_unico UNIQUE (email),
  ADD CONSTRAINT usuario_username_unico UNIQUE (username);
