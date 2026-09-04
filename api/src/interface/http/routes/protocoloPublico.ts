import { Router } from "express";
import multer from "multer";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { container } from "../../../container";
import { ipDoCliente } from "../middlewares/rateLimit";

/**
 * Portal do cidadão: abertura de pedido sem login.
 *
 * A prefeitura vem no caminho, pelo CNPJ, e **não existe listagem**. O
 * endereço é divulgado pela própria prefeitura no site dela; publicar a lista
 * de quem usa o sistema entregaria a carteira de clientes do produto a
 * qualquer visitante.
 */
const CNPJ = z.string().regex(/^\d{14}$/);

const aberturaPublicaSchema = z.object({
  assuntoId: z.string().uuid(),
  descricaoPedido: z.string().min(10).max(4000),
  tipo: z.enum(["CIDADAO", "FORNECEDOR", "OUTRO_ORGAO"]),
  documento: z.string().min(11).max(20),
  nome: z.string().min(3).max(200),
  contatoEmail: z.string().email().optional(),
  contatoTelefone: z.string().max(20).optional(),
  /**
   * Armadilha para robô: campo escondido por CSS, que pessoa nenhuma vê e
   * preenchedor automático completa. Vindo preenchido, o pedido é descartado
   * com resposta de sucesso — dizer "você é um robô" só ensinaria o autor a
   * contornar.
   */
  site: z.string().max(200).optional(),
});

/** Abertura é cara: cada pedido vira processo que alguém vai ter de ler. */
const limiteDeAbertura = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(ipDoCliente(req)),
  message: {
    message: "Muitos pedidos abertos deste dispositivo. Tente novamente mais tarde ou procure a "
      + "prefeitura presencialmente.",
  },
});

/** Leitura da página é barata; o limite existe só contra varredura. */
const limiteDeLeitura = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(ipDoCliente(req)),
  message: { message: "Muitas consultas em pouco tempo. Aguarde um minuto." },
});

/**
 * Ações do requerente sobre um pedido já aberto. Mais folgado que a abertura
 * (responder exigência é o que a prefeitura quer que aconteça) e mais apertado
 * que a leitura, porque grava.
 */
const limiteDeInteracao = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(ipDoCliente(req)),
  message: { message: "Muitos envios deste dispositivo. Tente novamente mais tarde." },
});

/** Credencial do canal: o par vem no corpo de toda ação. */
const credencialSchema = z.object({
  protocolo: z.string().min(3).max(20),
  documento: z.string().min(11).max(20),
});

const anexoDoRequerente = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const protocoloPublicoRouter = Router();

/** Exigências dirigidas ao requerente, para ele ver o que falta. */
protocoloPublicoRouter.post("/pedidos/exigencias", limiteDeLeitura, async (req, res, next) => {
  try {
    const dados = credencialSchema.parse(req.body);
    res.json(
      await container.exigirDoRequerente.exigenciasDoRequerente(
        dados.protocolo, dados.documento,
      ),
    );
  } catch (error) {
    next(error);
  }
});

protocoloPublicoRouter.post("/pedidos/responder", limiteDeInteracao, async (req, res, next) => {
  try {
    const dados = credencialSchema.extend({ texto: z.string().min(5).max(4000) }).parse(req.body);
    await container.exigirDoRequerente.responder({
      numeroProtocolo: dados.protocolo,
      documento: dados.documento,
      texto: dados.texto,
    });
    res.json({ message: "Resposta registrada" });
  } catch (error) {
    next(error);
  }
});

protocoloPublicoRouter.post(
  "/pedidos/anexos",
  limiteDeInteracao,
  anexoDoRequerente.single("arquivo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(422).json({ message: "Arquivo ausente — envie no campo 'arquivo'" });
        return;
      }
      // Multipart chega como texto: a credencial vem nos campos do formulário.
      const dados = credencialSchema
        .extend({ exigenciaId: z.string().uuid().optional() })
        .parse(req.body);

      res.status(201).json(
        await container.exigirDoRequerente.anexar({
          numeroProtocolo: dados.protocolo,
          documento: dados.documento,
          exigenciaId: dados.exigenciaId,
          nomeOriginal: req.file.originalname,
          conteudo: req.file.buffer,
          mimeType: req.file.mimetype,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

/** O que a prefeitura atende — alimenta o formulário do portal. */
protocoloPublicoRouter.get("/prefeituras/:cnpj", limiteDeLeitura, async (req, res, next) => {
  try {
    const cnpj = CNPJ.safeParse(req.params.cnpj!.replace(/\D/g, ""));
    if (!cnpj.success) {
      res.status(404).json({ message: "Prefeitura não encontrada" });
      return;
    }

    const prefeitura = await container.protocolo.buscarPrefeituraPorCnpj(cnpj.data);
    if (!prefeitura) {
      res.status(404).json({ message: "Prefeitura não encontrada" });
      return;
    }

    const assuntos = await container.protocolo.listarAssuntos(prefeitura.id, true);
    res.json({
      nome: prefeitura.nome,
      municipio: prefeitura.municipio,
      uf: prefeitura.uf,
      // Só o que o cidadão precisa escolher: setor e contagem são internos.
      assuntos: assuntos.map((assunto) => ({
        id: assunto.id,
        nome: assunto.nome,
        descricao: assunto.descricao,
        prazoDias: assunto.prazoDias,
      })),
    });
  } catch (error) {
    next(error);
  }
});

protocoloPublicoRouter.post(
  "/prefeituras/:cnpj/pedidos",
  limiteDeAbertura,
  async (req, res, next) => {
    try {
      const cnpj = CNPJ.safeParse(req.params.cnpj!.replace(/\D/g, ""));
      if (!cnpj.success) {
        res.status(404).json({ message: "Prefeitura não encontrada" });
        return;
      }

      const prefeitura = await container.protocolo.buscarPrefeituraPorCnpj(cnpj.data);
      if (!prefeitura) {
        res.status(404).json({ message: "Prefeitura não encontrada" });
        return;
      }

      const dados = aberturaPublicaSchema.parse(req.body);

      // Armadilha acionada: responde como se tivesse dado certo, sem gravar
      // nada. O robô segue em frente achando que funcionou.
      if (dados.site && dados.site.trim() !== "") {
        res.status(201).json({ protocolo: "—", processoAdm: "—" });
        return;
      }

      const resultado = await container.atenderProtocolo.abrir({
        orgaoId: prefeitura.id,
        assuntoId: dados.assuntoId,
        descricaoPedido: dados.descricaoPedido,
        origem: "PORTAL",
        requerente: {
          tipo: dados.tipo,
          documento: dados.documento,
          nome: dados.nome,
          contatoEmail: dados.contatoEmail,
          contatoTelefone: dados.contatoTelefone,
        },
        // A prefeitura já foi resolvida pelo CNPJ da URL pública; o nome dela
        // vai no remetente da confirmação.
        orgaoNome: prefeitura.nome,
      });

      // O id do processo não sai: na rua o que vale é o protocolo, e é ele
      // que o cidadão usa para acompanhar.
      res.status(201).json({
        protocolo: resultado.protocolo,
        processoAdm: resultado.processoAdm,
      });
    } catch (error) {
      next(error);
    }
  },
);
