# Módulo de Saúde — manual do usuário

Este manual é para quem usa o sistema no dia a dia: recepção, enfermagem,
medicina, coordenação de programas, terapeutas e a direção da secretaria.

O módulo tem **dois serviços que não se misturam**:

| Serviço | O que é | Quem trabalha nele |
|---|---|---|
| **Pronto atendimento** | A ficha do hospital, da chegada à saída | Recepção, técnico, enfermeiro, médico |
| **Cuidado continuado** | Programas de acompanhamento (TEA, saúde mental, gestante de risco): inscrição, fila de terapias e sessões | Coordenação e terapeutas |

Quem atende no plantão não mexe na fila das terapias, e quem coordena o
programa não abre ficha nem lê prontuário. Por isso o menu separa os dois.

---

## 1. Entrando no sistema

Na tela inicial do sistema (o "hub"), clique no cartão **Saúde**.

Você cai na **Visão do dia**, que mostra:

- quantas pessoas estão **em atendimento agora** no hospital;
- quantas pessoas são **acompanhadas** pelos programas;
- quantas estão **esperando alguma terapia** (aparece em vermelho quando há
  fila);
- avisos em vermelho quando falta um cadastro essencial, com o link para
  resolver.

Cada número é um atalho para a tela onde ele se resolve.

### O menu, do lado esquerdo

- **Início** → Visão do dia
- **Pronto atendimento** → Atendimentos, Pacientes
- **Cuidado continuado** → Inscritos, Equipe, Relatório
- **Cadastros** → Unidades de saúde, Programas de cuidado

Você só enxerga os grupos do seu perfil. Se um grupo não aparece, é porque
aquele trabalho não é do seu cargo — não é falha do sistema.

---

## 2. Quem é quem

| Perfil | O que faz |
|---|---|
| **Recepção da saúde** | Cadastra o paciente e abre a ficha de atendimento |
| **Técnico de enfermagem** | Registra o horário em que deu cada medicação |
| **Enfermeiro** | Triagem, evolução de enfermagem, transcrição de resultado de exame e a saída do paciente |
| **Médico** | Avaliação, exames, prescrição, procedimento e evolução médica |
| **Coordenação do programa** | Cadastra e inscreve pessoas, indica terapias, marca o início, monta a equipe e emite o relatório |
| **Terapeuta** | Registra as sessões que atendeu |
| **Administrador / Gestor (secretário)** | Lê tudo, cadastra unidades e programas — e **não** executa ato clínico |

**Por que a direção não abre ficha nem inscreve ninguém:** a ficha impressa diz
o nome de quem assinou cada bloco. Um secretário não assina triagem de
enfermagem. Ele lê o serviço inteiro, inclusive o prontuário, e toda leitura de
prontuário fica registrada na auditoria — inclusive a dele.

**Médico e enfermeiro precisam do conselho (CRM/COREN) no cadastro do
usuário.** Sem ele o sistema não deixa fechar triagem, avaliação, prescrição,
procedimento, evolução nem a saída: é o carimbo que vai impresso na ficha. Para
terapeutas (CRFa, CREFITO, CRP) o campo existe e é opcional.

---

## 3. Antes de começar: os dois cadastros

Feitos uma vez, por quem administra o módulo, em **Cadastros**.

### Unidades de saúde

Hospital, UBS, postos. **Sem pelo menos uma, não há onde abrir atendimento.**

Ao cadastrar, você pode procurar no CNES (cadastro nacional) digitando o
**município** — o serviço do Ministério não busca por nome do estabelecimento.
A busca traz nome, tipo e endereço prontos. Se o serviço estiver fora do ar,
preencha à mão: nenhum atendimento depende dessa consulta.

### Programas de cuidado

Um programa reúne as **terapias** de um acompanhamento. Exemplo: programa
"Atenção à Pessoa com TEA" com fonoaudiologia, terapia ocupacional e
psicologia.

- Cadastre o programa (nome e sigla).
- Dentro dele, cadastre cada terapia, com o conselho profissional que a atende.
- **A fila de espera é contada por terapia**, nunca pelo programa inteiro.

---

## 4. Pronto atendimento

### 4.1 Abrir a ficha (recepção)

**Atendimentos → Abrir atendimento.**

1. Escolha a unidade.
2. Procure o paciente por nome, prontuário ou documento.
3. Se ele nunca veio, cadastre em **Pacientes → Cadastrar paciente**. Só o nome
   é obrigatório — documento em branco não impede o atendimento.
4. **Sem identificar o paciente também abre.** É o caso de quem chega
   inconsciente ou sem documento: a ficha abre, o socorro começa, e a
   identificação entra depois pelo botão *Identificar o paciente*.

O prontuário nasce uma vez e **acompanha a pessoa para sempre**. O número do
atendimento é anual.

> A ficha **não pode ser encerrada sem paciente identificado**. Ficha sem nome
> é ficha que ninguém acha depois.

### 4.2 Triagem (enfermeiro)

Sinais vitais, queixa e prioridade.

O sistema **recusa o impossível e avisa no improvável**:

| Sinal | Recusado fora de | Avisa fora de |
|---|---|---|
| Temperatura | 25 – 45 °C | 35 – 38 °C |
| Pulso | 20 – 300 bpm | 50 – 120 bpm |
| Saturação | 30 – 100 % | 92 – 100 % |
| Pressão sistólica | 40 – 300 mmHg | 90 – 180 mmHg |
| Pressão diastólica | 20 – 200 mmHg | 50 – 110 mmHg |
| Glicemia | 10 – 1000 mg/dL | 60 – 250 mg/dL |

O aviso não trava nada: 41,5 °C é grave e é verdade. O que o sistema recusa é
368 °C, que é erro de digitação.

> **O médico não preenche a triagem**, nem no plantão de madrugada sem
> enfermeiro. Nesse caso a triagem fica em branco e os sinais vitais entram na
> avaliação médica — que é o que já acontece no papel.

### 4.3 Avaliação, exames, prescrição (médico)

- **Serviço médico**: queixa, exame físico, hipótese diagnóstica, conduta.
- **Exames solicitados**: o pedido é do médico; **o resultado pode ser
  transcrito pelo enfermeiro**, porque ele chega horas depois, muitas vezes
  fora do plantão de quem pediu.
- **Prescrição**: um item por linha (medicamento, dose, via, intervalo).

### 4.4 Horário da medicação (técnico ou enfermeiro)

Em cada item prescrito, o botão de registrar administração. **Horário no futuro
é recusado** — registra-se depois de dar o remédio, não antes.

### 4.5 Evolução e procedimento

Enfermagem e medicina evoluem em blocos separados, cada um assinado por quem
escreveu. Procedimento realizado é do médico.

### 4.6 Saída (enfermeiro)

**Resumo de saída**: alta, encaminhamento, evasão ou óbito.

- Encaminhamento **exige dizer para onde**.
- A saída não pode ser anterior à abertura da ficha (mas pode ser no **mesmo
  minuto**: quem chega, é triado e é dispensado na hora consegue encerrar).

### 4.7 Depois de encerrada

**A ficha fechada não é editada.** O que existe é a **retificação**: o registro
original continua, a correção entra ao lado, com o nome de quem corrigiu e a
hora. A ficha impressa mostra as duas — é a rasura datada e rubricada do papel.

Depois da alta ainda entram: **resultado de exame** e **retificação**.

### 4.8 Imprimir a ficha

No fim da ficha, **Ficha impressa**. O documento sai com o timbre da
prefeitura, os blocos na ordem do papel, a assinatura de cada responsável e um
**código de conferência**.

### 4.9 Histórico do paciente

Em **Pacientes**, abrindo uma pessoa, você vê as visitas anteriores. A lista
mostra os **últimos 12 meses** por padrão; "histórico completo" alcança os 20
anos de guarda. Nada é apagado — o corte é só da tela.

> **Toda leitura de histórico clínico fica registrada na auditoria**, com quem
> leu e quando. É a contrapartida de o prontuário estar aberto à equipe.

---

## 5. Cuidado continuado (programas)

### 5.1 Inscrever uma pessoa

**Cuidado continuado → Inscritos → Inscrever.**

1. Escolha o **programa**.
2. Procure a **pessoa** por nome, prontuário, CPF ou cartão do SUS.
3. **Se não encontrar**, aparece o botão *Cadastrar "fulano"*: nome, mãe,
   nascimento, sexo, CNS, CPF e telefone. Só o nome é obrigatório. A pessoa
   nasce com prontuário e já fica selecionada.
4. **Situação**: "Em investigação" (ainda sem laudo) ou "Diagnosticado" — este
   exige a **data do diagnóstico**, porque é o primeiro número que a Promotoria
   confere.
5. Inscrever.

> Se o CPF já existir, o sistema **não cria uma segunda ficha**: ele avisa e
> seleciona quem já está cadastrado. Duas fichas da mesma criança contariam a
> mesma pessoa duas vezes no relatório.

**Quem inscreve é a coordenação.** O administrador e o secretário veem a lista
e não têm o botão.

### 5.2 Indicar a terapia — é isso que coloca na fila

Na ficha do inscrito, **Indicar terapia**:

- a terapia;
- a data da indicação (**é daqui que a espera começa a contar**);
- as sessões por semana combinadas (meia sessão existe: uma a cada quinze dias
  é 0,5).

A mesma pessoa pode estar **sendo atendida** em fonoaudiologia e **esperando**
terapia ocupacional. As duas coisas aparecem juntas, e a fila é contada por
terapia.

### 5.3 Iniciar — o registro mais importante do módulo

Quando o primeiro atendimento acontecer, use **Iniciar** e informe a data.

> **Enquanto ninguém registrar o início, a pessoa continua na fila e a espera
> dela cresce sozinha todo dia — inclusive no papel que vai para a Promotoria.**
> Não é possível lançar sessão antes de marcar o início.

### 5.4 Registrar as sessões (terapeuta)

Na ficha do inscrito, **Registrar sessão**: data, se a pessoa compareceu, e
observação.

- **A falta é registrada, não apagada.** Ela explica a diferença entre o que
  foi combinado e o que a família recebeu.
- Sessão no futuro é recusada.
- Duas sessões da mesma terapia no mesmo dia são digitação repetida. Se
  houve mesmo dois atendimentos, escreva o segundo na observação do primeiro.
- Quem registra é quem atendeu: o sistema grava o seu nome.

### 5.5 Encerrar a terapia ou mudar a situação

- **Encerrar** a terapia pede a data e o motivo.
- **Mudar situação** da pessoa: alta, transferido ou abandono. Quem sai
  continua na lista, com a data — a saída também é resposta.

### 5.6 Equipe

**Cuidado continuado → Equipe.** Para cada profissional:

- terapia que atende;
- **local de atuação**;
- **vínculo funcional** (efetivo, contrato temporário, cedido, terceirizado);
- **carga horária semanal** (a do contrato) e **horas neste programa**.

A dedicação é **calculada**: quem dedica ao programa toda a carga que tem
aparece como *exclusiva*; o resto, *parcial*. Não existe um campo "exclusivo
sim/não" porque a resposta mudaria sozinha quando o contrato mudasse.

O sistema recusa dedicar ao programa mais horas do que a pessoa tem no
contrato.

### 5.7 Relatório e o ofício ao Ministério Público

**Cuidado continuado → Relatório.** Escolha o programa e o período (a sugestão
é 90 dias) e clique em **Apurar**. O relatório traz, nesta ordem:

1. **Pessoas acompanhadas** — por situação e por faixa etária (0 a 3, 4 a 6, 7
   a 11, 12 a 17, 18 ou mais). Faixas vazias continuam na tabela, e quem está
   sem data de nascimento aparece numa linha própria.
2. **Fila e periodicidade**, terapia por terapia: quantos esperam, a espera
   mais antiga, a média, quantos já iniciaram, a média e a mediana até
   iniciar, e as sessões por semana combinadas versus as realizadas.
3. **Profissionais**: carga horária, local, vínculo e dedicação, com o resumo
   em uma frase.

Para virar documento, clique em **Gerar documento deste período**. O sistema
salva o recorte (programa e período) e abre a tela de emissão. A peça sai com
os três itens, o timbre da prefeitura e **código de conferência**.

> Os números da tela mudam todo dia. Os do documento ficam presos ao papel — é
> isso que uma resposta a requisição precisa: um documento que continue dizendo,
> daqui a um ano, o que se via hoje.

---

## 6. Por que o sistema não deixa

| Mensagem | Motivo |
|---|---|
| "Este atendimento ainda está sem paciente identificado" | Ficha sem nome não é encontrada depois. Identifique antes da saída. |
| "Informe para onde o paciente foi encaminhado" | Encaminhamento sem destino não é encaminhamento. |
| "Está fora do que é possível" (sinal vital) | Erro de digitação. Valores graves e verdadeiros passam com aviso. |
| "Registre o início antes da primeira sessão" | O início é o que fecha a espera na fila. Sem ele, a pessoa apareceria como esperando e sendo atendida ao mesmo tempo. |
| "Já existe sessão desta terapia em ..." | O mesmo dia lançado duas vezes dobraria a frequência de quem foi atendido uma vez só. |
| "Informe a data do diagnóstico" | Sem ela o número de diagnosticados não tem como ser auditado. |
| "As horas no programa não podem passar da carga horária" | A conta da dedicação exclusiva deixaria de fechar. |
| "Seu perfil não tem permissão para esta ação" | O ato é de outro cargo. Veja a tabela do item 2. |

---

## 7. O que o módulo **não** faz (ainda)

- Agenda com horário e sala.
- Evolução clínica das sessões de terapia (hoje registra frequência, não
  evolução).
- CIPTEA — a carteira de identificação da pessoa com TEA.
- Integração com a regulação estadual: a fila é a do município. Quem foi
  regulado para fora não aparece.
- Modo offline. Queda de energia ou de internet: a contingência é a **ficha
  impressa**.

---

## 8. Privacidade

Prontuário é dado de saúde — categoria especial na LGPD.

- Nada de prontuário aparece em relatório aberto, conferência pública de
  documento ou portal do cidadão.
- **Toda leitura de histórico clínico é registrada** com autor e hora.
- A coordenação do programa **não lê prontuário**, e o plantão do hospital
  **não vê** situação nem CID de quem está nos programas.
- Cada prefeitura só enxerga os seus dados.

---

## 9. Ordem sugerida para começar do zero

1. Administrador cria os **usuários** (com CRM/COREN para médico e enfermeiro).
2. Administrador cadastra a **unidade de saúde**.
3. Recepção começa a abrir **atendimentos**.
4. Administrador cria o **programa** e as **terapias**.
5. Coordenação **cadastra e inscreve** as pessoas, **indica** as terapias e
   marca o **início** de quem já é atendido.
6. Coordenação monta a **equipe** com carga horária, local e vínculo.
7. Terapeutas passam a registrar as **sessões**.
8. A partir daí o **relatório** responde sozinho — inclusive a requisições do
   Ministério Público.

> O passo 5 é o que costuma faltar. O sistema mede honestamente o que for
> registrado: se as indicações não forem lançadas, o relatório dirá que não há
> fila — e essa é a pior resposta possível a um promotor.
