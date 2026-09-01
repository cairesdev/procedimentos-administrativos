-- 0037 — Os critérios do PNTP como modelo global.
--
-- O "Relatório de Prevenção Mensal — PNTP e TCE" que o cliente mantém em
-- planilha, com os 53 critérios oficiais: dimensão, código, texto e
-- classificação.
--
-- Global (`orgao_id IS NULL`), como os modelos de documento: o critério vem do
-- Tribunal e é o mesmo para todo município. Pedir que cada prefeitura cole 53
-- linhas seria repetir cinquenta e três vezes o mesmo trabalho, com cinquenta e
-- três chances de divergir.
--
-- **O responsável não vem preenchido.** A planilha diz "CONTABILIDADE COM
-- JURÍDICO", e esses nomes são de uma prefeitura — o modelo é de todas. O setor
-- sugerido pelo Tribunal fica no texto da descrição, e quem aplica atribui o
-- responsável de verdade na cópia. É trabalho manual conhecido, e a alternativa
-- seria adivinhar o organograma alheio.
--
-- Aplicar copia os itens, então a prefeitura ajusta o que quiser sem tocar no
-- modelo — e a lista do mês passado continua dizendo o que se exigiu no mês
-- passado.

ALTER TABLE checklist_modelo ALTER COLUMN orgao_id DROP NOT NULL;

-- O nome é único por prefeitura; o índice antigo não alcança o global, onde
-- `orgao_id` é nulo. Sem este, dois modelos globais com o mesmo nome entrariam.
CREATE UNIQUE INDEX idx_checklist_modelo_global_nome
  ON checklist_modelo(nome) WHERE orgao_id IS NULL;

INSERT INTO checklist_modelo (orgao_id, nome, descricao)
VALUES (NULL, 'Relatório de Prevenção Mensal — PNTP e TCE',
        'Conferência do portal da transparência contra os critérios do Programa Nacional de Transparência Pública. Refeito a cada mês: aplique o modelo para abrir a lista do mês corrente.');

INSERT INTO checklist_modelo_item
  (modelo_id, ordem, codigo, secao, titulo, descricao, classificacao, exige_anexo)
SELECT m.id, v.* FROM (VALUES
  (1, '2.2', 'Informações Institucionais', 'Divulga competências e/ou atribuições?',
   'Necessário encaminhar informações do secretariado juntamente com suas atribuições

Setor sugerido pelo TCE: ADMINISTRAÇÃO.', 'OBRIGATORIA', TRUE),
  (2, '2.3', 'Informações Institucionais', 'Identifica o nome dos responsáveis pela gestão do Poder/Órgão?',
   'Necessário encaminhar informações do secretariado juntamente com suas atribuições

Setor sugerido pelo TCE: ADMINISTRAÇÃO.', 'OBRIGATORIA', TRUE),
  (3, '2.6', 'Informações Institucionais', 'Divulga os atos normativos próprios?',
   'Necessário encaminhar as leis (2022, 2024, 2025) e decretos (2022, 2023, 2024, 2025)

Setor sugerido pelo TCE: ADMINISTRAÇÃO.', 'OBRIGATORIA', TRUE),
  (4, '3.1', 'Receita', 'Divulga as receitas do Poder ou órgão, evidenciando sua previsão e realização?',
   'Necessário encaminhar a LOA 2025 para verificar se o valor previsto de receita cadastrado no sistema de contabilidade é o mesmo que consta na lei orçamentária

Setor sugerido pelo TCE: CONTABILIDADE.', 'ESSENCIAL', TRUE),
  (5, '3.2', 'Receita', 'Divulga a classificação orçamentária por natureza da receita (categoria econômica, origem, espécie, desdobrameno)?',
   'Necessário encaminhar a LOA 2025 para verificar se o valor previsto de receita cadastrado no sistema de contabilidade é o mesmo que consta na lei orçamentária

Setor sugerido pelo TCE: CONTABILIDADE.', 'ESSENCIAL', TRUE),
  (6, '3.3', 'Receita', 'Divulga a lista dos inscritos em dívida ativa, contendo, no mínimo, dados referentes ao nome do inscrito e o valor total da dívida?',
   'Diante do exposto, necessário apresentar informações dos inscritos em dívida ativa nos anos de 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: TRIBUTOS.', 'OBRIGATORIA', TRUE),
  (7, '5.1', 'Convênios e Transferências', 'Identifica as transferências recebidas a partir da celebração de convênios/acordos com indicação, no mínimo, do valor total previsto dos recursos envolvidos, do valor recebido, do objeto, da origem (órgão repassador/concedente) e data do repasse ?',
   'Necessário apresentar informações das transferências voluntárias recebidas (convenios e contratos de repasse) em 2022, 2023, 2025

Setor sugerido pelo TCE: CONTABILIDADE COM JURÍDICO.', 'OBRIGATORIA', TRUE),
  (8, '5.2', 'Convênios e Transferências', 'Identifica as transferências realizadas a partir da celebração de acordos/ajustes, com indicação, no mínimo, do beneficiário, do objeto, do valor total previsto para repasse, do valor concedido e a data do repasse?',
   'Necessário apresentar informações das transferências voluntárias realizadas (convenios e contratos de repasse) ou nao a partir de 2022

Setor sugerido pelo TCE: CONTABILIDADE COM JURÍDICO.', 'OBRIGATORIA', TRUE),
  (9, '5.3', 'Convênios e Transferências', 'Identifica os acordos firmados que SIM envolvam transferência de recursos financeiros, identificando as partes, o objeto e as obrigações ajustadas?',
   'Necessário apresentar informações dos acordos sem transferências de recursos financeiros a partir de 2022

Setor sugerido pelo TCE: CONTABILIDADE COM JURÍDICO.', 'OBRIGATORIA', TRUE),
  (10, '6.1', 'Recursos humanos', 'Divulga a relação nominal dos servidores/autoridades/Membros, seus cargos/funções, as respectivas lotações, as suas datas de admissão/exoneração/inativação e a carga horária semanal do cargo/função ocupada/desempenhada?',
   'Necessário encaminhar as folhas de pagamento a partir de 2022

Setor sugerido pelo TCE: RECURSOS HUMANOS.', 'OBRIGATORIA', TRUE),
  (11, '6.2', 'Recursos humanos', 'Identifica a remuneração nominal de cada servidor/autoridade/Membro e a tabela com o padrão remuneratório dos cargos e funções?',
   'Necessário encaminhar a legislação de valores remuneratórios

Setor sugerido pelo TCE: RECURSOS HUMANOS COM ADMINISTRAÇÃO.', 'OBRIGATORIA', TRUE),
  (12, '6.3', 'Recursos humanos', 'Divulga a lista de seus estagiários?',
   'Necessário apresentar informações dos estagiários a partir de 2022

Setor sugerido pelo TCE: RECURSOS HUMANOS.', 'RECOMENDADA', TRUE),
  (13, '6.4', 'Recursos humanos', 'Publica lista dos terceirizados que prestam serviços para o Poder ou órgãoa instituição, contendo, em relação a cada um deles: nome completo, função ou atividade exercida e nome da empresa empregadora?',
   'Necessário apresentar informações dos terceirizados a partir de 2022

Setor sugerido pelo TCE: RECURSOS HUMANOS.', 'RECOMENDADA', TRUE),
  (14, '6.5', 'Recursos humanos', 'Divulga a íntegra dos editais de concursos e seleções públicas realizados pelo Poder ou órgão para provimento de cargos e empregos públicos?',
   'Necessário apresentar informações sobre os concursos públicos (2022, 2023, 2024 e 2025) e processos seletivos (2022, 2024, 2025)

Setor sugerido pelo TCE: RECURSOS HUMANOS.', 'OBRIGATORIA', TRUE),
  (15, '6.6', 'Recursos humanos', 'Divulga informações sobre os demais atos dos concursos públicos e processos seletivos da instituição: vagas efetivamente preenchidas, lista de aprovados com as classificações, fila de espera/cadastro reserva e validade?',
   'Necessário apresentar informações sobre os concursos públicos (2022, 2023, 2024 e 2025) e processos seletivos (2022, 2024, 2025)

Setor sugerido pelo TCE: RECURSOS HUMANOS.', 'OBRIGATORIA', TRUE),
  (16, '7.1', 'Diárias', 'Divulga o nome e o cargo/função do beneficiário, além do número de diárias usufruídas por afastamento, período de afastamento, motivo do afastamento e local de destino?',
   'Necessário apresentar informações das diárias em dezembro/2025

Setor sugerido pelo TCE: CONTABILIDADE COM JURÍDICO.', 'OBRIGATORIA', TRUE),
  (17, '7.2', 'Diárias', 'Divulga tabela ou relação que explicite os valores das diárias dentro do Estado, fora do Estado e fora do país, conforme legislação local?',
   'Necessário informar se houve alteração nos valores das diárias a partir de 2020

Setor sugerido pelo TCE: JURÍDICO.', 'OBRIGATORIA', TRUE),
  (18, '8.3', 'Licitações', 'Divulga a íntegra dos demais documentos das fases interna e externa das licitações?',
   'Necessário apresentar informações das licitações finalizadas em 2025

Setor sugerido pelo TCE: CPL.', 'OBRIGATORIA', TRUE),
  (19, '8.4', 'Licitações', 'Divulga a íntegra dos principais documentos dos processos de dispensa e inexigibilidade de licitação?',
   'Necessário apresentar informações das dispensas finalizadas (2025) e inexigibilidades (2022, 2023, 2024, 2025)

Setor sugerido pelo TCE: CPL.', 'OBRIGATORIA', TRUE),
  (20, '8.5', 'Licitações', 'Divulga a íntegra das Atas de Adesão - SRP?',
   'Necessário apresentar informações das atas de adesão finalizadas em 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: CPL.', 'OBRIGATORIA', TRUE),
  (21, '8.6', 'Licitações', 'Divulga o plano de contratações anual (art. 12,VII, da Lei n. 14.133)?',
   'Necessário encaminhar o plano de contratações anual de 2026

Setor sugerido pelo TCE: CPL COM ADMINISTRAÇÃO.', 'RECOMENDADA', TRUE),
  (22, '8.7', 'Licitações', 'Divulga a relação dos licitantes e/ou contratados sancionados administrativamente pelo Poder/órgão)?',
   'Necessário encaminhar declaração dos licitantes sancioados a partir de 2022

Setor sugerido pelo TCE: CPL.', 'RECOMENDADA', TRUE),
  (23, '9.1', 'Contratos', 'Divulga a relação dos contratos celebrados em ordem sequencial, com o seu respectivo resumo, contendo, no mínimo, indicação do contratado(a), do valor, do objeto e da vigência, bem como dos aditivos deles decorrentes?',
   'Necessário apresentar informações dos contratos (2025) e aditivos (2022, 2023, 2024, 2025)

Setor sugerido pelo TCE: SETOR DE CONTRATOS.', 'OBRIGATORIA', TRUE),
  (24, '9.2', 'Contratos', 'Divulga o inteiro teor dos contratos e dos respectivos termos aditivos?',
   'Necessário apresentar informações dos contratos (2022, 2023, 2024, 2025) e aditivos (2022, 2023, 2024, 2025)

Setor sugerido pelo TCE: SETOR DE CONTRATOS.', 'OBRIGATORIA', TRUE),
  (25, '9.3', 'Contratos', 'Divulga a relação/lista dos Fiscais dos contratos vigentes e encerrados?',
   'Necessário encaminhar uma planilha informando o número do contrato, o objeto do contrato, o responsável por fiscalizar, o cargo, o início e fim da vigência do contrato fiscalizado (caso seja uma indicação de fiscal de contrato por ano, informar o início e fim do período) - SOLICITAR O MODELO

Setor sugerido pelo TCE: ADMINISTRAÇÃO.', 'OBRIGATORIA', TRUE),
  (26, '9.4', 'Contratos', 'Divulga a ordem cronológica de seus pagamentos, bem como as justificativas que fundamentarem a eventual alteração dessa ordem?',
   'Solicitar ao sistema de contabilidade que diminua o número de cliques para que se possa visualizar as informações

Setor sugerido pelo TCE: FINANCEIRO.', 'OBRIGATORIA', TRUE),
  (27, '10.1', 'Obras', 'Divulga informações sobre obras: data de início, etapas, percentual concluído, status e previsão de conclusão?',
   'Necessário apresentar informações das obras realizadas após março/2025

Setor sugerido pelo TCE: SECRETARIA DE OBRAS OU INFRAESTRUTURA.', 'RECOMENDADA', TRUE),
  (28, '10.2', 'Obras', 'Divulga os quantitativos e os preços unitários e totais contratados?',
   'Necessário apresentar informações das obras realizadas após março/2025

Setor sugerido pelo TCE: SECRETARIA DE OBRAS OU INFRAESTRUTURA.', 'OBRIGATORIA', TRUE),
  (29, '10.3', 'Obras', 'Divulga os quantitativos executados e os preços praticados?',
   'Necessário apresentar informações das obras realizadas após março/2025

Setor sugerido pelo TCE: SECRETARIA DE OBRAS OU INFRAESTRUTURA.', 'OBRIGATORIA', TRUE),
  (30, '10.4', 'Obras', 'Divulga relação das obras paralisadas contendo o motivo, o responsável pela inexecução temporária do objeto do contrato e a data prevista para o reinício da sua execução?',
   'Necessário apresentar informações das obras paralisadas em 2025

Setor sugerido pelo TCE: SECRETARIA DE OBRAS OU INFRAESTRUTURA.', 'OBRIGATORIA', TRUE),
  (31, '11.4', 'Planejamento e Prestação de Contas', 'Divulga o resultado do julgamento das Contas do Chefe do Poder Executivo pelo Poder Legislativo?',
   'Necessário apresentar informações dos julgamentos das contas anuais por parte do legislativo de todos os anos disponíveis

Setor sugerido pelo TCE: ADMINISTRAÇÃO.', 'OBRIGATORIA', TRUE),
  (32, '11.7', 'Planejamento e Prestação de Contas', 'Divulga os objetivos estratégicos da instituição e os indicadores definidos para mensurar o alcance desses objetivos (plano estratégico institucional ou instrumento equivalente)?',
   'Devem ser divulgados os objetivos estratégicos da Poder ou órgão e os indicadores definidos para mensurar o alcance desses objetivos (plano estratégico institucional ou instrumento equivalente)

Setor sugerido pelo TCE: CONTABILIDADE.', 'RECOMENDADA', TRUE),
  (33, '11.8', 'Planejamento e Prestação de Contas', 'Divulga a Lei do Plano Plurianual (PPA) e seus anexos?',
   'Necessário encaminhar o PPA 2022/2025

Setor sugerido pelo TCE: CONTABILIDADE.', 'ESSENCIAL', TRUE),
  (34, '11.9', 'Planejamento e Prestação de Contas', 'Divulga a Lei do Diretrizes Orçamentárias (LDO) e seus anexos?',
   'Necessáro encaminhar a LDO com todos os anexos de 2025

Setor sugerido pelo TCE: CONTABILIDADE.', 'ESSENCIAL', TRUE),
  (35, '11.1', 'Planejamento e Prestação de Contas', 'Divulga a Lei Orçamentária (LOA) e seus anexos?',
   'Necessáro encaminhar a LOA com todos os anexos de 2025

Setor sugerido pelo TCE: CONTABILIDADE.', 'ESSENCIAL', TRUE),
  (36, '12.5', 'SIC', 'Divulga nesta seção, instrumento normativo local que regulamente a Lei nº 12.527/2011 - LAI?',
   'Necessário encaminhar a LAI do município

Setor sugerido pelo TCE: ADMINISTRAÇÃO.', 'OBRIGATORIA', TRUE),
  (37, '12.7', 'SIC', 'Divulga relatório anual estatístico contendo a quantidade de pedidos de acesso recebidos, atendidos, indeferidos, bem como informações genéricas sobre os solicitantes?',
   'Necessário apresentar informações do relatório anual estatístico de 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: OUVIDORIA.', 'OBRIGATORIA', TRUE),
  (38, '12.8', 'SIC', 'Divulga lista de documentos classificados em cada grau de sigilo, contendo pelo menos o assunto sobre o qual versa a informação, a categoria na qual ela se encontra, o dispositivo legal que fundamenta a classificação e o respectivo prazo?',
   'Necessário encaminhar declarações sobre documentos classificados por grau de sigilo em 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: OUVIDORIA COM JURÍDICO.', 'OBRIGATORIA', TRUE),
  (39, '12.9', 'SIC', 'Divulga lista das informações que tenham sido desclassificadas nos últimos 12 (doze) meses?”',
   'Necessário encaminhar declarações sobre documentos desclassificados por grau de sigilo em 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: OUVIDORIA COM JURÍDICO.', 'OBRIGATORIA', TRUE),
  (40, '14.2', 'Ouvidoria', 'Divulga Carta de Serviços ao Usuário?',
   'Necessário encaminhar a carta de serviços ao usuário

Setor sugerido pelo TCE: OUVIDORIA.', 'OBRIGATORIA', TRUE),
  (41, '15.1', 'LGPD e Governo Digital', 'Identifica o encarregado/responsável pelo tratamento de dados pessoais e disponibiliza Canal de Comunicação (telefone e/ou e-mail)?',
   'Conforme exigência expressa da LGPD, necessário encaminhar a portaria de responsável pela LGPD

Setor sugerido pelo TCE: ADMINISTRAÇÃO.', 'OBRIGATORIA', TRUE),
  (42, '15.5', 'LGPD e Governo Digital', 'Regulamenta a Lei Federal nº 14.129/2021 (Governo Digital) e divulga a normativa em seu portal?',
   'Necessário apresentar a Lei Federal nº 14.129/2021 e sua regulamentação local

Setor sugerido pelo TCE: ADMINISTRAÇÃO.', 'RECOMENDADA', TRUE),
  (43, '16.1', 'Renúncia de Receita', 'Divulga as desonerações tributárias concedidas e a fundamentação legal individualizada?',
   'Necessário encaminhar declaração sobre renúncias fiscais em 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: CONTABILIDADE.', 'RECOMENDADA', TRUE),
  (44, '16.2', 'Renúncia de Receita', 'Divulga os valores da renúncia fiscal prevista e realizada, por tipo ou espécie de benefício ou incentivo fiscal?',
   'Necessário encaminhar declaração sobre renúncias fiscais em 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: CONTABILIDADE.', 'RECOMENDADA', TRUE),
  (45, '16.3', 'Renúncia de Receita', 'Identifica os beneficiários das desonerações tributárias (benefícios ou incentivos fiscais)?',
   'Necessário encaminhar declaração sobre renúncias fiscais em 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: CONTABILIDADE.', 'RECOMENDADA', TRUE),
  (46, '16.4', 'Renúncia de Receita', 'Divulga informações sobre projetos de incentivo à cultura (incluindo esportivos), identificando os projetos aprovados, o respectivo beneficiário e o valor aprovado?',
   'Necessário apresentar informações das renúncias fiscais com ênfase no incentivo a projetos culturais e esportivos a partir de 2022

Setor sugerido pelo TCE: CONTABILIDADE COM SECRETARIA DE CULTURA E DE ESPORTES.', 'RECOMENDADA', TRUE),
  (47, '17.2', 'Emendas Parlamentares', 'Demonstra a execução orçamentária e financeira oriundas "emendas pix"?',
   'Necessáro apresentar se houve EMENDAS PIX em 2022, 2023, 2024, 2025

Setor sugerido pelo TCE: CONTABILIDADE.', 'RECOMENDADA', TRUE),
  (48, '18.1', 'Saúde', 'Divulga o plano de saúde, a programação anual e o relatório de gestão?',
   'Necessário encaminhar o plano de saúde (2026-2029), as programações anuais de 2022, 2023, 2024, 2025 e relatórios de gestão de 2022, 2023, 2024

Setor sugerido pelo TCE: SECRETARIA DE SAÚDE.', 'OBRIGATORIA', TRUE),
  (49, '18.3', 'Saúde', 'Divulga a lista de espera de regulação para acesso às consultas, exames e serviços médicos ?',
   'Necessário informar as diretrizes para acesso às consultas, exames e demais serviços de saúde

Setor sugerido pelo TCE: SECRETARIA DE SAÚDE.', 'RECOMENDADA', TRUE),
  (50, '18.4', 'Saúde', 'Divulga lista dos medicamentos a serem fornecidos pelo SUS e informações de como obter medicamentos, incluindo os de alto custo?',
   'Necessário apresentar informações de todos os medicamentos municipais fornecidos pelo SUS (baixo, médio e alto custo) e como obtê-los

Setor sugerido pelo TCE: SECRETARIA DE SAÚDE.', 'RECOMENDADA', TRUE),
  (51, '18.5', 'Saúde', 'Divulga os estoques de medicamentos das farmácias públicas?',
   'Necessário encaminhar a relação do estoque de medicamentos das farmácias públicas no município

Setor sugerido pelo TCE: SECRETARIA DE SAÚDE.', 'OBRIGATORIA', TRUE),
  (52, '19.1', 'Educação', 'Divulga o plano de educação e o respectivo relatório de resultados?',
   'Necessário encaminhar o plano municipal de educação e os relatórios de resultados da educação de 2022, 2023, 2024

Setor sugerido pelo TCE: SECRETARIA DE EDUCAÇÃO.', 'RECOMENDADA', TRUE),
  (53, '19.2', 'Educação', 'Divulga a lista de espera em creches públicas e os critérios de priorização de acesso a elas?',
   'Necessário encaminhar declaração sobre lista de espera em creches públicas

Setor sugerido pelo TCE: SECRETARIA DE EDUCAÇÃO.', 'OBRIGATORIA', TRUE)
) AS v(ordem, codigo, secao, titulo, descricao, classificacao, exige_anexo)
 CROSS JOIN checklist_modelo m
 WHERE m.orgao_id IS NULL AND m.nome = 'Relatório de Prevenção Mensal — PNTP e TCE';
