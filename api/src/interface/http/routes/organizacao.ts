import { Router } from "express";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";
import { criarDepartamentoSchema, criarSetorSchema, criarUnidadeSchema } from "../schemas/cadastros";

export const unidadesRouter = Router();
export const setoresRouter = Router();

unidadesRouter.post("/", exigirPapel("ADMIN", "GESTOR"), async (req, res, next) => {
  try {
    const dados = criarUnidadeSchema.parse(req.body);
    const id = await container.organizacao.criar({ ...dados, orgaoId: req.sessao!.orgaoId });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

unidadesRouter.get("/", async (req, res, next) => {
  try {
    res.json(await container.organizacao.listar(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

setoresRouter.post("/", exigirPapel("ADMIN", "GESTOR"), async (req, res, next) => {
  try {
    const dados = criarSetorSchema.parse(req.body);
    const id = await container.organizacao.criarSetor({ ...dados, orgaoId: req.sessao!.orgaoId });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

setoresRouter.get("/", async (req, res, next) => {
  try {
    res.json(await container.organizacao.listarSetores(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

setoresRouter.post("/:id/departamentos", exigirPapel("ADMIN", "GESTOR"), async (req, res, next) => {
  try {
    const pertence = await container.organizacao.pertenceAoOrgao(req.params.id!, req.sessao!.orgaoId);
    if (!pertence) {
      res.status(404).json({ message: "Setor não encontrado" });
      return;
    }
    const dados = criarDepartamentoSchema.parse(req.body);
    const id = await container.organizacao.criarDepartamento({ ...dados, setorId: req.params.id! });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

setoresRouter.get("/:id/departamentos", async (req, res, next) => {
  try {
    const pertence = await container.organizacao.pertenceAoOrgao(req.params.id!, req.sessao!.orgaoId);
    if (!pertence) {
      res.status(404).json({ message: "Setor não encontrado" });
      return;
    }
    res.json(await container.organizacao.listarDepartamentos(req.params.id!));
  } catch (error) {
    next(error);
  }
});
