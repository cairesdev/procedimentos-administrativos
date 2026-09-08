import { Router } from "express";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { paginacaoSchema } from "../schemas/paginacao";
import { ATOS } from "../../../domain/saude/AtosDaFicha";
import {
  abrirAtendimentoSchema, administracaoSchema, avaliacaoSchema, condicaoSchema,
  desfechoSchema, evolucaoSchema, exameSchema, identificarSchema, pacienteSchema,
  prescricaoSchema, procedimentoSchema, resultadoSchema, retificacaoSchema,
  triagemSchema, unidadeSaudeSchema,
} from "../schemas/saude";

export const saudeRouter = Router();

/**
 * O cadastro dos estabelecimentos é router próprio, montado em
 * `/saude/unidades` — e não é acaso.
 *
 * Quem cadastra unidade é o ADMIN, que **não** tem permissão clínica nenhuma:
 * não lê prontuário e não abre ficha. Sob o piso `health:read` do resto do
 * módulo, ele abriria a tela de cadastro e levaria 403 na primeira consulta —
 * foi assim que a tela nasceu, inalcançável para a única pessoa que podia
 * usá-la. Baixar o piso do módulo inteiro seria o conserto errado: abriria a
 * lista de atendimentos ao ADMIN junto.
 *
 * O piso aqui aceita as duas: o profissional precisa saber em qual unidade
 * está abrindo a ficha; o administrador precisa cadastrá-la. Escrever é
 * separado, e continua só de quem administra.
 */
export const unidadesSaudeRouter = Router();

unidadesSaudeRouter.use(exigirPermissao("health:read", "health:manage"));

const administraUnidades = exigirPermissao("health:manage");

/**
 * As unidades de saúde ficam **antes** do piso, e é de propósito.
 *
 * Quem cadastra estabelecimento é o ADMIN, que não tem permissão clínica
 * nenhuma — não lê prontuário e não abre ficha. Se estas rotas ficassem
 * abaixo de `health:read`, ele abriria a tela de cadastro e levaria 403 na
 * primeira consulta; foi assim que a tela nasceu, inalcançável para a única
 * pessoa que podia usá-la.
 *
 * Baixar o piso do módulo inteiro para `health:read OU health:manage` seria o
 * conserto errado: abriria a lista de atendimentos ao ADMIN junto.
 */
// ---------------------------------------------------------------------------
// Unidades de saúde — o cadastro, e a única porta para o CNES

unidadesSaudeRouter.get("/", async (req, res, next) => {
  try {
    res.json(await container.unidadesDeSaude.listar(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

/**
 * As três rotas do CNES vêm antes de `/unidades/:id`.
 *
 * `/unidades/cnes/municipios` seria lido como `/unidades/:id` com o id valendo
 * a palavra "cnes" se a ordem fosse outra — o defeito que o guarda de rotas
 * desta suíte existe para pegar.
 */
unidadesSaudeRouter.get("/cnes/municipios", administraUnidades, async (req, res, next) => {
  try {
    res.json(await container.unidadesDeSaude.municipios(String(req.query.nome ?? "")));
  } catch (error) {
    next(error);
  }
});

unidadesSaudeRouter.get(
  "/cnes/municipios/:codigo",
  administraUnidades,
  async (req, res, next) => {
    try {
      res.json(await container.unidadesDeSaude.estabelecimentosDoMunicipio(
        req.params.codigo!,
      ));
    } catch (error) {
      next(error);
    }
  },
);

unidadesSaudeRouter.get(
  "/cnes/estabelecimento/:codigo",
  administraUnidades,
  async (req, res, next) => {
    try {
      res.json(await container.unidadesDeSaude.consultarCnes(req.params.codigo!));
    } catch (error) {
      next(error);
    }
  },
);

unidadesSaudeRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await container.unidadesDeSaude.ver(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

unidadesSaudeRouter.post("/", administraUnidades, async (req, res, next) => {
  try {
    const dados = unidadeSaudeSchema.parse(req.body);
    const criada = await container.unidadesDeSaude.criar(req.sessao!.orgaoId, {
      ...dados,
      codigoCnes: dados.codigoCnes || null,
      cnesConsultadoEm: dados.codigoCnes ? new Date() : null,
    });
    res.status(201).json(criada);
  } catch (error) {
    next(error);
  }
});

unidadesSaudeRouter.put("/:id", administraUnidades, async (req, res, next) => {
  try {
    const dados = unidadeSaudeSchema.parse(req.body);
    await container.unidadesDeSaude.atualizar(req.sessao!.orgaoId, req.params.id!, {
      ...dados,
      codigoCnes: dados.codigoCnes || null,
      cnesConsultadoEm: dados.codigoCnes ? new Date() : null,
    });
    res.json({ message: "Unidade atualizada" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// A ficha. Piso do módulo: quem não lê prontuário não passa daqui.
//
// Cada rota abaixo exige, além disso, a permissão do **ato** que ela realiza —
// e a exigência vem de `ATOS`, a mesma tabela que a ficha impressa usa para
// dizer quem assina cada bloco. Escrever a permissão à mão em cada rota daria
// dois lugares para discordarem, e o que discordasse em silêncio seria este.

saudeRouter.use(exigirPermissao("health:read"));

const podeAbrir = exigirPermissao(ATOS.ABRIR.permissao);
const podeTriar = exigirPermissao(ATOS.TRIAR.permissao);
const podeAtenderComoMedico = exigirPermissao(ATOS.AVALIAR.permissao);
const podeMedicar = exigirPermissao(ATOS.ADMINISTRAR.permissao);
const podeTranscreverResultado = exigirPermissao(ATOS.RESULTADO_DE_EXAME.permissao);
const podeLerHistorico = exigirPermissao("health:records");

// ---------------------------------------------------------------------------
// Pacientes

saudeRouter.get("/pacientes", async (req, res, next) => {
  try {
    res.json(await container.cadastrarPaciente.buscar(
      req.sessao!.orgaoId,
      String(req.query.termo ?? ""),
      paginacaoSchema.parse(req.query),
    ));
  } catch (error) {
    next(error);
  }
});

saudeRouter.get("/pacientes/:id", async (req, res, next) => {
  try {
    res.json(await container.cadastrarPaciente.ver(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

/**
 * O histórico de visitas — e a leitura que fica na auditoria.
 *
 * Rota separada de `/pacientes/:id` de propósito: ver o cadastro não é ver o
 * passado clínico, e só o segundo merece trilha. Se fossem a mesma rota, a
 * auditoria encheria de registro de quem só abriu o telefone do paciente.
 */
saudeRouter.get("/pacientes/:id/historico", podeLerHistorico, async (req, res, next) => {
  try {
    res.json(await container.fichaDeAtendimento.historico(
      req.sessao!.orgaoId,
      req.params.id!,
      req.sessao!.usuarioId,
      req.query.completo === "true",
    ));
  } catch (error) {
    next(error);
  }
});

saudeRouter.post("/pacientes", podeAbrir, async (req, res, next) => {
  try {
    const criado = await container.cadastrarPaciente.cadastrar(
      req.sessao!.orgaoId, pacienteSchema.parse(req.body), req.sessao!.usuarioId,
    );
    res.status(201).json(criado);
  } catch (error) {
    next(error);
  }
});

saudeRouter.put("/pacientes/:id", podeAbrir, async (req, res, next) => {
  try {
    await container.cadastrarPaciente.atualizar(
      req.sessao!.orgaoId, req.params.id!, pacienteSchema.parse(req.body),
    );
    res.json({ message: "Cadastro atualizado" });
  } catch (error) {
    next(error);
  }
});

saudeRouter.post("/pacientes/:id/condicoes", podeTriar, async (req, res, next) => {
  try {
    const criada = await container.cadastrarPaciente.registrarCondicao(
      req.sessao!.orgaoId, req.params.id!, condicaoSchema.parse(req.body),
      req.sessao!.usuarioId,
    );
    res.status(201).json(criada);
  } catch (error) {
    next(error);
  }
});

saudeRouter.delete("/pacientes/:id/condicoes/:condicaoId", podeTriar, async (req, res, next) => {
  try {
    await container.cadastrarPaciente.removerCondicao(
      req.sessao!.orgaoId, req.params.id!, req.params.condicaoId!,
    );
    res.json({ message: "Registro removido" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Atendimentos

saudeRouter.get("/atendimentos", async (req, res, next) => {
  try {
    res.json(await container.fichaDeAtendimento.listar(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      termo: req.query.termo ? String(req.query.termo) : undefined,
      status: req.query.status === "ENCERRADO" ? "ENCERRADO"
        : req.query.status === "EM_ANDAMENTO" ? "EM_ANDAMENTO" : undefined,
      unidadeSaudeId: req.query.unidade ? String(req.query.unidade) : undefined,
      incluirAntigos: req.query.completo === "true",
    }));
  } catch (error) {
    next(error);
  }
});

saudeRouter.get("/atendimentos/:id", async (req, res, next) => {
  try {
    res.json(await container.fichaDeAtendimento.ver(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

saudeRouter.post("/atendimentos", podeAbrir, async (req, res, next) => {
  try {
    const aberto = await container.abrirAtendimento.abrir(
      req.sessao!.orgaoId, req.sessao!.usuarioId, abrirAtendimentoSchema.parse(req.body),
    );
    res.status(201).json(aberto);
  } catch (error) {
    next(error);
  }
});

saudeRouter.post("/atendimentos/:id/identificar", podeAbrir, async (req, res, next) => {
  try {
    const { pacienteId } = identificarSchema.parse(req.body);
    await container.abrirAtendimento.identificar(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, pacienteId,
    );
    res.json({ message: "Paciente identificado" });
  } catch (error) {
    next(error);
  }
});

// --- Os blocos da ficha, cada um com a permissão do seu ato ---

saudeRouter.post("/atendimentos/:id/triagem", podeTriar, async (req, res, next) => {
  try {
    // Os avisos voltam para a tela e não impedem nada: saturação 71% é grave
    // e verdadeira, e é justamente o paciente que precisa ser registrado
    // depressa.
    res.status(201).json(await container.fichaDeAtendimento.triar(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
      triagemSchema.parse(req.body),
    ));
  } catch (error) {
    next(error);
  }
});

saudeRouter.post("/atendimentos/:id/avaliacao", podeAtenderComoMedico, async (req, res, next) => {
  try {
    const { queixaClinica } = avaliacaoSchema.parse(req.body);
    await container.fichaDeAtendimento.avaliar(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, queixaClinica,
    );
    res.status(201).json({ message: "Avaliação registrada" });
  } catch (error) {
    next(error);
  }
});

saudeRouter.post("/atendimentos/:id/exames", podeAtenderComoMedico, async (req, res, next) => {
  try {
    const { descricao } = exameSchema.parse(req.body);
    res.status(201).json(await container.prescricaoEExames.solicitarExame(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, descricao,
    ));
  } catch (error) {
    next(error);
  }
});

saudeRouter.put(
  "/atendimentos/:id/exames/:exameId",
  podeTranscreverResultado,
  async (req, res, next) => {
    try {
      const { resultado } = resultadoSchema.parse(req.body);
      await container.prescricaoEExames.informarResultado(
        req.sessao!.orgaoId, req.params.id!, req.params.exameId!,
        req.sessao!.usuarioId, resultado,
      );
      res.json({ message: "Resultado registrado" });
    } catch (error) {
      next(error);
    }
  },
);

saudeRouter.post("/atendimentos/:id/prescricoes", podeAtenderComoMedico, async (req, res, next) => {
  try {
    // Os alertas de alergia voltam junto e não bloqueiam: a comparação é
    // textual, e travar com uma checagem grosseira ensinaria o médico a
    // contornar — inclusive no dia em que o alerta estivesse certo.
    res.status(201).json(await container.prescricaoEExames.prescrever(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
      prescricaoSchema.parse(req.body),
    ));
  } catch (error) {
    next(error);
  }
});

/**
 * A coluna da direita do papel: o horário carimbado pelo técnico.
 *
 * Pendurada no item, e não no atendimento, porque é o item que ela carimba —
 * e o item alcança a prefeitura por dois joins, conferidos no caso de uso.
 */
saudeRouter.post("/itens-prescritos/:itemId/administracoes", podeMedicar, async (req, res, next) => {
  try {
    res.status(201).json(await container.prescricaoEExames.administrar(
      req.sessao!.orgaoId, req.params.itemId!, req.sessao!.usuarioId,
      administracaoSchema.parse(req.body),
    ));
  } catch (error) {
    next(error);
  }
});

/**
 * A evolução escolhe a permissão pelo tipo.
 *
 * Enfermagem e médica são duas caixas separadas no papel, e continuam
 * separadas aqui: o middleware não consegue decidir sozinho porque o tipo vem
 * no corpo, então a checagem acontece no caso de uso, contra a mesma tabela
 * `ATOS`.
 */
saudeRouter.post("/atendimentos/:id/evolucoes", async (req, res, next) => {
  try {
    const { tipo, texto } = evolucaoSchema.parse(req.body);
    const ato = tipo === "ENFERMAGEM" ? ATOS.EVOLUIR_ENFERMAGEM : ATOS.EVOLUIR_MEDICO;
    // `req.permissoes` já foi resolvido pelo `health:read` do topo do router.
    if (!req.permissoes?.has(ato.permissao)) {
      res.status(403).json({
        message: tipo === "ENFERMAGEM"
          ? "A evolução de enfermagem é escrita pelo enfermeiro."
          : "A evolução médica é escrita pelo médico.",
      });
      return;
    }
    res.status(201).json(await container.fichaDeAtendimento.evoluir(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, tipo, texto,
    ));
  } catch (error) {
    next(error);
  }
});

saudeRouter.post(
  "/atendimentos/:id/procedimentos",
  podeAtenderComoMedico,
  async (req, res, next) => {
    try {
      const { tipo, descricao } = procedimentoSchema.parse(req.body);
      res.status(201).json(await container.fichaDeAtendimento.registrarProcedimento(
        req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, tipo, descricao ?? null,
      ));
    } catch (error) {
      next(error);
    }
  },
);

saudeRouter.post("/atendimentos/:id/desfecho", podeTriar, async (req, res, next) => {
  try {
    await container.fichaDeAtendimento.darSaida(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
      desfechoSchema.parse(req.body),
    );
    res.status(201).json({ message: "Saída registrada" });
  } catch (error) {
    next(error);
  }
});

saudeRouter.post("/atendimentos/:id/retificacoes", async (req, res, next) => {
  try {
    res.status(201).json(await container.fichaDeAtendimento.retificar(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
      retificacaoSchema.parse(req.body),
    ));
  } catch (error) {
    next(error);
  }
});
