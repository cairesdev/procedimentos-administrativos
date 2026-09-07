# Integração com os cadastros do Ministério da Saúde

Levantamento técnico feito em 07/09/2026, com as chamadas reproduzidas de
verdade contra os serviços públicos. O que está marcado como **verificado** foi
chamado e devolveu resposta; o que está marcado como **a confirmar** vem da
especificação oficial e ainda não respondeu aos meus testes.

Existem **três** portas para o mesmo cadastro, e elas não entregam a mesma
coisa. A confusão comum é achar que a API REST de dados abertos cobre tudo —
ela não traz profissional nenhum.

---

## 1. API REST de Dados Abertos (DEMAS) — **verificado**

`https://apidadosabertos.saude.gov.br`

Sem autenticação, sem cadastro, JSON, resposta imediata. É a porta mais simples
e a que vamos usar para o estabelecimento.

| Endpoint | Serve para |
|---|---|
| `GET /cnes/estabelecimentos` | Lista, filtrando por `codigo_municipio`, `codigo_uf`, `codigo_tipo_unidade`, `status`, `data_atualizacao`, com `limit`/`offset` |
| `GET /cnes/estabelecimentos/{codigo_cnes}` | Um estabelecimento, por código CNES |
| `GET /cnes/tipounidades` e `/{codigo}` | O dicionário de tipos (5 = HOSPITAL GERAL, 2 = UBS, …) |
| `GET /macrorregiao-e-regiao-de-saude/municipio?municipio=` | Descobre o código IBGE de 6 dígitos a partir do nome |

**Limites que importam:** não existe busca por nome de estabelecimento, nem
filtro por CNPJ, nem qualquer endpoint de profissional. O catálogo inteiro da
API tem ~90 rotas (SISAGUA, SIVEP, vacinação, arboviroses…) e apenas quatro
delas são de CNES.

### O que isso já respondeu sobre o cliente

Consulta real, feita hoje:

- **Bela Vista do Maranhão = município 210177**, região de saúde SANTA INÊS,
  macrorregião NORTE, população estimada IBGE 2022: 11.750.
- O município tem **15 estabelecimentos** no CNES — 9 UBS/postos, a SEMUS, a
  vigilância em saúde, a academia da saúde, a unidade odontológica móvel e o
  hospital.
- **O hospital é o CNES 7572883 — "HOSPITAL MUNICIPAL ANTONIO MORAES DA
  SILVA"**, tipo de unidade **5 (HOSPITAL GERAL)**, turno "atendimento contínuo
  de 24 horas/dia (plantão, inclui sábados, domingos e feriados)", com centro
  cirúrgico, centro obstétrico, centro neonatal, atendimento hospitalar e
  atendimento ambulatorial SUS. Rua Nossa Senhora da Conceição, s/n, Centro.

Três consequências diretas para o módulo:

1. **O nome no CNES é "MORAES", a ficha em papel escreve "MORAIS".** Uma das
   duas está errada e não somos nós que decidimos qual — o nome oficial é o do
   CNES, e a divergência vai aparecer na primeira validação.
2. **O CNPJ não bate.** O CNES registra a entidade sob 01.612.347/0001-58
   (Prefeitura Municipal); o cabeçalho da ficha traz 11.629.135/0001-37, que é
   provavelmente o Fundo Municipal de Saúde. O timbre do documento precisa
   dizer qual dos dois, e isso é pergunta para o cliente.
3. **Não é "serviço de primeiro atendimento": é hospital geral com centro
   cirúrgico e obstétrico.** A ficha em papel cobre a porta de entrada; o
   estabelecimento faz internação. Isso confirma que o horizonte de leitos e
   observação (fatia 2) é real, e **descarta o e-SUS APS como destino de
   produção** — o caminho seria SIA/SIH, não a APS.

---

## 2. Barramento SOA do CNES (SOAP) — onde estão os profissionais — **a confirmar**

`https://servicos.saude.gov.br/cnes/<Serviço>/v1r0?wsdl`
(homologação: `https://servicoshm.saude.gov.br/…`)

Acesso declarado livre pela wiki do CNES. A autenticação é WS-Security
`UsernameToken` com **credencial pública, impressa na própria especificação
oficial**: usuário `CNES.PUBLICO`, senha `cnes#2015public`. Não é segredo e não
é nosso — é a credencial que o DATASUS publica para consumo aberto.

| Serviço | Operação | O que devolve |
|---|---|---|
| `EstabelecimentoSaudeService` | `consultarEstabelecimentoSaude` | O mesmo da REST, com mais detalhe |
| `ProfissionalSaudeService` | `consultarProfissionaisSaude` | **A lista de profissionais de um estabelecimento**, pedindo só o código CNES |
| | `consultarProfissionalSaude` | Um profissional |
| `VinculacaoProfissionalService` | `pesquisarVinculacaoProfissionalSaude` | Vínculos, paginado |
| | `detalharVinculacaoProfissionalSaude` | Por CPF **ou** CNS + CNES: nome, CNS, **CBO com descrição**, carga horária ambulatorial/hospitalar, modalidade e vigência do vínculo |
| `LeitoService` | `consultarLeitosCnes` | Leitos do estabelecimento — insumo da fatia 2 |
| `EquipamentoService` | `consultarEquipamentos` | Equipamentos |

`detalharVinculacaoProfissionalSaude` é exatamente a pergunta que o cadastro de
usuário precisa fazer: *"este CPF é mesmo profissional de saúde vinculado ao
CNES 7572883, e em qual ocupação?"*

**Ressalva honesta:** a especificação é de 2019 e meus dois testes contra o
WSDL de produção e o de homologação voltaram vazios. Pode ser o meu cliente
HTTP, pode ser o serviço fora do ar. **Isso precisa ser confirmado com uma
chamada SOAP de verdade a partir da VPS antes de virar decisão de projeto.**

---

## 3. Base completa mensal (arquivo) — **verificado**

`https://cnes.datasus.gov.br/EstatisticasServlet?path=BASE_DE_DADOS_CNES_AAAAMM.ZIP`

A competência mais recente publicada hoje é **202607** — cerca de dois meses de
defasagem. Contém as tabelas do CNES em CSV (`;`, latin-1), incluindo dados de
profissional e carga horária. Serve para carga inicial e para plano B; não
serve para validar um cadastro na hora.

---

## O que **não** existe aberto

- **Número de conselho (CRM/COREN).** O CNES identifica ocupação por **CBO**,
  não por registro de conselho. Não há API pública do CFM nem do COFEN — as
  consultas existem só como portal web. **Consequência para o módulo: o
  CRM/COREN continua digitado à mão.** O que o CNES prova é outra coisa, e mais
  útil no dia a dia: que aquela pessoa está vinculada àquele hospital, naquela
  ocupação.
- **CNS do cidadão (CADSUS).** Tem barramento próprio, mas exige cadastro de
  cessionário, termo de uso e autorização do DATASUS. Não é aberto. Portanto
  **o CNS do paciente é digitado e conferido só pelo dígito verificador**, sem
  consulta à base nacional.

---

## Decorrências para o módulo

1. **Cadastro da unidade de saúde usa a API REST.** O administrador escolhe o
   município, o sistema lista os estabelecimentos e ele marca o do hospital;
   gravamos código CNES, tipo de unidade, nome oficial e endereço. Sem
   autenticação, sem contrato com ninguém, funciona hoje.
2. **Validação de profissional fica atrás de uma confirmação.** Se o SOAP
   responder da VPS, o cadastro de usuário clínico oferece a lista de
   profissionais do CNES do hospital e grava o CBO. Se não responder, tudo é
   digitado e o ZIP mensal vira a carga de conferência.
3. **Nada disso no caminho crítico.** Toda consulta externa é guardada com a
   data em que foi feita e pode falhar sem impedir atendimento. Um hospital de
   plantão 24h não pode depender de a rede do Ministério estar de pé.
4. **Divergência de nome e de CNPJ é pergunta para o cliente**, não escolha
   nossa.

## Fontes

- <https://apidadosabertos.saude.gov.br/v1/> — catálogo e OpenAPI da API de dados abertos (DEMAS)
- <https://datasus.saude.gov.br/interoperabilidade-catalogo-de-servicos/> — catálogo dos barramentos SOA (CNS, CNES, SIGTAP)
- Especificação Técnica para Integração com o CNES (PDF do DATASUS, 2019) — operações, WSDLs e credencial pública
- <https://wiki.saude.gov.br/cnes/> — wiki do CNES: acesso ao webservice e download da base
- <https://cnes.datasus.gov.br/pages/downloads/arquivosBaseDados.jsp> — base mensal completa
