import { filtroDaQuery } from "../queryParam";
import { Router } from "express";
import multer from "multer";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { enviarArquivo } from "../enviarArquivo";
import { paginacaoSchema } from "../schemas/paginacao";
import {
  conferirSchema, conviteSchema, criarChecklistSchema, cumprirSchema, dispensarSchema,
  duplicarModeloSchema,
  editarChecklistSchema, itensDoChecklistSchema, modeloSchema,
} from "../schemas/checklist";

export const checklistsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Piso do módulo: quem não lê checklist não passa daqui.
checklistsRouter.use(exigirPermissao("checklists:read"));

const administra = exigirPermissao("checklists:manage");

// ---------------------------------------------------------------------------
// Modelos

checklistsRouter.get("/modelos", async (req, res, next) => {
  try {
    res.json(await container.gerenciarChecklist.listarModelos(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.get("/modelos/:id", async (req, res, next) => {
  try {
    res.json(await container.gerenciarChecklist.buscarModelo(
      req.sessao!.orgaoId, req.params.id!,
    ));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.post("/modelos", administra, async (req, res, next) => {
  try {
    const dados = modeloSchema.parse(req.body);
    res.status(201).json(await container.gerenciarChecklist.criarModelo({
      orgaoId: req.sessao!.orgaoId,
      nome: dados.nome,
      descricao: dados.descricao,
      itens: dados.itens.map((item, indice) => ({
        ...item,
        ordem: indice + 1,
        descricao: item.descricao ?? null,
        prazoDias: item.prazoDias ?? null,
        periodicidadeDias: item.periodicidadeDias ?? null,
        setorId: item.setorId ?? null,
        setorSugerido: item.setorSugerido ?? null,
        departamentoId: item.departamentoId ?? null,
        secao: item.secao ?? null,
        codigo: item.codigo ?? null,
        classificacao: item.classificacao ?? null,
        // O arquivo de referência sobe por rota própria, depois de o item
        // existir — como o anexo do cumprimento.
        modeloArquivo: null,
        modeloNomeOriginal: null,
        apoios: item.apoios ?? [],
      })),
    }));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.put("/modelos/:id", administra, async (req, res, next) => {
  try {
    const dados = modeloSchema.parse(req.body);
    await container.gerenciarChecklist.atualizarModelo({
      orgaoId: req.sessao!.orgaoId,
      id: req.params.id!,
      nome: dados.nome,
      descricao: dados.descricao,
      ativo: dados.ativo,
      itens: dados.itens.map((item, indice) => ({
        ...item,
        ordem: indice + 1,
        descricao: item.descricao ?? null,
        prazoDias: item.prazoDias ?? null,
        periodicidadeDias: item.periodicidadeDias ?? null,
        setorId: item.setorId ?? null,
        setorSugerido: item.setorSugerido ?? null,
        departamentoId: item.departamentoId ?? null,
        secao: item.secao ?? null,
        codigo: item.codigo ?? null,
        classificacao: item.classificacao ?? null,
        // O arquivo de referência sobe por rota própria, depois de o item
        // existir — como o anexo do cumprimento.
        modeloArquivo: null,
        modeloNomeOriginal: null,
        apoios: item.apoios ?? [],
      })),
    });
    res.json({ message: "Modelo atualizado" });
  } catch (error) {
    next(error);
  }
});

// Editar o modelo do sistema é copiá-lo para si primeiro — a linha global é de
// todas as prefeituras, e não há dono para alterá-la.
checklistsRouter.post("/modelos/:id/duplicar", administra, async (req, res, next) => {
  try {
    const { nome } = duplicarModeloSchema.parse(req.body ?? {});
    res.status(201).json(await container.gerenciarChecklist.duplicarModelo(
      req.sessao!.orgaoId, req.params.id!, nome,
    ));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.delete("/modelos/:id", administra, async (req, res, next) => {
  try {
    await container.gerenciarChecklist.removerModelo(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Modelo excluído" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Checklists

checklistsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await container.gerenciarChecklist.listar(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      alvoTipo: filtroDaQuery(req, "alvoTipo"),
      alvoId: filtroDaQuery(req, "alvoId"),
      emAberto: req.query.emAberto === "1",
    }));
  } catch (error) {
    next(error);
  }
});

// Busca o registro a que o checklist vai se prender: o servidor digita o
// número, e não cola um UUID.
checklistsRouter.get("/alvos", async (req, res, next) => {
  try {
    res.json(await container.gerenciarChecklist.buscarAlvos(
      req.sessao!.orgaoId,
      filtroDaQuery(req, "tipo") ?? "",
      filtroDaQuery(req, "busca") ?? "",
    ));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.post("/", administra, async (req, res, next) => {
  try {
    const dados = criarChecklistSchema.parse(req.body);
    res.status(201).json(await container.gerenciarChecklist.criar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      itens: dados.itens?.map((item, indice) => ({
        ...item,
        ordem: indice + 1,
        descricao: item.descricao ?? null,
        prazoLimite: item.prazoLimite ?? null,
        periodicidadeDias: item.periodicidadeDias ?? null,
        setorId: item.setorId ?? null,
        departamentoId: item.departamentoId ?? null,
        secao: item.secao ?? null,
        codigo: item.codigo ?? null,
        classificacao: item.classificacao ?? null,
        apoios: item.apoios ?? [],
      })),
    }));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await container.gerenciarChecklist.buscar(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.patch("/:id", administra, async (req, res, next) => {
  try {
    await container.gerenciarChecklist.atualizar({
      ...editarChecklistSchema.parse(req.body),
      orgaoId: req.sessao!.orgaoId,
      id: req.params.id!,
    });
    res.json({ message: "Checklist atualizado" });
  } catch (error) {
    next(error);
  }
});

checklistsRouter.put("/:id/itens", administra, async (req, res, next) => {
  try {
    const { itens } = itensDoChecklistSchema.parse(req.body);
    await container.gerenciarChecklist.substituirItens({
      orgaoId: req.sessao!.orgaoId,
      id: req.params.id!,
      itens: itens.map((item, indice) => ({
        ...item,
        ordem: indice + 1,
        descricao: item.descricao ?? null,
        prazoLimite: item.prazoLimite ?? null,
        periodicidadeDias: item.periodicidadeDias ?? null,
        setorId: item.setorId ?? null,
        departamentoId: item.departamentoId ?? null,
        secao: item.secao ?? null,
        codigo: item.codigo ?? null,
        classificacao: item.classificacao ?? null,
        apoios: item.apoios ?? [],
      })),
    });
    res.json({ message: "Itens atualizados" });
  } catch (error) {
    next(error);
  }
});

checklistsRouter.delete("/:id", administra, async (req, res, next) => {
  try {
    await container.gerenciarChecklist.remover(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Checklist excluído" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// O ciclo do item
//
// Cumprir e conferir são permissões diferentes de propósito: ninguém fecha o
// próprio item.

checklistsRouter.post(
  "/:id/itens/:itemId/cumprir",
  exigirPermissao("checklists:fulfill"),
  async (req, res, next) => {
    try {
      const { observacao } = cumprirSchema.parse(req.body);
      res.status(201).json(await container.cumprirItem.cumprir({
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
        itemId: req.params.itemId!,
        observacao,
      }));
    } catch (error) {
      next(error);
    }
  },
);

checklistsRouter.post(
  "/:id/itens/:itemId/conferir",
  exigirPermissao("checklists:verify"),
  async (req, res, next) => {
    try {
      const dados = conferirSchema.parse(req.body);

      // Quantos anexos o ciclo recebeu: é o que decide se um item que exige
      // documento pode ser aceito.
      const checklist = await container.gerenciarChecklist.buscar(
        req.sessao!.orgaoId, req.params.id!,
      );
      const item = checklist.itens.find((linha) => linha.id === req.params.itemId);

      await container.cumprirItem.responder({
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
        itemId: req.params.itemId!,
        aceitar: dados.aceitar,
        recusaMotivo: dados.recusaMotivo,
        anexos: item?.ultimoCiclo?.anexos.length ?? 0,
      });
      res.json({ message: dados.aceitar ? "Item aceito" : "Item recusado" });
    } catch (error) {
      next(error);
    }
  },
);

checklistsRouter.post(
  "/:id/itens/:itemId/dispensar",
  administra,
  async (req, res, next) => {
    try {
      const { motivo } = dispensarSchema.parse(req.body);
      await container.cumprirItem.dispensar({
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
        itemId: req.params.itemId!,
        motivo,
      });
      res.json({ message: "Item dispensado" });
    } catch (error) {
      next(error);
    }
  },
);

checklistsRouter.post(
  "/:id/itens/:itemId/reabrir",
  administra,
  async (req, res, next) => {
    try {
      await container.cumprirItem.reabrir({
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
        itemId: req.params.itemId!,
      });
      res.json({ message: "Item reaberto" });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// O link externo
//
// Gerar e revogar é de quem administra a lista. O token volta **uma vez** —
// o banco guarda só o hash.

checklistsRouter.post("/:id/convite", administra, async (req, res, next) => {
  try {
    const { destinatario, destinatarioEmail } = conviteSchema.parse(req.body);
    res.status(201).json(await container.convidarParaChecklist.convidar({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      checklistId: req.params.id!,
      destinatario,
      destinatarioEmail,
      orgaoNome: (await container.adminSistema.buscarOrgao(req.sessao!.orgaoId))?.nome,
    }));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.get("/:id/convite", async (req, res, next) => {
  try {
    res.json(await container.convidarParaChecklist.situacao(req.params.id!));
  } catch (error) {
    next(error);
  }
});

checklistsRouter.delete("/:id/convite", administra, async (req, res, next) => {
  try {
    await container.convidarParaChecklist.revogar({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      checklistId: req.params.id!,
    });
    res.json({ message: "Link revogado" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Anexo do cumprimento

checklistsRouter.post(
  "/:id/cumprimentos/:cumprimentoId/anexos",
  exigirPermissao("checklists:fulfill"),
  upload.single("arquivo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(422).json({ message: "Arquivo ausente — envie no campo 'arquivo'" });
        return;
      }
      res.status(201).json(await container.anexosDoChecklist.anexar({
        orgaoId: req.sessao!.orgaoId,
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

// O modelo de referência do item — o "BAIXAR" da planilha do PNTP.
checklistsRouter.get("/:id/itens/:itemId/modelo", async (req, res, next) => {
  try {
    const { nomeOriginal, arquivo } = await container.anexosDoChecklist.baixarModelo(
      req.sessao!.orgaoId, req.params.itemId!,
    );
    enviarArquivo(res, arquivo, { nomeParaDownload: nomeOriginal });
  } catch (error) {
    next(error);
  }
});

checklistsRouter.get("/:id/anexos/:anexoId/download", async (req, res, next) => {
  try {
    const { nomeOriginal, arquivo } = await container.anexosDoChecklist.baixar(
      req.sessao!.orgaoId, req.params.anexoId!,
    );
    enviarArquivo(res, arquivo, { nomeParaDownload: nomeOriginal });
  } catch (error) {
    next(error);
  }
});
