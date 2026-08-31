-- 0031 — A escola vira lotação, e o almoxarifado ganha dono.
--
-- A trava por lotação existia só na escrita, e comparava `local.unidade_id`
-- com as unidades do usuário. Toda leitura passava com `stock:read` puro: a
-- escola 1 listava os pedidos e o estoque da escola 2.
--
-- A causa é que a escola nunca foi destino de lotação. O almoxarifado inteiro
-- fala em `local` — é ele que tem CNPJ, endereço e responsável —, mas a lotação
-- só sabia apontar para unidade, setor ou departamento, e a ponte entre os dois
-- era um `unidade_id` opcional.

-- ---------------------------------------------------------------------------
-- LOCAL como quarto destino da lotação
--
-- Continua valendo exatamente um destino: lotação que apontasse para escola e
-- setor ao mesmo tempo deixaria a pergunta "esta pessoa é travada?" sem
-- resposta única, e cada consulta responderia à sua maneira.

ALTER TABLE lotacao ADD COLUMN local_id UUID REFERENCES local(id);

ALTER TABLE lotacao DROP CONSTRAINT lotacao_check;

ALTER TABLE lotacao ADD CONSTRAINT lotacao_destino_unico
  CHECK (num_nonnulls(unidade_id, setor_id, departamento_id, local_id) = 1);

-- A pergunta que toda leitura do almoxarifado passa a fazer é "quais locais
-- este usuário alcança?". Sem o índice, ela varre as lotações da prefeitura.
CREATE INDEX idx_lotacao_local ON lotacao(local_id) WHERE local_id IS NOT NULL;

-- Mesma pessoa lotada duas vezes na mesma escola é engano de cadastro, e
-- duplicaria a escola na lista de alcance.
CREATE UNIQUE INDEX idx_lotacao_usuario_local
  ON lotacao(usuario_id, local_id) WHERE local_id IS NOT NULL;

COMMENT ON COLUMN lotacao.local_id IS
  'Escola, creche ou posto: quem é lotado aqui só enxerga o almoxarifado deste local.';

-- ---------------------------------------------------------------------------
-- O ALMOXARIFADO pertence a um setor
--
-- Quem é lotado em setor precisa alcançar as escolas que o seu almoxarifado
-- atende — nem todas, nem nenhuma. `local.almoxarifado_id` já dizia qual
-- almoxarifado atende a escola; faltava a outra ponta.
--
-- **Nullable de propósito.** Almoxarifado sem setor é alcançado por qualquer
-- lotação de setor, que é o comportamento de hoje. Exigir o setor nesta
-- migration tiraria o estoque das mãos de quem já o opera, no minuto do deploy;
-- o preenchimento é feito na tela, um almoxarifado por vez.

ALTER TABLE almoxarifado ADD COLUMN setor_id UUID REFERENCES setor(id);

CREATE INDEX idx_almoxarifado_setor ON almoxarifado(setor_id) WHERE setor_id IS NOT NULL;

COMMENT ON COLUMN almoxarifado.setor_id IS
  'Setor que opera este almoxarifado. NULL = alcançado por qualquer setor.';
