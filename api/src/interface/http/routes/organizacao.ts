import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";
import { garantirExiste, garantirSemVinculos } from "../../../application/shared/ExclusaoSegura";
import {
  criarDepartamentoSchema, criarSetorSchema, criarUnidadeSchema,
  editarDepartamentoSchema, editarSetorSchema, editarUnidadeSchema,
} from "../schemas/cadastros";

export const unidadesRouter = Router();
export const setoresRouter = Router();

const podeEditar = exigirPapel("ADMIN", "GESTOR");

unidadesRouter.post("/", podeEditar, async (req, res, next) => {
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

unidadesRouter.patch("/:id", podeEditar, async (req, res, next) => {
  try {
    const orgaoId = req.sessao!.orgaoId;
    garantirExiste(await container.organizacao.buscar(orgaoId, req.params.id!), "Unidade");
    const dados = editarUnidadeSchema.parse(req.body);
    await container.organizacao.atualizar(orgaoId, req.params.id!, dados);
    res.json({ message: "Unidade atualizada" });
  } catch (error) {
    next(error);
  }
});

unidadesRouter.delete("/:id", podeEditar, async (req, res, next) => {
  try {
    const orgaoId = req.sessao!.orgaoId;
    garantirExiste(await container.organizacao.buscar(orgaoId, req.params.id!), "Unidade");
    garantirSemVinculos(
      await container.organizacao.contarVinculos(orgaoId, req.params.id!),
      "Unidade",
    );
    await container.organizacao.remover(orgaoId, req.params.id!);
    res.json({ message: "Unidade excluída" });
  } catch (error) {
    next(error);
  }
});

setoresRouter.post("/", podeEditar, async (req, res, next) => {
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

setoresRouter.patch("/:id", podeEditar, async (req, res, next) => {
  try {
    const orgaoId = req.sessao!.orgaoId;
    garantirExiste(await container.organizacao.buscarSetor(orgaoId, req.params.id!), "Setor");
    const dados = editarSetorSchema.parse(req.body);
    await container.organizacao.atualizarSetor(orgaoId, req.params.id!, dados);
    res.json({ message: "Setor atualizado" });
  } catch (error) {
    next(error);
  }
});

setoresRouter.delete("/:id", podeEditar, async (req, res, next) => {
  try {
    const orgaoId = req.sessao!.orgaoId;
    garantirExiste(await container.organizacao.buscarSetor(orgaoId, req.params.id!), "Setor");
    garantirSemVinculos(
      await container.organizacao.contarVinculosSetor(orgaoId, req.params.id!),
      "Setor",
    );
    await container.organizacao.removerSetor(orgaoId, req.params.id!);
    res.json({ message: "Setor excluído" });
  } catch (error) {
    next(error);
  }
});

const setorDoOrgao = async (setorId: string, orgaoId: string): Promise<void> => {
  const pertence = await container.organizacao.pertenceAoOrgao(setorId, orgaoId);
  garantirExiste(pertence ? setorId : null, "Setor");
};

setoresRouter.post("/:id/departamentos", podeEditar, async (req, res, next) => {
  try {
    await setorDoOrgao(req.params.id!, req.sessao!.orgaoId);
    const dados = criarDepartamentoSchema.parse(req.body);
    const id = await container.organizacao.criarDepartamento({ ...dados, setorId: req.params.id! });
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

setoresRouter.get("/:id/departamentos", async (req, res, next) => {
  try {
    await setorDoOrgao(req.params.id!, req.sessao!.orgaoId);
    res.json(await container.organizacao.listarDepartamentos(req.params.id!));
  } catch (error) {
    next(error);
  }
});

setoresRouter.patch("/:id/departamentos/:departamentoId", podeEditar, async (req, res, next) => {
  try {
    await setorDoOrgao(req.params.id!, req.sessao!.orgaoId);
    const dados = editarDepartamentoSchema.parse(req.body);
    await container.organizacao.atualizarDepartamento(
      req.params.id!, req.params.departamentoId!, dados,
    );
    res.json({ message: "Departamento atualizado" });
  } catch (error) {
    next(error);
  }
});

setoresRouter.delete("/:id/departamentos/:departamentoId", podeEditar, async (req, res, next) => {
  try {
    await setorDoOrgao(req.params.id!, req.sessao!.orgaoId);
    garantirSemVinculos(
      await container.organizacao.contarVinculosDepartamento(req.params.departamentoId!),
      "Departamento",
    );
    await container.organizacao.removerDepartamento(req.params.id!, req.params.departamentoId!);
    res.json({ message: "Departamento excluído" });
  } catch (error) {
    next(error);
  }
});
