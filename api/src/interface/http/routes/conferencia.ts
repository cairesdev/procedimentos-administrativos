import { Router } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { container } from "../../../container";
import { normalizarCodigo } from "../../../domain/documento/CodigoVerificador";
import { ipDoCliente } from "../middlewares/rateLimit";

/**
 * Conferência pública de documento — a única rota sem token do sistema.
 *
 * O limite é próprio e mais apertado que o geral: sem ele, o código
 * verificador poderia ser varrido por tentativa e erro, e essa rota é a única
 * porta para conteúdo de qualquer prefeitura.
 */
const limiteDeConferencia = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(ipDoCliente(req)),
  message: { message: "Muitas consultas em pouco tempo. Aguarde um minuto." },
});

export const conferenciaRouter = Router();

conferenciaRouter.get("/:codigo", limiteDeConferencia, async (req, res, next) => {
  try {
    // Aceita o código como veio impresso, digitado sem hífen ou em minúscula.
    const codigo = normalizarCodigo(req.params.codigo!);
    if (!codigo) {
      res.status(404).json({ message: "Código inválido" });
      return;
    }

    const documento = await container.documentos.buscarPorCodigo(codigo);
    if (!documento) {
      // Mesma resposta para código malformado e inexistente: distinguir os
      // dois entregaria de graça o formato válido a quem está varrendo.
      res.status(404).json({ message: "Documento não encontrado" });
      return;
    }
    res.json(documento);
  } catch (error) {
    next(error);
  }
});
