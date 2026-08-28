import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { MOTIVOS_DE_PERDA } from "../../../application/almoxarifado/ReceberEstoque";
import {
  FORMAS_DE_CONSUMO, MOTIVOS_DE_AJUSTE,
} from "../../../application/almoxarifado/MovimentarEstoque";
import { paginacaoSchema } from "../schemas/paginacao";

/**
 * Quem administra o estoque: define almoxarifados, tipos e entradas.
 * A unidade que só pede não passa por aqui.
 */
// Administrar o estoque é dar entrada, liberar e ajustar. A unidade que
// recebe o material não faz nada disso — ela pede e confirma.
const administraEstoque = exigirPermissao("stock:manage");

/** Quantidade em três casas, como a coluna `NUMERIC(14,3)`. */
const quantidade = z.number().positive().max(99_999_999).multipleOf(0.001);

const nomeSchema = z.object({ nome: z.string().min(1).max(150) });
const edicaoSchema = z.object({
  nome: z.string().min(1).max(150),
  ativo: z.boolean().default(true),
});

const configuracaoSchema = z.object({
  reservaAtiva: z.boolean(),
  reservaPrazoHoras: z.number().int().positive().max(8760),
  alertaValidadeDias: z.number().int().positive().max(3650),
});

const dadosDoLocalSchema = z.object({
  almoxarifadoId: z.string().uuid().nullable(),
  // Só dígitos: a máscara é da tela, o banco guarda o número.
  cnpj: z.string().regex(/^\d{14}$/).nullable().optional(),
  endereco: z.string().max(200).nullable().optional(),
  bairro: z.string().max(100).nullable().optional(),
  municipio: z.string().max(100).nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  cep: z.string().regex(/^\d{8}$/).nullable().optional(),
  telefone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(150).nullable().optional(),
  responsavel: z.string().max(150).nullable().optional(),
});

const entradaSchema = z.object({
  almoxarifadoId: z.string().uuid(),
  codigo: z.string().min(1).max(30),
  titulo: z.string().min(1).max(200),
  data: z.string().date(),
  tipoEstoqueId: z.string().uuid(),
  localArmazenado: z.string().max(150).optional(),
  notaFiscal: z.string().max(40).optional(),
  fornecedorId: z.string().uuid().optional(),
  linhas: z.array(z.object({
    nome: z.string().min(1).max(150),
    unidade: z.string().min(1).max(20),
    quantidade,
    dataValidade: z.string().date().nullable().optional(),
  })).min(1).max(2000),
});

const solicitacaoSchema = z.object({
  localSolicitanteId: z.string().uuid(),
  tipoEstoqueId: z.string().uuid().optional(),
  itens: z.array(z.object({
    produtoId: z.string().uuid(),
    quantidadeSolicitada: quantidade,
  })).min(1).max(200),
});

const itensSchema = z.object({
  itens: z.array(z.object({
    produtoId: z.string().uuid(),
    quantidadeSolicitada: quantidade,
  })).min(1).max(200),
});

const liberacaoSchema = z.object({
  retiradas: z.array(z.object({
    solicitacaoItemId: z.string().uuid(),
    loteId: z.string().uuid(),
    // Zero é aceito aqui e filtrado no caso de uso: a tela envia a linha
    // inteira, inclusive os lotes que o almoxarife zerou.
    quantidade: z.number().nonnegative().max(99_999_999).multipleOf(0.001),
  })).min(1).max(1000),
});

const recebimentoSchema = z.object({
  confirmacoes: z.array(z.object({
    liberacaoId: z.string().uuid(),
    quantidadeConfirmada: z.number().nonnegative().max(99_999_999).multipleOf(0.001),
    motivoPerda: z.enum(MOTIVOS_DE_PERDA).optional(),
    observacaoPerda: z.string().max(500).optional(),
  })).min(1).max(1000),
});

const recusaSchema = z.object({ motivo: z.string().min(3).max(500) });

const consumoSchema = z.object({
  localId: z.string().uuid(),
  produtoId: z.string().uuid(),
  quantidade,
  forma: z.enum(FORMAS_DE_CONSUMO),
  periodoInicio: z.string().date().optional(),
  periodoFim: z.string().date().optional(),
  observacao: z.string().max(500).optional(),
});

const devolucaoSchema = z.object({
  estoqueLocalId: z.string().uuid(),
  quantidade,
  motivo: z.string().min(3).max(500),
});

const respostaDevolucaoSchema = z.object({
  aceitar: z.boolean(),
  motivoRecusa: z.string().min(3).max(500).optional(),
});

const transferenciaSchema = z.object({
  loteId: z.string().uuid(),
  almoxarifadoDestinoId: z.string().uuid(),
  quantidade,
  motivo: z.string().max(500).optional(),
});

const ajusteSchema = z.object({
  loteId: z.string().uuid().optional(),
  estoqueLocalId: z.string().uuid().optional(),
  // Zero é válido: contagem pode achar que não sobrou nada.
  saldoCorrigido: z.number().nonnegative().max(99_999_999).multipleOf(0.001),
  motivo: z.enum(MOTIVOS_DE_AJUSTE),
  observacao: z.string().max(500).optional(),
});

export const almoxarifadoRouter = Router();

// Piso do módulo. A escola entra por aqui com `stock:read`; o que ela pode
// além disso está declarado rota a rota.
almoxarifadoRouter.use(exigirPermissao("stock:read"));

// ---------------------------------------------------------------------------
// Cadastros

almoxarifadoRouter.get("/almoxarifados", async (req, res, next) => {
  try {
    res.json(await container.gerenciarAlmoxarifado.listarAlmoxarifados(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/almoxarifados", administraEstoque, async (req, res, next) => {
  try {
    const { nome } = nomeSchema.parse(req.body);
    const id = await container.gerenciarAlmoxarifado.criarAlmoxarifado(req.sessao!.orgaoId, nome);
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

// Antes da paramétrica de edição não faz diferença aqui (métodos distintos),
// mas fica junto do resto do cadastro de almoxarifado.
almoxarifadoRouter.get("/almoxarifados/:id/lotes", async (req, res, next) => {
  try {
    res.json(await container.almoxarifado.listarLotesDoAlmoxarifado(
      req.sessao!.orgaoId, req.params.id!,
    ));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.put("/almoxarifados/:id", administraEstoque, async (req, res, next) => {
  try {
    await container.gerenciarAlmoxarifado.atualizarAlmoxarifado(
      req.sessao!.orgaoId, req.params.id!, edicaoSchema.parse(req.body),
    );
    res.json({ message: "Almoxarifado atualizado" });
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.delete("/almoxarifados/:id", administraEstoque, async (req, res, next) => {
  try {
    await container.gerenciarAlmoxarifado.removerAlmoxarifado(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Almoxarifado excluído" });
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.get("/tipos", async (req, res, next) => {
  try {
    res.json(await container.gerenciarAlmoxarifado.listarTipos(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/tipos", administraEstoque, async (req, res, next) => {
  try {
    const { nome } = nomeSchema.parse(req.body);
    res.status(201).json({
      id: await container.gerenciarAlmoxarifado.criarTipo(req.sessao!.orgaoId, nome),
    });
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.put("/tipos/:id", administraEstoque, async (req, res, next) => {
  try {
    await container.gerenciarAlmoxarifado.atualizarTipo(
      req.sessao!.orgaoId, req.params.id!, edicaoSchema.parse(req.body),
    );
    res.json({ message: "Tipo atualizado" });
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.delete("/tipos/:id", administraEstoque, async (req, res, next) => {
  try {
    await container.gerenciarAlmoxarifado.removerTipo(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Tipo excluído" });
  } catch (error) {
    next(error);
  }
});

/** Catálogo global — sem órgão na consulta, de propósito. */
almoxarifadoRouter.get("/produtos", async (req, res, next) => {
  try {
    const busca = typeof req.query.busca === "string" ? req.query.busca : undefined;
    res.json(await container.gerenciarAlmoxarifado.listarProdutos(busca));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.get("/configuracao", async (req, res, next) => {
  try {
    res.json(await container.gerenciarAlmoxarifado.buscarConfiguracao(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.put("/configuracao", exigirPermissao("stock:manage"), async (req, res, next) => {
  try {
    await container.gerenciarAlmoxarifado.salvarConfiguracao(
      req.sessao!.orgaoId, configuracaoSchema.parse(req.body),
    );
    res.json({ message: "Configuração salva" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Locais atendidos

almoxarifadoRouter.get("/locais", async (req, res, next) => {
  try {
    const almoxarifado = typeof req.query.almoxarifado === "string"
      ? req.query.almoxarifado : undefined;
    res.json(await container.gerenciarAlmoxarifado.listarLocais(
      req.sessao!.orgaoId, almoxarifado,
    ));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.put("/locais/:id", administraEstoque, async (req, res, next) => {
  try {
    await container.gerenciarAlmoxarifado.salvarDadosDoLocal(
      req.sessao!.orgaoId, req.params.id!, dadosDoLocalSchema.parse(req.body),
    );
    res.json({ message: "Local atualizado" });
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.get("/locais/:id/estoque", async (req, res, next) => {
  try {
    res.json(await container.gerenciarAlmoxarifado.listarEstoqueDoLocal(
      req.sessao!.orgaoId, req.params.id!,
    ));
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Entrada

almoxarifadoRouter.get("/remessas", async (req, res, next) => {
  try {
    const texto = (chave: string) =>
      typeof req.query[chave] === "string" ? (req.query[chave] as string) : undefined;

    res.json(await container.gerenciarAlmoxarifado.listarRemessas(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      almoxarifado: texto("almoxarifado"),
      tipo: texto("tipo"),
      busca: texto("busca"),
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/remessas", administraEstoque, async (req, res, next) => {
  try {
    const dados = entradaSchema.parse(req.body);
    res.status(201).json(await container.gerenciarAlmoxarifado.registrarEntrada({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.get("/remessas/:id", async (req, res, next) => {
  try {
    res.json(await container.gerenciarAlmoxarifado.buscarRemessa(
      req.sessao!.orgaoId, req.params.id!,
    ));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.delete("/lotes/:id", administraEstoque, async (req, res, next) => {
  try {
    await container.gerenciarAlmoxarifado.removerLote({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      loteId: req.params.id!,
    });
    res.json({ message: "Lote excluído" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Disponibilidade e solicitação

almoxarifadoRouter.get("/disponiveis/:almoxarifadoId", async (req, res, next) => {
  try {
    const tipo = typeof req.query.tipo === "string" ? req.query.tipo : undefined;
    res.json(await container.gerenciarAlmoxarifado.listarDisponiveis(
      req.sessao!.orgaoId, req.params.almoxarifadoId!, tipo,
    ));
  } catch (error) {
    next(error);
  }
});

// Literal antes da paramétrica: `/solicitacoes/nova` seria lido como
// `/solicitacoes/:id` se viesse depois.
almoxarifadoRouter.get("/solicitacoes", async (req, res, next) => {
  try {
    const texto = (chave: string) =>
      typeof req.query[chave] === "string" ? (req.query[chave] as string) : undefined;

    res.json(await container.gerenciarAlmoxarifado.listarSolicitacoes(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      status: texto("status"),
      local: texto("local"),
      almoxarifado: texto("almoxarifado"),
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/solicitacoes", async (req, res, next) => {
  try {
    const dados = solicitacaoSchema.parse(req.body);
    res.status(201).json(await container.solicitarEstoque.montarRascunho({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.get("/solicitacoes/:id", async (req, res, next) => {
  try {
    res.json(await container.gerenciarAlmoxarifado.buscarSolicitacao(
      req.sessao!.orgaoId, req.params.id!,
    ));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.put("/solicitacoes/:id/itens", async (req, res, next) => {
  try {
    await container.solicitarEstoque.atualizarItens({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      solicitacaoId: req.params.id!,
      itens: itensSchema.parse(req.body).itens,
    });
    res.json({ message: "Itens atualizados" });
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/solicitacoes/:id/enviar", async (req, res, next) => {
  try {
    res.json(await container.solicitarEstoque.enviar({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      solicitacaoId: req.params.id!,
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/solicitacoes/:id/cancelar", async (req, res, next) => {
  try {
    await container.solicitarEstoque.cancelar({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      solicitacaoId: req.params.id!,
    });
    res.json({ message: "Solicitação cancelada" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Liberação (almoxarifado) e recebimento (unidade)

almoxarifadoRouter.get("/solicitacoes/:id/liberacao", administraEstoque, async (req, res, next) => {
  try {
    res.json(await container.liberarEstoque.preparar({
      orgaoId: req.sessao!.orgaoId,
      solicitacaoId: req.params.id!,
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/solicitacoes/:id/liberar", administraEstoque, async (req, res, next) => {
  try {
    res.json(await container.liberarEstoque.liberar({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      solicitacaoId: req.params.id!,
      retiradas: liberacaoSchema.parse(req.body).retiradas,
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/solicitacoes/:id/recusar", administraEstoque, async (req, res, next) => {
  try {
    await container.liberarEstoque.recusar({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      solicitacaoId: req.params.id!,
      motivo: recusaSchema.parse(req.body).motivo,
    });
    res.json({ message: "Solicitação recusada" });
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.get("/solicitacoes/:id/recebimento", async (req, res, next) => {
  try {
    res.json(await container.receberEstoque.preparar({
      orgaoId: req.sessao!.orgaoId,
      solicitacaoId: req.params.id!,
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/solicitacoes/:id/receber", async (req, res, next) => {
  try {
    res.json(await container.receberEstoque.confirmar({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      solicitacaoId: req.params.id!,
      confirmacoes: recebimentoSchema.parse(req.body).confirmacoes,
    }));
  } catch (error) {
    next(error);
  }
});


// ---------------------------------------------------------------------------
// Movimento: consumo, devolução, transferência e ajuste

const filtro = (req: { query: Record<string, unknown> }, chave: string) =>
  typeof req.query[chave] === "string" ? (req.query[chave] as string) : undefined;

almoxarifadoRouter.get("/consumo", async (req, res, next) => {
  try {
    res.json(await container.almoxarifado.listarConsumo(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      local: filtro(req, "local"),
      produto: filtro(req, "produto"),
      de: filtro(req, "de"),
      ate: filtro(req, "ate"),
    }));
  } catch (error) {
    next(error);
  }
});

// Consumo é da unidade: exigir papel de almoxarife travaria a escola.
almoxarifadoRouter.post("/consumo", async (req, res, next) => {
  try {
    const dados = consumoSchema.parse(req.body);
    res.status(201).json(await container.movimentarEstoque.consumir({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.get("/devolucoes", async (req, res, next) => {
  try {
    res.json(await container.almoxarifado.listarDevolucoes(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      status: filtro(req, "status"),
      almoxarifado: filtro(req, "almoxarifado"),
      local: filtro(req, "local"),
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post("/devolucoes", async (req, res, next) => {
  try {
    const dados = devolucaoSchema.parse(req.body);
    res.status(201).json(await container.movimentarEstoque.pedirDevolucao({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
    }));
  } catch (error) {
    next(error);
  }
});

// Quem aceita a volta do material é o almoxarifado, não a unidade.
almoxarifadoRouter.post(
  "/devolucoes/:id/responder",
  administraEstoque,
  async (req, res, next) => {
    try {
      const dados = respostaDevolucaoSchema.parse(req.body);
      await container.movimentarEstoque.responderDevolucao({
        ...dados,
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
        devolucaoId: req.params.id!,
      });
      res.json({ message: dados.aceitar ? "Devolução aceita" : "Devolução recusada" });
    } catch (error) {
      next(error);
    }
  },
);

almoxarifadoRouter.get("/transferencias", async (req, res, next) => {
  try {
    res.json(await container.almoxarifado.listarTransferencias(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      almoxarifado: filtro(req, "almoxarifado"),
    }));
  } catch (error) {
    next(error);
  }
});

almoxarifadoRouter.post(
  "/transferencias",
  administraEstoque,
  async (req, res, next) => {
    try {
      const dados = transferenciaSchema.parse(req.body);
      res.status(201).json(await container.movimentarEstoque.transferir({
        ...dados,
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
      }));
    } catch (error) {
      next(error);
    }
  },
);

almoxarifadoRouter.get("/ajustes", async (req, res, next) => {
  try {
    res.json(await container.almoxarifado.listarAjustes(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      almoxarifado: filtro(req, "almoxarifado"),
      local: filtro(req, "local"),
    }));
  } catch (error) {
    next(error);
  }
});

// Ajuste vale nos dois lados — a escola corrige o armário dela, o almoxarife
// corrige o depósito. O caso de uso decide qual pelo campo informado.
almoxarifadoRouter.post("/ajustes", async (req, res, next) => {
  try {
    const dados = ajusteSchema.parse(req.body);
    res.status(201).json(await container.movimentarEstoque.ajustar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
    }));
  } catch (error) {
    next(error);
  }
});
