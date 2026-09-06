import { Router } from "express";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { paginacaoSchema } from "../schemas/paginacao";

export const emailsRouter = Router();

/**
 * A fila de e-mails da prefeitura.
 *
 * Mesma permissão da auditoria: é registro de o que o sistema mandou em nome
 * da prefeitura, para quem e quando — e mostra o endereço do cidadão, que não
 * é dado para toda a repartição ver.
 *
 * Fila sem onde olhar é fila que ninguém sabe que parou. Sem esta tela, um
 * SMTP mal configurado acumularia exigências não entregues em silêncio até
 * alguém reclamar por telefone.
 */
emailsRouter.use(exigirPermissao("audit:read"));

emailsRouter.get("/", async (req, res, next) => {
  try {
    /**
     * O atraso vem junto da página.
     *
     * É o sinal de vida da fila: se o e-mail mais antigo devia ter saído há
     * muito tempo e não saiu, ninguém está processando. Sem isto, fila parada
     * e fila tranquila são indistinguíveis — foi o que deixou o worker morto
     * por 22 horas sem ninguém perceber.
     */
    const [pagina, atrasoEmMinutos] = await Promise.all([
      container.emailFila.listar(req.sessao!.orgaoId, paginacaoSchema.parse(req.query)),
      container.emailFila.atrasoDaFila(req.sessao!.orgaoId),
    ]);
    res.json({ ...pagina, atrasoEmMinutos });
  } catch (error) {
    next(error);
  }
});

/**
 * Reenviar.
 *
 * Só alcança o que falhou — e-mail já entregue não se manda de novo por
 * engano. O filtro por órgão vive no SQL: uma prefeitura não mexe na fila da
 * outra.
 */
emailsRouter.post("/:id/reenviar", async (req, res, next) => {
  try {
    const voltou = await container.emailFila.reenfileirar(
      req.sessao!.orgaoId, req.params.id!,
    );
    if (!voltou) {
      res.status(422).json({
        message: "Só é possível reenviar e-mail que falhou. Este já saiu ou ainda "
          + "está na fila.",
      });
      return;
    }
    res.json({ message: "E-mail devolvido à fila" });
  } catch (error) {
    next(error);
  }
});
