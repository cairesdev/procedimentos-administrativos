-- 0049 — Programas de cuidado continuado: a fila que o Ministério Público pediu.
--
-- Nasceu de uma intimação. A Promotoria requisitou de Bela Vista do Maranhão o
-- número de pessoas com TEA por faixa etária, a fila de espera com tempo médio
-- e periodicidade das terapias, e a carga horária, o local e o vínculo dos
-- profissionais — dizendo se atuam exclusiva ou parcialmente no atendimento.
--
-- Aquela resposta não saiu daqui: o dado nunca tinha sido coletado. Estas
-- tabelas existem para a **próxima** requisição, e o padrão diz que vem —
-- requisição vira inquérito civil, que vira TAC com relatório periódico.
--
-- **O que este módulo mede, ele mede de verdade.** Quem entrou na fila, quando,
-- e quanto esperou até a primeira sessão. Se a fila for ruim, o número sai ruim
-- e datado. Nada aqui foi desenhado para suavizar: dado de fila que mente é o
-- que transforma requisição em ação civil pública.
--
-- Levantamento em `docs/decisoes.md`, seção "Programas de cuidado continuado".

-- ---------------------------------------------------------------------------
-- SEM MÓDULO NOVO, E DE PROPÓSITO
--
-- Isto entra em `SAUDE`, junto da ficha hospitalar. Um módulo próprio deixaria
-- a prefeitura contratar programas sem contratar saúde — e a inscrição aponta
-- para `paciente`, que é o cadastro mais sensível do produto. Duas portas para
-- o mesmo dado é uma porta a mais para esquecer de trancar.

-- ---------------------------------------------------------------------------
-- OS DOIS PAPÉIS NOVOS
--
-- Quem coordena o programa inscreve, indica terapia e cadastra a equipe. Quem
-- é terapeuta registra a sessão que atendeu, e nada além.
--
-- **O ADMIN continua sem ver inscrito.** É a mesma regra da decisão 21: ele
-- monta o catálogo de programas e terapias — que não tem pessoa nenhuma — e
-- não alcança quem está inscrito nem com que CID. Dado de saúde é categoria
-- especial na LGPD, e coordenação de programa é cargo, não privilégio de
-- administrador.

ALTER TABLE usuario DROP CONSTRAINT usuario_papel_base_check;

ALTER TABLE usuario ADD CONSTRAINT usuario_papel_base_check
  CHECK (papel_base IN (
    'ADMIN', 'GESTOR', 'SERVIDOR', 'PROTOCOLO',
    'COMPRAS', 'CONTROLADORIA', 'NUTRICIONISTA', 'UNIDADE',
    'PATRIMONIO', 'FROTAS',
    'SAUDE_RECEPCAO', 'SAUDE_TECNICO', 'SAUDE_ENFERMEIRO', 'SAUDE_MEDICO',
    'SAUDE_COORDENACAO', 'SAUDE_TERAPEUTA'
  ));

-- O conselho do terapeuta.
--
-- Fonoaudiólogo tem CRFa, fisioterapeuta e terapeuta ocupacional têm CREFITO,
-- psicólogo tem CRP. Eles entram no CHECK agora porque o cadastro do usuário
-- já os aceita; **cobrar** o conselho deles fica para a fatia da evolução
-- clínica, quando a assinatura passar a valer alguma coisa. Ampliar a lista
-- sem cobrar é barato; cobrar antes de a assinatura existir seria campo
-- obrigatório sem consequência, que é como nasce dado inventado.
ALTER TABLE usuario DROP CONSTRAINT usuario_conselho_tipo_check;

ALTER TABLE usuario ADD CONSTRAINT usuario_conselho_tipo_check
  CHECK (conselho_tipo IN ('CRM', 'COREN', 'CRFA', 'CREFITO', 'CRP', 'OUTRO'));

-- ---------------------------------------------------------------------------
-- O CATÁLOGO
--
-- `programa` e `terapia` são cadastro: não têm pessoa nenhuma, e é por isso que
-- o administrador pode mexer neles. TEA é o primeiro; saúde mental, gestante
-- de alto risco e hipertenso cabem na mesma estrutura sem uma linha de código
-- nova — que é a razão de o módulo não se chamar "TEA".

CREATE TABLE programa (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id    UUID NOT NULL REFERENCES orgao(id),
  nome        VARCHAR(150) NOT NULL,
  sigla       VARCHAR(20),
  descricao   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (orgao_id, nome),
  CHECK (btrim(nome) <> '')
);
CREATE INDEX idx_programa_orgao ON programa(orgao_id);

CREATE TABLE terapia (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES programa(id),
  nome        VARCHAR(120) NOT NULL,

  -- Qual conselho atende esta terapia. Serve à tela, que oferece os
  -- profissionais certos, e ao relatório, que separa por categoria.
  conselho    VARCHAR(10)
                CHECK (conselho IN ('CRM', 'COREN', 'CRFA', 'CREFITO', 'CRP', 'OUTRO')),

  ativo       BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE (programa_id, nome),
  CHECK (btrim(nome) <> '')
);
CREATE INDEX idx_terapia_programa ON terapia(programa_id);

-- ---------------------------------------------------------------------------
-- QUEM ESTÁ NO PROGRAMA
--
-- A pessoa é o `paciente` que já existe — mesmo cadastro do pronto
-- atendimento, mesmo prontuário vitalício. Um cadastro paralelo faria a mesma
-- criança existir duas vezes no município, e é justamente a duplicidade que o
-- prontuário vitalício existe para impedir.

CREATE TABLE inscricao (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id      UUID NOT NULL REFERENCES orgao(id),
  programa_id   UUID NOT NULL REFERENCES programa(id),
  paciente_id   UUID NOT NULL REFERENCES paciente(id),

  inscrito_em   DATE NOT NULL DEFAULT current_date,

  -- "Diagnosticadas OU em acompanhamento" — o ofício pediu os dois números.
  --
  -- Somar tudo responderia errado, e quem aguarda avaliação é justamente quem
  -- ocupa a fila que está sendo investigada. Por isso a situação separa os
  -- dois desde o primeiro dia, e não como um `boolean diagnosticado` que
  -- depois não teria como distinguir alta de abandono.
  situacao      VARCHAR(20) NOT NULL DEFAULT 'EM_INVESTIGACAO'
                  CHECK (situacao IN ('EM_INVESTIGACAO', 'DIAGNOSTICADO',
                                      'ALTA', 'TRANSFERIDO', 'ABANDONO')),

  diagnostico_em DATE,
  cid            VARCHAR(10),
  observacao     TEXT,

  encerrado_em   DATE,
  criado_por     UUID REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A mesma pessoa não entra duas vezes no mesmo programa. Entraria por
  -- recadastro, e a fila passaria a contar duas esperas de uma criança só.
  UNIQUE (programa_id, paciente_id),

  -- Diagnóstico sem data é número que ninguém consegue auditar; data sem
  -- diagnóstico é registro que se contradiz.
  CHECK ((situacao <> 'DIAGNOSTICADO') OR diagnostico_em IS NOT NULL),
  CHECK (diagnostico_em IS NULL OR diagnostico_em >= inscrito_em),

  -- Encerrada é encerrada: alta, transferência e abandono têm data.
  CHECK ((situacao IN ('ALTA', 'TRANSFERIDO', 'ABANDONO')) = (encerrado_em IS NOT NULL))
);
CREATE INDEX idx_inscricao_orgao ON inscricao(orgao_id, programa_id);
CREATE INDEX idx_inscricao_paciente ON inscricao(paciente_id);

-- ---------------------------------------------------------------------------
-- A FILA
--
-- **Uma fila por terapia, não uma por pessoa.** A criança pode estar em
-- fonoaudiologia e esperando terapia ocupacional há oito meses; fila única
-- diria que ela "está atendida" e esconderia a espera — que é exatamente a
-- pergunta do promotor.
--
-- A espera é `iniciada_em - indicada_em`. Quem ainda não começou tem
-- `iniciada_em` nulo e espera **até hoje**: é a fila viva, e é ela que cresce
-- sozinha enquanto ninguém atende. Não há coluna `dias_de_espera` de
-- propósito — número gravado envelhece, e envelhece para menos.

CREATE TABLE indicacao (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id  UUID NOT NULL REFERENCES inscricao(id),
  terapia_id    UUID NOT NULL REFERENCES terapia(id),

  indicada_em   DATE NOT NULL DEFAULT current_date,

  -- Quantas sessões por semana foram combinadas. É o "ofertado" contra o qual
  -- o realizado vai ser comparado — e a diferença entre os dois é a pergunta
  -- que o promotor faz na sequência.
  periodicidade_semanal NUMERIC(4,1),

  iniciada_em   DATE,
  encerrada_em  DATE,
  motivo_encerramento VARCHAR(200),

  indicada_por  UUID REFERENCES usuario(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (iniciada_em IS NULL OR iniciada_em >= indicada_em),
  CHECK (encerrada_em IS NULL OR iniciada_em IS NOT NULL),
  CHECK (encerrada_em IS NULL OR encerrada_em >= iniciada_em),
  CHECK (periodicidade_semanal IS NULL OR periodicidade_semanal > 0)
);
CREATE INDEX idx_indicacao_inscricao ON indicacao(inscricao_id);

-- A fila viva, que é a consulta mais lida do módulo: quem foi indicado e ainda
-- não começou. Índice parcial pelo mesmo motivo do da fila de e-mail.
CREATE INDEX idx_indicacao_na_fila
  ON indicacao(terapia_id, indicada_em) WHERE iniciada_em IS NULL;

-- Uma indicação viva por terapia. Reindicar a mesma terapia sem encerrar a
-- anterior colocaria a pessoa duas vezes na mesma fila.
CREATE UNIQUE INDEX idx_indicacao_viva
  ON indicacao(inscricao_id, terapia_id) WHERE encerrada_em IS NULL;

-- ---------------------------------------------------------------------------
-- A SESSÃO
--
-- Frequência, e não evolução clínica. Data, terapia, profissional e se a
-- pessoa compareceu: responde periodicidade e quem atendeu sem o aparato de
-- assinatura e imutabilidade da ficha hospitalar.
--
-- A evolução de cada terapeuta vem noutra fatia, quando a assinatura passar a
-- valer alguma coisa — e aí o conselho deles vira exigência, como é o do
-- médico e o do enfermeiro hoje.

CREATE TABLE sessao (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicacao_id   UUID NOT NULL REFERENCES indicacao(id),
  data           DATE NOT NULL,
  profissional_id UUID NOT NULL REFERENCES usuario(id),

  -- Falta é dado, e não ausência de dado. Sessão marcada e não realizada
  -- explica boa parte da diferença entre o ofertado e o recebido, e apagá-la
  -- faria o município parecer pior do que é — ou melhor, dependendo do lado.
  compareceu     BOOLEAN NOT NULL DEFAULT TRUE,

  observacao     VARCHAR(300),
  registrado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Duas sessões da mesma terapia no mesmo dia para a mesma pessoa é
  -- digitação repetida, e infla a periodicidade apurada.
  UNIQUE (indicacao_id, data)
);
CREATE INDEX idx_sessao_indicacao ON sessao(indicacao_id, data DESC);
CREATE INDEX idx_sessao_profissional ON sessao(profissional_id, data);

-- ---------------------------------------------------------------------------
-- A EQUIPE
--
-- É o item 3 do ofício, inteiro: carga horária, local de atuação, vínculo, e
-- **quantas dessas horas são do programa**. A última é a pergunta que o
-- promotor fez com outras palavras — "se atuam exclusivamente ou parcialmente"
-- — e é a que nenhuma folha de pagamento responde sozinha.

CREATE TABLE profissional_programa (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id    UUID NOT NULL REFERENCES programa(id),
  usuario_id     UUID NOT NULL REFERENCES usuario(id),
  terapia_id     UUID REFERENCES terapia(id),

  carga_horaria_semanal NUMERIC(4,1) NOT NULL,
  horas_no_programa     NUMERIC(4,1) NOT NULL,

  local_id       UUID REFERENCES local(id),
  unidade_saude_id UUID REFERENCES unidade_saude(id),

  tipo_vinculo   VARCHAR(20) NOT NULL
                   CHECK (tipo_vinculo IN ('EFETIVO', 'CONTRATO', 'CEDIDO',
                                           'TERCEIRIZADO', 'OUTRO')),

  iniciado_em    DATE NOT NULL DEFAULT current_date,
  encerrado_em   DATE,

  UNIQUE (programa_id, usuario_id, terapia_id),

  CHECK (carga_horaria_semanal > 0 AND carga_horaria_semanal <= 60),

  -- Dedicar ao programa mais horas do que se tem é o erro que faria a resposta
  -- ao Ministério Público não fechar com a folha de pagamento.
  CHECK (horas_no_programa > 0 AND horas_no_programa <= carga_horaria_semanal),
  CHECK (encerrado_em IS NULL OR encerrado_em >= iniciado_em)
);
CREATE INDEX idx_profissional_programa ON profissional_programa(programa_id);
CREATE INDEX idx_profissional_programa_usuario ON profissional_programa(usuario_id);

-- ---------------------------------------------------------------------------
-- O RECORTE DO RELATÓRIO
--
-- Guarda os **parâmetros** — programa e período —, nunca os números. É o mesmo
-- desenho de `relatorio_processo` (0044) e de `relatorio_consumo` (0028), e
-- pela mesma razão: gravar o resultado faria reabrir o relatório de ontem
-- mostrar dados de ontem enquanto a tela ao lado mostra os de hoje, e ninguém
-- saberia qual vale.
--
-- Quem precisa do retrato **emite o documento**, que congela os valores com
-- timbre, data, autor e código de conferência. Numa resposta ao Ministério
-- Público isso é o essencial: o ofício anexa uma peça datada, e a fila continua
-- andando na tela sem contradizê-la.

CREATE TABLE recorte_de_programa (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id       UUID NOT NULL REFERENCES orgao(id),
  programa_id    UUID NOT NULL REFERENCES programa(id),
  periodo_inicio DATE NOT NULL,
  periodo_fim    DATE NOT NULL,
  criado_por     UUID REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Período invertido devolveria relatório vazio, e quem lê concluiria que o
  -- município não atende ninguém — o pior jeito de errar num documento que vai
  -- para uma Promotoria.
  CHECK (periodo_fim >= periodo_inicio)
);
CREATE INDEX idx_recorte_de_programa_orgao
  ON recorte_de_programa(orgao_id, criado_em DESC);

-- ---------------------------------------------------------------------------
-- A PEÇA
--
-- Os três itens do ofício, na ordem em que ele os pediu. Global
-- (`orgao_id IS NULL`): a pergunta do Ministério Público é a mesma em qualquer
-- município, e o que muda — o timbre — já vem de `orgao_documento_config`.

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
    'FICHA_ATENDIMENTO', 'RELATORIO_PROGRAMA'
  ));

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES
(NULL, 'SAUDE', 'RELATORIO_PROGRAMA', 'RELATORIO_PROGRAMA',
 'Relatório do programa (resposta a requisição)',
 'RELATÓRIO DE ATENDIMENTO — PROGRAMA DE CUIDADO CONTINUADO',
$corpo$<p style="text-align: center; font-size: 15pt; font-weight: bold; margin: 0 0 4px">{{programa.nome}}</p>

<p style="text-align: center; margin: 0 0 20px"><small>Período apurado: {{relatorio.periodo}} &middot; emitido em {{data.curta}}</small></p>

<p style="margin: 0 0 4px"><b>1. PESSOAS ACOMPANHADAS</b></p>

<table>
<tr><th>Situação</th><th>Quantidade</th></tr>
{{#situacoes}}<tr><td>{{situacao}}</td><td>{{quantidade}}</td></tr>{{/situacoes}}
</table>

<p style="margin: 12px 0 4px"><small>Distribuição por faixa etária (pessoas ativas: em investigação ou diagnosticadas)</small></p>

<table>
<tr><th>Faixa etária</th><th>Quantidade</th></tr>
{{#faixas}}<tr><td>{{rotulo}}</td><td>{{quantidade}}</td></tr>{{/faixas}}
</table>

<p style="margin: 0 0 16px"><small>Total de pessoas ativas: <b>{{relatorio.totalAtivos}}</b></small></p>

<hr />

<p style="margin: 14px 0 4px"><b>2. FILA DE ESPERA E PERIODICIDADE</b></p>

<p style="margin: 0 0 8px"><small>A espera é contada da indicação da terapia até a primeira sessão. Quem ainda não iniciou permanece na fila, e a espera segue correndo.</small></p>

<table>
<tr><th>Terapia</th><th>Na fila</th><th>Espera mais antiga (dias)</th><th>Espera média na fila (dias)</th><th>Iniciados</th><th>Média até iniciar (dias)</th><th>Mediana (dias)</th><th>Sessões/semana por pessoa</th></tr>
{{#fila}}<tr><td>{{terapiaNome}}</td><td>{{naFila}}</td><td>{{esperaMaisAntiga}}</td><td>{{mediaNaFila}}</td><td>{{iniciados}}</td><td>{{mediaAteIniciar}}</td><td>{{medianaAteIniciar}}</td><td>{{periodicidade}}</td></tr>{{/fila}}
</table>

<hr />

<p style="margin: 14px 0 4px"><b>3. PROFISSIONAIS</b></p>

<table>
<tr><th>Profissional</th><th>Conselho</th><th>Terapia</th><th>Local</th><th>Vínculo</th><th>Carga semanal</th><th>Horas no programa</th><th>Dedicação</th></tr>
{{#equipe}}<tr><td>{{nome}}</td><td>{{conselho}}</td><td>{{terapia}}</td><td>{{local}}</td><td>{{vinculo}}</td><td>{{cargaHoraria}}h</td><td>{{horasNoPrograma}}h</td><td>{{dedicacao}}</td></tr>{{/equipe}}
</table>

<p style="margin: 12px 0 16px"><small>{{relatorio.resumoDaEquipe}}</small></p>

<hr />

<p style="margin: 14px 0 0"><small><b>Sobre estes números.</b> Foram apurados pelo sistema de gestão do município na data de emissão, a partir dos registros de inscrição, indicação de terapia e sessões realizadas. A fila abrange exclusivamente a rede municipal: pessoas encaminhadas à regulação estadual não constam. Este documento pode ser conferido pelo código {{documento.codigo}}.</small></p>
$corpo$);

-- ---------------------------------------------------------------------------
-- NOTA SOBRE O QUE ESTE MÓDULO NÃO FAZ
--
-- Não agenda: registra o que aconteceu. A periodicidade sai do histórico, que
-- é mais honesto que a grade — grade cheia com sessão não realizada engana os
-- dois lados.
--
-- Não emite a CIPTEA (Lei 13.977/2020), que é do município e vale cinco anos.
-- O cadastro daqui é a base natural dela, e o Ministério Público costuma
-- perguntar por ela na sequência. Fatia própria.
--
-- Não enxerga a regulação estadual: a fila daqui é a do município, e quem foi
-- regulado para fora não aparece. Dizer o contrário no relatório seria afirmar
-- o que o sistema não sabe.
