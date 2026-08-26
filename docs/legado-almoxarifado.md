# Almoxarifado — leitura do sistema legado

Análise do `controle-estoque` (API Express 5 + Postgres + Redis) e do
`cliente-controle-de-estoques` (Next 15), confrontada com o levantamento já
consolidado em `decisoes.md` e `uml-almoxarifado.mermaid`.

O módulo veicular do legado foi ignorado por decisão do usuário: Frotas já está
pronto aqui e é mais completo que o de lá.

## O que o legado realmente faz

O ciclo tem quatro atores e é mais simples do que os nomes das tabelas sugerem.

```
remessa do órgão          solicitação da unidade        liberação           consumo
(armazem_orgao)     →     (solicitacao +          →   (estoque_unidade +  →  (movimentacao_
  ↳ lotes                  produto_solicitado)         movimentacao_          estoque)
    (produto_estocado)                                 armazem)
```

| Tabela do legado | O que é de fato |
| --- | --- |
| `armazem_orgao` | **Remessa** de entrada no órgão — não é um armazém. Tem código, data, local estocado, responsável e tipo de estoque |
| `produto_estocado` | **Lote**: quantidade, saldo e validade, apontando para uma origem |
| `estoque_unidade` | O "pacote" que a unidade recebeu — um por solicitação liberada |
| `movimentacao_armazem` | O trânsito remessa → unidade, com lote de origem e lote de destino |
| `movimentacao_estoque` | Consumo e exclusão de um lote |
| `produto` | Catálogo **global**, único por `(nome, und_medida)` |
| `modulos_liberados` | Contratação por prefeitura: escolar, saúde, assistência social, combustível |

**`produto_estocado.id_estoque_origem` é polimórfico e sem chave estrangeira.**
Aponta ora para `armazem_orgao`, ora para `estoque_unidade`, e quem desambigua
é o `JOIN` de cada consulta. É o que faz o mesmo lote servir ao almoxarifado e à
unidade — e é também o motivo de o banco não conseguir garantir nada sobre ele.

**A tabela `almoxarifado` existe e não é usada.** Nenhuma remessa aponta para
ela; `armazem_orgao` vai direto ao órgão. O vínculo do usuário é
`usuario.tipo_almoxarifado`, que aponta para **`tipo_unidade`** — quer dizer, na
prática o legado agrupa por *tipo de unidade* (escola, posto), não por
almoxarifado.

**A reserva vive no Redis**, em `reservas:{unidade}:{produto}`, com TTL de 48
horas fixas, incrementada quando o item entra na solicitação.

**Comprovante** é um código aleatório de 7 a 12 dígitos gravado em
`estoque_unidade.codigo`, com QR apontando para `codigo:entidade:{id}` e página
de autenticação própria.

## Sete problemas que não devemos herdar

Estão listados porque cada um vira uma decisão de modelagem nossa, não como
crítica ao trabalho de quem fez.

**1. A reserva nunca é baixada na liberação.** `addItem` incrementa a chave do
Redis; `liberar` decrementa o saldo do lote no banco e **não toca no Redis**. O
mesmo material fica reservado e baixado ao mesmo tempo, e a lista da unidade
mostra menos do que existe até o TTL de 48h vencer.

**2. A reserva é por unidade; a disponibilidade é do órgão.** `verificaDisponivel`
soma o estoque de toda a prefeitura, mas a chave de reserva é por unidade. Duas
unidades pedindo o mesmo produto não enxergam a reserva uma da outra — as duas
passam na validação e a segunda descobre a falta na hora da liberação.

**3. Nada é transacional.** `liberar` faz, sem `BEGIN`, um insert de estoque da
unidade, N inserts de lote, N inserts de movimentação, N updates de saldo e um
update de status. Uma falha no meio deixa saldo debitado sem lote de destino, ou
lote de destino sem débito.

**4. Quantidade é `integer`.** Alimentação escolar trabalha em quilo e litro:
2,5 kg de arroz não é representável. Isso não é detalhe de formatação — é o dado.

**5. `estoque_unidade.qnt_entrada` conta linhas, não itens.** A liberação grava
`data.RETIRADAS.length`, ou seja, quantos lotes foram usados. O campo se chama
quantidade e não é quantidade; a exclusão de item subtrai 1. Importa se formos
migrar dados.

**6. Consumo pode deixar saldo negativo.** `consumirItem` faz
`qnt_disponivel = qnt_disponivel - $1` sem conferir se há saldo.

**7. FEFO inconsistente.** A liberação ordena por validade crescente (correto),
mas `verificaDisponivel` e a lista da unidade ordenam decrescente — mostram
primeiro o que vence por último.

Há ainda dois endpoints de exclusão em massa (`/estoque/orgao/:id/all` e
`/estoque/unidade/:id/all`) que apagam tudo por soft delete sem confirmação.

## O que o legado tem e o nosso levantamento não previu

**Validade do lote na unidade.** O legado copia `data_validade` para o lote que
nasce na unidade, então a escola sabe o que vence primeiro no armário dela.
Nosso `ESTOQUE_LOCAL` guarda só saldo agregado por produto — **perde a validade
depois da entrega**, que é justamente o dado que importa para alimentação
escolar. Lacuna real do nosso modelo.

**Registro de qualidade por lote** (`qualidade_produto_estocado` +
`tipo_qualidade`): alguém classifica a qualidade do que chegou. Não existe no
nosso levantamento.

**Rastro lote a lote.** `movimentacao_armazem` guarda `id_produto_origem` e
`id_produto_destino` — dá para responder "este saco de arroz na escola veio de
qual remessa". Nosso `LIBERACAO_LOTE` guarda a origem, mas não o lote gerado no
destino.

**Produto como catálogo global entre prefeituras**, no mesmo espírito do nosso
`fornecedor`. Nosso UML colocou `orgao_id` no produto.

## O que temos e o legado não tem

Devolução com aceite, transferência entre almoxarifados, ajuste de estoque com
motivo, declaração periódica de consumo, N almoxarifados por prefeitura, tipos
de estoque por prefeitura e relatórios de consumo para o PNAE.

E o comprovante: o motor de `documento_emitido` já resolve com código
verificador único no produto, conferência pública em `/conferencia/{codigo}`,
retrato do conteúdo e cancelamento sem apagar. O legado gera número aleatório
sem unicidade garantida.

## Divergências que precisam de decisão

| Ponto | Legado | Nosso levantamento |
| --- | --- | --- |
| Almoxarifado | Tabela existe, não é usada; remessa vai direto ao órgão | N por prefeitura, com locais vinculados |
| Tipo de estoque | Global, `integer`, igual para todas as prefeituras | Personalizável por prefeitura |
| Recorte por secretaria | `modulos_liberados`: escolar, saúde, assistência | Não previsto — seria tipo de estoque? |
| Produto | Catálogo global entre prefeituras | `orgao_id` no produto |
| Quantidade | `integer` | `decimal` |
| Validade na unidade | Preservada por lote | Só saldo agregado, sem validade |
| Reserva | Redis, TTL fixo de 48h, não baixada | Banco, expiração configurável |
| Vínculo do solicitante | `usuario.tipo_almoxarifado` → tipo de unidade | Nutricionista pelas unidades do almoxarifado |
