-- 0041 — Categoria no item do contrato.
--
-- Um contrato atende mais de uma frente ao mesmo tempo: o mesmo fornecedor
-- entrega gêneros para a saúde e para a educação, com itens diferentes em cada
-- uma. Sem um recorte, a lista chega ao solicitante como uma parede de produtos
-- em ordem alfabética, e quem pede material da escola precisa varrer o que é do
-- posto de saúde para achar o dele.
--
-- **Texto livre, e não tabela.** A categoria é rótulo de organização, não
-- entidade: não tem ciclo de vida, ninguém a consulta sozinha e ela vale só
-- dentro do contrato onde foi escrita. Uma tabela cobraria uma tela de cadastro
-- e um passo a mais antes de montar o primeiro contrato, para devolver o que
-- um `VARCHAR` já dá. Se um dia a prefeitura quiser padronizar as categorias
-- entre contratos, o caminho é uma tabela de sugestões alimentada por este
-- campo — não o contrário.
--
-- **Opcional de propósito.** A maior parte dos contratos tem uma frente só, e
-- exigir categoria neles seria pedir que alguém escreva "Geral" mil vezes. Item
-- sem categoria aparece num bloco à parte, no fim.
--
-- Vazio vira nulo pelo caminho da aplicação: `''` e `NULL` são o mesmo "sem
-- categoria" para quem lê a tela, mas agrupariam em dois blocos distintos.

ALTER TABLE item ADD COLUMN categoria VARCHAR(60);

-- Só espaço em branco é o mesmo que nada, e passaria como categoria própria.
ALTER TABLE item ADD CONSTRAINT item_categoria_nao_vazia
  CHECK (categoria IS NULL OR length(btrim(categoria)) > 0);

-- Agrupar por categoria dentro do contrato é o caminho da tela de solicitação.
CREATE INDEX idx_item_categoria ON item(contrato_id, categoria);
