import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";
import { MOTIVOS_DE_BAIXA } from "../../../application/ports/PatrimonioRepository";
import { paginacaoSchema } from "../schemas/paginacao";

const localSchema = z.object({
  codigo: z.string().regex(/^\d{1,10}$/, "Use apenas números, ex.: 001"),
  nome: z.string().min(1).max(150),
  unidadeId: z.string().uuid().optional(),
});

const edicaoLocalSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  unidadeId: z.string().uuid().nullable().optional(),
  ativo: z.boolean().optional(),
});

const categoriaSchema = z.object({ nome: z.string().min(1).max(100) });
const edicaoCategoriaSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  ativo: z.boolean().optional(),
});

const remessaSchema = z.object({
  data: z.string().date(),
  fornecedorId: z.string().uuid().optional(),
  notaFiscal: z.string().max(40).optional(),
  contratoId: z.string().uuid().optional(),
  lotes: z
    .array(
      z.object({
        categoriaId: z.string().uuid(),
        localDestinoId: z.string().uuid(),
        nomeBem: z.string().min(1).max(150),
        quantidade: z.number().int().positive(),
      }),
    )
    .min(1),
});

// Lotes não entram: os bens já foram tombados, só a nota admite correção.
const edicaoRemessaSchema = z.object({
  data: z.string().date().optional(),
  fornecedorId: z.string().uuid().nullable().optional(),
  notaFiscal: z.string().max(40).nullable().optional(),
});

const edicaoBemSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  categoriaId: z.string().uuid().optional(),
});

const transferenciaSchema = z.object({ localDestinoId: z.string().uuid() });

const baixaSchema = z.object({
  motivo: z.enum(MOTIVOS_DE_BAIXA),
  observacao: z.string().max(4000).optional(),
});

const inventarioSchema = z.object({
  localId: z.string().uuid(),
  dataInicio: z.string().date(),
});

const conferenciaSchema = z.object({
  itens: z
    .array(
      z.object({
        bemId: z.string().uuid(),
        situacao: z.enum(["ENCONTRADO", "NAO_ENCONTRADO"]),
        estadoObservado: z.enum(["NOVO", "BOM", "DANIFICADO", "EM_CONSERTO"]).optional(),
        observacao: z.string().max(2000).optional(),
      }),
    )
    .min(1),
});

const podeEscrever = exigirPapel("ADMIN", "GESTOR", "PATRIMONIO");

export const patrimonioRouter = Router();

patrimonioRouter.get("/locais", async (req, res, next) => {
  try {
    res.json(await container.patrimonio.listarLocais(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/locais", podeEscrever, async (req, res, next) => {
  try {
    const dados = localSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarPatrimonio.criarLocal({ ...dados, orgaoId: req.sessao!.orgaoId }),
    );
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.patch("/locais/:id", podeEscrever, async (req, res, next) => {
  try {
    const dados = edicaoLocalSchema.parse(req.body);
    await container.gerenciarPatrimonio.atualizarLocal(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Local atualizado" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.delete("/locais/:id", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarPatrimonio.removerLocal(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Local excluído" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.get("/categorias", async (req, res, next) => {
  try {
    res.json(await container.patrimonio.listarCategorias(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/categorias", podeEscrever, async (req, res, next) => {
  try {
    const dados = categoriaSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarPatrimonio.criarCategoria({ ...dados, orgaoId: req.sessao!.orgaoId }),
    );
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.patch("/categorias/:id", podeEscrever, async (req, res, next) => {
  try {
    const dados = edicaoCategoriaSchema.parse(req.body);
    await container.gerenciarPatrimonio.atualizarCategoria(
      req.sessao!.orgaoId, req.params.id!, dados,
    );
    res.json({ message: "Categoria atualizada" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.delete("/categorias/:id", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarPatrimonio.removerCategoria(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Categoria excluída" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.get("/bens", async (req, res, next) => {
  try {
    res.json(
      await container.patrimonio.listarBens(
        req.sessao!.orgaoId,
        {
          localId: typeof req.query.local === "string" ? req.query.local : undefined,
          status: typeof req.query.status === "string" ? req.query.status : undefined,
        },
        paginacaoSchema.parse(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.get("/remessas", async (req, res, next) => {
  try {
    res.json(await container.patrimonio.listarRemessas(req.sessao!.orgaoId, paginacaoSchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/remessas", podeEscrever, async (req, res, next) => {
  try {
    const dados = remessaSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarPatrimonio.registrarRemessa({
        ...dados,
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
      }),
    );
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.patch("/remessas/:id", podeEscrever, async (req, res, next) => {
  try {
    const dados = edicaoRemessaSchema.parse(req.body);
    await container.gerenciarPatrimonio.atualizarRemessa(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Entrada atualizada" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.delete("/remessas/:id", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarPatrimonio.removerRemessa(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
    );
    res.json({ message: "Entrada excluída" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.patch("/bens/:id", podeEscrever, async (req, res, next) => {
  try {
    const dados = edicaoBemSchema.parse(req.body);
    await container.gerenciarPatrimonio.atualizarBem(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Bem atualizado" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.delete("/bens/:id", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarPatrimonio.removerBem(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
    );
    res.json({ message: "Bem excluído" });
  } catch (error) {
    next(error);
  }
});

// ---- Transferência e baixa -------------------------------------------------

patrimonioRouter.get("/transferencias", async (req, res, next) => {
  try {
    res.json(
      await container.patrimonio.listarTransferencias(
        req.sessao!.orgaoId,
        {
          status: typeof req.query.status === "string" ? req.query.status : undefined,
          localId: typeof req.query.local === "string" ? req.query.local : undefined,
        },
        paginacaoSchema.parse(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/bens/:id/transferir", podeEscrever, async (req, res, next) => {
  try {
    const { localDestinoId } = transferenciaSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarPatrimonio.transferirBem(
        req.sessao!.orgaoId, req.params.id!, localDestinoId, req.sessao!.usuarioId,
      ),
    );
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/transferencias/:id/aceitar", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarPatrimonio.aceitarTransferencia(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
    );
    res.json({ message: "Transferência aceita" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/transferencias/:id/recusar", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarPatrimonio.recusarTransferencia(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
    );
    res.json({ message: "Transferência recusada" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.get("/baixas", async (req, res, next) => {
  try {
    res.json(await container.patrimonio.listarBaixas(req.sessao!.orgaoId, paginacaoSchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/bens/:id/baixa", podeEscrever, async (req, res, next) => {
  try {
    const dados = baixaSchema.parse(req.body);
    await container.gerenciarPatrimonio.darBaixa(
      req.sessao!.orgaoId, req.params.id!, dados, req.sessao!.usuarioId,
    );
    res.status(201).json({ message: "Baixa registrada" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.get("/inventarios", async (req, res, next) => {
  try {
    res.json(await container.patrimonio.listarInventarios(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/inventarios", podeEscrever, async (req, res, next) => {
  try {
    const { localId, dataInicio } = inventarioSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarPatrimonio.abrirInventario(req.sessao!.orgaoId, localId, dataInicio),
    );
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.get("/inventarios/:id", async (req, res, next) => {
  try {
    const orgaoId = req.sessao!.orgaoId;
    const [inventario, itens] = await Promise.all([
      container.patrimonio.buscarInventario(orgaoId, req.params.id!),
      container.patrimonio.itensDoInventario(orgaoId, req.params.id!),
    ]);
    if (!inventario) {
      res.status(404).json({ message: "Inventário não encontrado" });
      return;
    }
    res.json({ ...inventario, itens });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/inventarios/:id/conferencias", podeEscrever, async (req, res, next) => {
  try {
    const { itens } = conferenciaSchema.parse(req.body);
    await container.gerenciarPatrimonio.conferir(req.sessao!.orgaoId, req.params.id!, itens);
    res.json({ message: "Conferência registrada" });
  } catch (error) {
    next(error);
  }
});

patrimonioRouter.post("/inventarios/:id/concluir", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarPatrimonio.concluirInventario(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
    );
    res.json({ message: "Inventário concluído" });
  } catch (error) {
    next(error);
  }
});
