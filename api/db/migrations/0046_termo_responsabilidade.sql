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

/*
  Um bem, um responsável por vez.
  ---------------------------------------------------------------------------
  A regra que dá sentido ao módulo: perguntado "quem responde por este bem", o
  sistema tem de ter **uma** resposta. O índice único parcial é quem garante —
  a aplicação encerra o termo anterior antes de emitir o novo, e se algum
  caminho esquecer, o banco recusa em vez de deixar dois donos vivos.

  "Vivo" é o item não devolvido de um termo não encerrado. O `WHERE` não alcança
  colunas de outra tabela, então a condição de termo aberto mora numa coluna
  espelhada aqui, mantida por gatilho.
*/
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
-- AS PEÇAS
--
-- Dois escopos: o termo e a devolução. São documentos diferentes — um diz "sob
-- minha responsabilidade", o outro diz "devolvi, nestas condições" —, e é a
-- segunda que protege quem entregou.

ALTER TABLE documento_modelo DROP CONSTRAINT IF EXISTS documento_modelo_escopo_check;
ALTER TABLE documento_modelo
  ADD CONSTRAINT documento_modelo_escopo_check
  CHECK (escopo IN (
    'PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO',
    'BEM', 'TRANSFERENCIA_BEM', 'BAIXA_BEM', 'INVENTARIO',
    'VIAGEM', 'MANUTENCAO',
    'SOLICITACAO_ESTOQUE', 'ENTRADA_ESTOQUE', 'DEVOLUCAO_ESTOQUE',
    'RELATORIO_CONSUMO', 'CHECKLIST',
    'RELATORIO_PANORAMA', 'RELATORIO_SETOR',
    'TERMO_RESPONSABILIDADE', 'DEVOLUCAO_RESPONSABILIDADE'
  ));

/*
  O termo que já existia sai de cena.
  ---------------------------------------------------------------------------
  A 0020 semeou um `TERMO_RESPONSABILIDADE` no escopo `BEM`: uma folha por bem,
  assinada por "Responsável pelo local" — uma linha em branco, sem nome, e sem
  o sistema guardar nada do que foi assinado. Serve para imprimir e não serve
  para responder quem responde pelo bem.

  Ele não é apagado: documento já emitido aponta para o modelo, e apagar levaria
  o histórico junto. Ganha nome próprio, deixa de ser oferecido e libera o
  `tipo` — que é único entre os modelos globais — para o termo de verdade.
  Reverter é um UPDATE.
*/
UPDATE documento_modelo
   SET tipo = 'TERMO_RESPONSABILIDADE_BEM',
       nome = 'Termo de responsabilidade (modelo antigo, por bem)',
       ativo = FALSE
 WHERE orgao_id IS NULL
   AND escopo = 'BEM'
   AND tipo = 'TERMO_RESPONSABILIDADE';

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES

(NULL, 'PATRIMONIO', 'TERMO_RESPONSABILIDADE', 'TERMO_RESPONSABILIDADE',
 'Termo de responsabilidade', 'TERMO DE RESPONSABILIDADE',
$corpo$<p>Termo nº <strong>{{termo.numero}}</strong>, emitido em {{termo.dataEmissao}}.</p>

<p>Pelo presente termo, <strong>{{responsavel.nome}}</strong>, {{responsavel.cargo}},
inscrito(a) no CPF sob o nº {{responsavel.cpf}}, declara receber e assumir a
responsabilidade pela guarda e conservação dos bens patrimoniais abaixo
relacionados, lotados em <strong>{{local.nome}}</strong>.</p>

<p>Os bens permanecerão sob sua responsabilidade até a devolução formal, devendo
ser comunicada de imediato qualquer ocorrência de dano, extravio ou necessidade
de transferência.</p>

{{termo.tabelaDeBens}}

<p>{{termo.observacao}}</p>

<p>{{orgao.municipio}}, {{documento.dataPorExtenso}}.</p>

<br /><br />
<p style="text-align:center">_____________________________________<br />
{{responsavel.nome}}<br />{{responsavel.cargo}}</p>
<br />
<p style="text-align:center">_____________________________________<br />
{{usuario.nome}}<br />Setor de Patrimônio</p>$corpo$),

(NULL, 'PATRIMONIO', 'DEVOLUCAO_RESPONSABILIDADE', 'DEVOLUCAO_RESPONSABILIDADE',
 'Termo de devolução de bens', 'TERMO DE DEVOLUÇÃO DE BENS',
$corpo$<p><strong>{{responsavel.nome}}</strong>, {{responsavel.cargo}}, CPF nº
{{responsavel.cpf}}, devolve nesta data os bens patrimoniais abaixo relacionados,
recebidos por meio do Termo de Responsabilidade nº <strong>{{termo.numero}}</strong>,
emitido em {{termo.dataEmissao}}, referentes a <strong>{{local.nome}}</strong>.</p>

<p>Motivo da devolução: {{termo.motivoEncerramento}}.</p>

{{termo.tabelaDeDevolucao}}

<p>{{orgao.municipio}}, {{documento.dataPorExtenso}}.</p>

<br /><br />
<p style="text-align:center">_____________________________________<br />
{{responsavel.nome}}</p>
<br />
<p style="text-align:center">_____________________________________<br />
{{usuario.nome}}<br />Setor de Patrimônio</p>$corpo$);
