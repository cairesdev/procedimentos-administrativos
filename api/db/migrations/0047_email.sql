-- 0047 — Envio de e-mail: configuração do SMTP, fila e destinatário do convite.
--
-- Hoje nenhum e-mail sai do sistema. Convite de fornecedor e de checklist geram
-- um link que alguém copia e manda por fora; o cidadão que recebe uma exigência
-- só descobre que ela existe se voltar ao portal por conta própria.
--
-- Esta migration entrega as três tabelas que faltam para isso mudar. Quem manda
-- é o worker, noutra fatia.

-- ---------------------------------------------------------------------------
-- O SMTP
--
-- A configuração mora no banco, e não no `.env`, para o administrativo geral
-- poder trocar de provedor, corrigir uma porta ou girar a senha sem acesso à
-- VPS e sem reiniciar contêiner — do mesmo jeito que ele já troca o timbre e os
-- modelos globais.
--
-- `orgao_id IS NULL` é a configuração do produto; com órgão, a da prefeitura.
-- A resolução é a mesma de `documento_modelo`: vale a da prefeitura quando
-- existe e está ativa, senão a global. Quem tem domínio próprio manda do
-- domínio próprio — o cidadão recebe da prefeitura dele, e um bloqueio não
-- derruba as outras; quem não tem sai pelo remetente do produto e funciona no
-- primeiro dia, sem configurar nada.

CREATE TABLE configuracao_email (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nulo = a configuração do produto, que atende quem não tem a sua.
  orgao_id      UUID REFERENCES orgao(id),

  host          VARCHAR(200) NOT NULL,
  porta         INTEGER NOT NULL,
  usuario       VARCHAR(200),

  -- A senha entra cifrada, nunca em texto.
  --
  -- Host, porta e remetente são configuração e ficam legíveis. A senha, não: o
  -- backup diário do compose e qualquer dump do banco passariam a carregar uma
  -- credencial capaz de mandar e-mail em nome da prefeitura, e este projeto já
  -- perdeu segredo por vazamento uma vez.
  --
  -- A cifra é AES-256-GCM com chave em `EMAIL_CHAVE`, que só existe no
  -- `.env.prod`. O que ela protege: dump e backup vazados. O que ela não
  -- protege: invasão do servidor, onde o atacante tem o banco e a chave —
  -- dizer o contrário seria vender segurança que não existe. Perder a chave
  -- significa recadastrar as senhas; não há recuperação, e é assim mesmo.
  --
  -- Guardada em texto porque é base64 do pacote (nonce + tag + conteúdo), não
  -- um binário solto.
  senha_cifrada TEXT,

  -- Quem aparece como remetente. O endereço é o do SMTP; o nome de exibição
  -- é montado na hora, com a prefeitura na frente, para o destinatário saber
  -- de quem veio — o e-mail que mais importa é a exigência, e é justamente o
  -- que mais parece golpe vindo de um remetente desconhecido.
  remetente     VARCHAR(200) NOT NULL,

  -- Conexão cifrada desde o começo (465) ou STARTTLS depois (587).
  tls_direto    BOOLEAN NOT NULL DEFAULT FALSE,

  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID,

  CHECK (porta BETWEEN 1 AND 65535),
  CHECK (btrim(host) <> ''),
  CHECK (position('@' IN remetente) > 1),

  -- Usuário sem senha e senha sem usuário são metade de uma credencial: o
  -- envio falharia na primeira tentativa, e o motivo apareceria como erro do
  -- servidor de e-mail, não como cadastro pela metade. SMTP interno sem
  -- autenticação nenhuma continua válido — os dois nulos.
  CHECK ((usuario IS NULL) = (senha_cifrada IS NULL))
);

-- Uma global e uma por prefeitura. Sem os índices parciais, duas linhas
-- globais tornariam a resolução ambígua — mesmo motivo de documento_modelo.
CREATE UNIQUE INDEX idx_configuracao_email_global
  ON configuracao_email ((orgao_id IS NULL)) WHERE orgao_id IS NULL;
CREATE UNIQUE INDEX idx_configuracao_email_orgao
  ON configuracao_email (orgao_id) WHERE orgao_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- A FILA
--
-- O e-mail é enfileirado dentro da mesma transação do ato que o gerou: exigir
-- do requerente e criar o e-mail da exigência acontecem juntos ou não
-- acontecem. Ato desfeito não pode deixar e-mail pronto para sair, e SMTP fora
-- do ar não pode travar quem clicou em despachar.

CREATE TABLE email_fila (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- De qual prefeitura é o e-mail. É por ele que se resolve qual SMTP usa e é
  -- ele que mantém a fila de uma invisível para a outra.
  orgao_id      UUID NOT NULL REFERENCES orgao(id),

  tipo          VARCHAR(40) NOT NULL
                  CHECK (tipo IN ('CONVITE_FORNECEDOR', 'CONVITE_CHECKLIST',
                                  'EXIGENCIA_AO_REQUERENTE', 'PROTOCOLO_ABERTO')),

  destinatario  VARCHAR(200) NOT NULL,
  assunto       VARCHAR(200) NOT NULL,
  corpo         TEXT NOT NULL,

  -- O que este e-mail fala: a exigência, o convite, o protocolo. Serve para a
  -- tela levar de volta ao registro e para a auditoria amarrar as duas pontas.
  referencia_id UUID,

  -- Duplo clique não manda dois e-mails.
  --
  -- A chave é montada pelo caso de uso a partir do que identifica o ato —
  -- "EXIGENCIA:<id>", "CONVITE_FORNECEDOR:<id do convite>". O segundo INSERT
  -- esbarra no índice único e não entra, em vez de o requerente receber a
  -- mesma cobrança duas vezes.
  --
  -- Nulo é permitido para o que puder repetir de propósito um dia; hoje os
  -- quatro tipos preenchem.
  chave_idempotencia VARCHAR(120) UNIQUE,

  status        VARCHAR(10) NOT NULL DEFAULT 'PENDENTE'
                  CHECK (status IN ('PENDENTE', 'ENVIADO', 'FALHOU')),

  tentativas    INTEGER NOT NULL DEFAULT 0,
  ultimo_erro   TEXT,

  -- Quando o worker pode pegar. Nasce agora; a cada falha empurra para frente,
  -- com espera crescente — insistir de segundo em segundo contra um servidor
  -- fora do ar só antecipa o bloqueio do remetente.
  agendado_para TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em    TIMESTAMPTZ,

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (position('@' IN destinatario) > 1),
  CHECK (tentativas >= 0),

  -- Enviado tem data; o que não saiu, não tem. Sem isto, "ENVIADO" sem
  -- `enviado_em` seria um e-mail que ninguém sabe quando saiu — e é essa data
  -- que responde ao cidadão que jura não ter recebido nada.
  CHECK ((status = 'ENVIADO') = (enviado_em IS NOT NULL))
);

-- A varredura do worker: só o que está pendente e já venceu a espera. Índice
-- parcial porque a fila envelhece — em um ano quase toda linha é 'ENVIADO', e
-- um índice cheio delas seria carregado para não achar nada.
CREATE INDEX idx_email_fila_a_enviar
  ON email_fila (agendado_para)
  WHERE status = 'PENDENTE';

-- A tela do administrador, que lista do mais novo para o mais velho.
CREATE INDEX idx_email_fila_orgao ON email_fila (orgao_id, criado_em DESC);

-- ---------------------------------------------------------------------------
-- PARA QUEM VAI O CONVITE DE CHECKLIST
--
-- `destinatario` guarda um nome em texto livre desde a 0035, e de propósito: o
-- convite vai para engenheiro, cartório ou consórcio, que não estão em cadastro
-- nenhum. Nome não é endereço — sem uma coluna própria não há como enviar,
-- reenviar depois, nem conferir para qual endereço foi.
--
-- Continua opcional: convite sem e-mail é o de hoje, com o link copiado à mão.
-- O e-mail soma, não substitui.

ALTER TABLE checklist_convite
  ADD COLUMN destinatario_email VARCHAR(200);

ALTER TABLE checklist_convite
  ADD CONSTRAINT checklist_convite_email_check
  CHECK (destinatario_email IS NULL OR position('@' IN destinatario_email) > 1);
