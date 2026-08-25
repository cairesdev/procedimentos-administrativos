import { Router } from "express";
import { z } from "zod";
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

/**
 * Acompanhamento do protocolo externo. Rota aberta, então o par
 * protocolo + documento é obrigatório: o número é sequencial e adivinhável,
 * e sozinho deixaria qualquer um ler o pedido alheio.
 */
const acompanhamentoSchema = z.object({
  protocolo: z.string().min(3).max(20),
  documento: z.string().min(11).max(20),
});

conferenciaRouter.post("/protocolo", limiteDeConferencia, async (req, res, next) => {
  try {
    const dados = acompanhamentoSchema.safeParse(req.body);
    // Mesma resposta para dado malformado, protocolo inexistente e documento
    // que não confere: distinguir os três entregaria de graça, a quem varre,
    // a informação de qual protocolo existe.
    const naoEncontrado = () =>
      res.status(404).json({
        message: "Não encontramos protocolo com esse número para o documento informado.",
      });

    if (!dados.success) return naoEncontrado();

    const acompanhamento = await container.atenderProtocolo.acompanhar(
      dados.data.protocolo, dados.data.documento,
    );
    if (!acompanhamento) return naoEncontrado();

    res.json(acompanhamento);
  } catch (error) {
    next(error);
  }
});

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
