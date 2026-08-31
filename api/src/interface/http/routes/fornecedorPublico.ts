import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";

/**
 * Página do fornecedor, sem login.
 *
 * A credencial é o token do link, e nada mais. Não há sessão, não há órgão no
 * caminho, e o que se alcança é um cadastro só — o do convite.
 *
 * O documento não entra no schema de propósito: CNPJ é a identidade do
 * registro, e trocá-lo transformaria o fornecedor em outro, levando junto o
 * histórico e os contratos de todas as prefeituras que o usam.
 */
const dadosSchema = z.object({
  razaoSocial: z.string().min(3, "Informe a razão social").max(200),
  endereco: z.string().max(500).optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]).optional(),
  telefone: z.string().max(20).optional(),
  inscricaoEstadual: z.string().max(30).optional(),
  inscricaoMunicipal: z.string().max(30).optional(),
});

export const fornecedorPublicoRouter = Router();

fornecedorPublicoRouter.get("/:token", async (req, res, next) => {
  try {
    res.json(await container.convidarFornecedor.abrir(req.params.token!));
  } catch (error) {
    next(error);
  }
});

fornecedorPublicoRouter.put("/:token", async (req, res, next) => {
  try {
    const dados = dadosSchema.parse(req.body);
    await container.convidarFornecedor.salvar(req.params.token!, {
      ...dados,
      // Campo em branco é ausência, não string vazia: gravar "" apagaria o
      // dado que a prefeitura já tinha, sem o fornecedor perceber.
      endereco: dados.endereco?.trim() || undefined,
      email: dados.email?.trim() || undefined,
      telefone: dados.telefone?.trim() || undefined,
      inscricaoEstadual: dados.inscricaoEstadual?.trim() || undefined,
      inscricaoMunicipal: dados.inscricaoMunicipal?.trim() || undefined,
    });
    res.json({ message: "Cadastro atualizado. Obrigado!" });
  } catch (error) {
    next(error);
  }
});
