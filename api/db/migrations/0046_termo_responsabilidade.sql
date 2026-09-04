-- 0046 — Quem responde pelo bem.
--
-- O patrimônio sabe **onde** o bem está desde a 1ª fatia, e nunca soube **quem
-- responde por ele** — que é a pergunta do Tribunal quando um bem some. O termo
-- de responsabilidade foi adiado duas vezes; aqui ele entra.
--
-- Levantamento consolidado em `docs/decisoes.md`, seção "Termo de
-- responsabilidade do bem". As oito decisões estão refletidas abaixo.

-- ---------------------------------------------------------------------------
-- O RESPONSÁVEL
--
-- Pessoa, e não usuário. A diretora que assina pelo mobiliário da escola
-- raramente é quem opera o sistema, e exigir login dela transformaria uma
-- assinatura de papel em cadastro de acesso.
--
-- `usuario_id` opcional liga os dois quando a pessoa também usa o sistema — é
-- por ele que, um dia, o aceite de transferência poderá ser travado por local.

CREATE TABLE responsavel_bem (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id    UUID NOT NULL REFERENCES orgao(id),
  nome        VARCHAR(150) NOT NULL,
  -- Só dígitos, como o resto do sistema guarda documento. A máscara é da tela.
  cpf         VARCHAR(11),
  cargo       VARCHAR(100),
  matricula   VARCHAR(30),
  usuario_id  UUID REFERENCES usuario(id),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  CHECK (btrim(nome) <> '')
);

CREATE INDEX idx_responsavel_orgao ON responsavel_bem(orgao_id) WHERE ativo;

-- Duas pessoas com o mesmo CPF na mesma prefeitura é a mesma pessoa cadastrada
-- duas vezes — e o termo da segunda não apareceria na busca pela primeira.
-- Parcial: CPF é opcional, e vários nulos não se comparam entre si.
CREATE UNIQUE INDEX idx_responsavel_cpf
  ON responsavel_bem(orgao_id, cpf) WHERE cpf IS NOT NULL;

-- ---------------------------------------------------------------------------
-- O TERMO
--
-- Nasce de um **local**: escolhe-se a escola, e os bens ofertados são os que
-- estão nela. Casa com a realidade — o termo do papel é sempre "os bens da
-- escola tal, sob a diretora tal" — e cria o vínculo pessoa-local que o modelo
-- não tinha.
--
-- Vigora **desde a emissão**. Esperar o digitalizado deixaria o bem sem dono
-- nas semanas entre imprimir e recolher a assinatura, que é justamente o
-- intervalo em que ninguém está olhando. O que falta assinatura aparece numa
-- lista de pendentes, e essa lista é o trabalho a fazer.

CREATE TABLE termo_responsabilidade (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id            UUID NOT NULL REFERENCES orgao(id),
  numero              VARCHAR(20) NOT NULL, -- sequencial por prefeitura e ano
  responsavel_id      UUID NOT NULL REFERENCES responsavel_bem(id),
  local_id            UUID NOT NULL REFERENCES local(id),
  data_emissao        DATE NOT NULL DEFAULT current_date,
  observacao          TEXT,
  emitido_por         UUID NOT NULL REFERENCES usuario(id),

  -- A assinatura recolhida. Nulo = pendente, e é essa a fila de trabalho.
  arquivo_assinado    VARCHAR(255),
  nome_original       VARCHAR(255),
  assinado_em         TIMESTAMPTZ,

  -- O encerramento. `data_encerramento` preenchida = o termo não vale mais.
  data_encerramento   DATE,
  motivo_encerramento VARCHAR(200),
  encerrado_por       UUID REFERENCES usuario(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, numero),

  -- Arquivo e nome andam juntos: um sem o outro é um botão de download sem
  -- rótulo, ou um rótulo que não baixa nada. Mesmo par do anexo do checklist.
  CHECK ((arquivo_assinado IS NULL) = (nome_original IS NULL)),
  CHECK ((arquivo_assinado IS NULL) = (assinado_em IS NULL)),

  -- Encerrar é um ato: tem data, motivo e quem fez. Metade disso preenchido é
  -- um termo que ninguém sabe se vale.
  CHECK (num_nonnulls(data_encerramento, motivo_encerramento, encerrado_por)
         IN (0, 3)),
  CHECK (data_encerramento IS NULL OR data_encerramento >= data_emissao)
);

CREATE INDEX idx_termo_orgao ON termo_responsabilidade(orgao_id);
CREATE INDEX idx_termo_local ON termo_responsabilidade(local_id);
CREATE INDEX idx_termo_responsavel ON termo_responsabilidade(responsavel_id);

-- A fila de assinatura: termo vivo e sem digitalizado.
CREATE INDEX idx_termo_pendente ON termo_responsabilidade(orgao_id)
  WHERE arquivo_assinado IS NULL AND data_encerramento IS NULL;

-- ---------------------------------------------------------------------------
-- OS BENS DO TERMO
--
-- Um termo cobre vários bens — a folha com as trinta carteiras, e não trinta
-- folhas. Termo de um bem só continua possível: é o mesmo termo com um item.
--
-- O estado de conservação é copiado **na emissão**: o termo diz em que estado o
-- bem foi entregue, e o bem muda de estado depois sem reescrever o passado. É a
-- mesma razão pela qual o documento emitido congela seus dados.

CREATE TABLE termo_responsabilidade_item (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_id              UUID NOT NULL REFERENCES termo_responsabilidade(id) ON DELETE CASCADE,
  bem_id                UUID NOT NULL REFERENCES bem(id),
  estado_na_entrega     VARCHAR(12) NOT NULL
                          CHECK (estado_na_entrega IN ('NOVO', 'BOM', 'DANIFICADO', 'EM_CONSERTO')),

  -- A devolução, item a item: o bem pode voltar antes do termo inteiro, e
  -- volta num estado que não é necessariamente o da entrega.
  devolvido_em          DATE,
  estado_na_devolucao   VARCHAR(12)
                          CHECK (estado_na_devolucao IS NULL
                                 OR estado_na_devolucao IN ('NOVO', 'BOM', 'DANIFICADO', 'EM_CONSERTO')),
  observacao_devolucao  VARCHAR(300),

  UNIQUE (termo_id, bem_id),
  -- Devolveu, diz em que estado. Data sem estado é meia informação, e é
  -- justamente o estado que protege quem entregou.
  CHECK ((devolvido_em IS NULL) = (estado_na_devolucao IS NULL))
);

CREATE INDEX idx_termo_item_bem ON termo_responsabilidade_item(bem_id);

-- ---------------------------------------------------------------------------
-- Um bem, um responsável por vez.
--
-- A regra que dá sentido ao módulo: perguntado "quem responde por este bem", o
-- sistema tem de ter **uma** resposta. O índice único parcial é quem garante —
-- a aplicação encerra o termo anterior antes de emitir o novo, e se algum
-- caminho esquecer, o banco recusa em vez de deixar dois donos vivos.
--
-- "Vivo" é o item não devolvido de um termo não encerrado. O `WHERE` não
-- alcança colunas de outra tabela, então a condição de termo aberto mora numa
-- coluna espelhada aqui, mantida por gatilho.
ALTER TABLE termo_responsabilidade_item
  ADD COLUMN termo_encerrado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX idx_bem_um_responsavel
  ON termo_responsabilidade_item(bem_id)
  WHERE devolvido_em IS NULL AND NOT termo_encerrado;

CREATE OR REPLACE FUNCTION espelhar_encerramento_do_termo() RETURNS TRIGGER AS $$
BEGIN
  UPDATE termo_responsabilidade_item
     SET termo_encerrado = (NEW.data_encerramento IS NOT NULL)
   WHERE termo_id = NEW.id
     AND termo_encerrado <> (NEW.data_encerramento IS NOT NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER termo_encerrado_espelha
  AFTER UPDATE OF data_encerramento ON termo_responsabilidade
  FOR EACH ROW EXECUTE FUNCTION espelhar_encerramento_do_termo();

-- ---------------------------------------------------------------------------
-- AS PEÇAS FICAM PARA A FATIA QUE AS EMITE
--
-- Esta migration entrega o **registro**: quem responde por qual bem, desde
-- quando, e a trava de um responsável por vez. O termo impresso e o termo de
-- devolução — decisões 4 e 6 do levantamento — são peças do motor de
-- documentos, e peça sem tela que a emita é modelo que o administrador vê na
-- lista, edita, e não tem de onde imprimir.
--
-- O projeto tem um guarda para isso ("escopo de documento alcançável pela
-- interface"), e ele estava certo: a versão anterior desta migration já
-- estendia o CHECK de escopo, aposentava o modelo antigo de 0020 e semeava os
-- dois novos, sem nenhuma tela do lado de lá.
--
-- Voltam juntas, na migration da fatia do termo no patrimônio:
--
--   1. `ALTER TABLE documento_modelo` estendendo o CHECK com
--      'TERMO_RESPONSABILIDADE' e 'DEVOLUCAO_RESPONSABILIDADE';
--   2. o `UPDATE` que renomeia o `TERMO_RESPONSABILIDADE` de 0020 para
--      `TERMO_RESPONSABILIDADE_BEM` e o desativa, liberando o `tipo` — o
--      modelo antigo não é apagado porque documento emitido aponta para ele;
--   3. os dois modelos globais novos.
--
-- Nada disso depende de decisão nova: está tudo em `docs/decisoes.md`. O que
-- falta é o código que as alcança.
