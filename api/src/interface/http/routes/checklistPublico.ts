import { Router } from "express";
import multer from "multer";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { container } from "../../../container";
import { ipDoCliente } from "../middlewares/rateLimit";

/**
 * O fornecedor cumprindo exigências, sem login.
 *
 * A credencial é o token do link, e nada mais: não há sessão, não há órgão no
 * caminho, e o que se alcança é um checklist só — o do convite, e dentro dele
 * apenas os itens marcados como do fornecedor.
 *
 * Superfície pública tem limite próprio. Sem ele, o token vira alvo de força
 * bruta barata: são 256 bits, mas o custo de tentar precisa ser maior que zero.
 */
const limiteDeLeitura = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Atrás do Caddy, sem a chave por IP real todos os visitantes compartilham
  // um só limite — e o primeiro a estourar derruba os demais.
  keyGenerator: (req) => ipKeyGenerator(ipDoCliente(req)),
  message: { message: "Muitas consultas em pouco tempo. Aguarde um minuto." },
});

const limiteDeEnvio = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(ipDoCliente(req)),
  message: { message: "Muitos envios deste dispositivo. Tente novamente mais tarde." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const cumprirSchema = z.object({
  observacao: z.string().max(2000).optional(),
});

export const checklistPublicoRouter = Router();

checklistPublicoRouter.get("/:token", limiteDeLeitura, async (req, res, next) => {
  try {
    res.json(await container.convidarParaChecklist.abrir(req.params.token!));
  } catch (error) {
    next(error);
  }
});

checklistPublicoRouter.post(
  "/:token/itens/:itemId/cumprir",
  limiteDeEnvio,
  async (req, res, next) => {
    try {
      const { observacao } = cumprirSchema.parse(req.body);
      res.status(201).json(await container.convidarParaChecklist.cumprir({
        token: req.params.token!,
        itemId: req.params.itemId!,
        observacao,
      }));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * O anexo da entrega feita pelo link.
 *
 * O ciclo é conferido contra o convite antes de o arquivo ser aceito: sem
 * isso, um id de cumprimento colado na requisição deixaria alguém pendurar
 * arquivo em entrega alheia.
 *
 * Teto menor que o interno — 25 MB contra 100 MB: certidão e contrato social
 * cabem, e o que não cabe provavelmente não é o que se pediu.
 */
checklistPublicoRouter.post(
  "/:token/cumprimentos/:cumprimentoId/anexos",
  limiteDeEnvio,
  upload.single("arquivo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(422).json({ message: "Arquivo ausente — envie no campo 'arquivo'" });
        return;
      }
      const orgaoId = await container.convidarParaChecklist.cicloDoConvite(
        req.params.token!, req.params.cumprimentoId!,
      );
      res.status(201).json(await container.anexosDoChecklist.anexar({
        orgaoId,
        cumprimentoId: req.params.cumprimentoId!,
        nomeOriginal: req.file.originalname,
        conteudo: req.file.buffer,
        mimeType: req.file.mimetype,
      }));
    } catch (error) {
      next(error);
    }
  },
);
