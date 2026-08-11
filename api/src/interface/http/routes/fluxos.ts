import { Router } from "express";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";
import { salvarFluxoSchema } from "../schemas/cadastros";

export const fluxosRouter = Router();

fluxosRouter.put("/:tipoProcesso", exigirPapel("ADMIN"), async (req, res, next) => {
  try {
    const dados = salvarFluxoSchema.parse(req.body);
    await container.fluxoConfiguracao.salvar({
      orgaoId: req.sessao!.orgaoId,
      tipoProcesso: req.params.tipoProcesso!,
      permiteOverrideUsuario: dados.permiteOverrideUsuario,
      etapas: dados.etapas,
    });
    res.json({ message: "Fluxo configurado" });
  } catch (error) {
    next(error);
  }
});

fluxosRouter.get("/:tipoProcesso", async (req, res, next) => {
  try {
    const config = await container.fluxoConfiguracao.buscar(
      req.sessao!.orgaoId,
      req.params.tipoProcesso!,
    );
    if (!config) {
      res.status(404).json({ message: "Fluxo não configurado para este tipo de processo" });
      return;
    }
    res.json(config);
  } catch (error) {
    next(error);
  }
});
