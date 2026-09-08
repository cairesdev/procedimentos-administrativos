import { Router } from "express";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { paginacaoSchema } from "../schemas/paginacao";
// O mesmo schema do balcão: duas listas de campos para a mesma pessoa seriam
// duas verdades sobre o que é um cadastro completo.
import { pacienteSchema } from "../schemas/saude";
import {
  encerramentoSchema, encerrarMembroSchema, indicacaoSchema, inicioSchema,
  inscricaoSchema, janelaSchema, membroSchema, programaSchema, sessaoSchema,
  situacaoSchema, terapiaSchema,
} from "../schemas/programa";

/**
 * O catálogo de programas e terapias.
 *
 * Router próprio, montado antes do resto, pela mesma razão das unidades de
 * saúde: quem cadastra programa é o administrador, que **não** alcança
 * inscrito nenhum. Sob o piso `programs:read`, ele abriria a tela de cadastro
 * e levaria 403 na primeira consulta.
 *
 * O piso aceita as duas: a coordenação precisa ler o catálogo para inscrever
 * alguém; o administrador precisa montá-lo. Escrever continua só de quem
 * administra.
 */
export const catalogoProgramasRouter = Router();

catalogoProgramasRouter.use(exigirPermissao("programs:read", "programs:setup"));

const administraCatalogo = exigirPermissao("programs:setup");

catalogoProgramasRouter.get("/", async (req, res, next) => {
  try {
    res.json(await container.gerenciarPrograma.listar(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

catalogoProgramasRouter.post("/", administraCatalogo, async (req, res, next) => {
  try {
    const criado = await container.gerenciarPrograma.criarPrograma(
      req.sessao!.orgaoId, programaSchema.parse(req.body),
    );
    res.status(201).json(criado);
  } catch (error) {
    next(error);
  }
});

catalogoProgramasRouter.put("/:id", administraCatalogo, async (req, res, next) => {
  try {
    await container.gerenciarPrograma.atualizarPrograma(
      req.sessao!.orgaoId, req.params.id!, programaSchema.parse(req.body),
    );
    res.json({ message: "Programa atualizado" });
  } catch (error) {
    next(error);
  }
});

catalogoProgramasRouter.post("/:id/terapias", administraCatalogo, async (req, res, next) => {
  try {
    const criada = await container.gerenciarPrograma.criarTerapia(
      req.sessao!.orgaoId, req.params.id!, terapiaSchema.parse(req.body),
    );
    res.status(201).json(criada);
  } catch (error) {
    next(error);
  }
});

catalogoProgramasRouter.put(
  "/:id/terapias/:terapiaId",
  administraCatalogo,
  async (req, res, next) => {
    try {
      await container.gerenciarPrograma.atualizarTerapia(
        req.sessao!.orgaoId, req.params.terapiaId!, terapiaSchema.parse(req.body),
      );
      res.json({ message: "Terapia atualizada" });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------

/**
 * Os inscritos, a fila e a equipe.
 *
 * Piso `programs:read`: quem não acompanha o programa não vê quem está nele.
 * A inscrição carrega situação e CID de uma pessoa — é dado de saúde, e o
 * administrador da prefeitura fica de fora, como fica do prontuário.
 */
export const programasRouter = Router();

programasRouter.use(exigirPermissao("programs:read"));

const coordena = exigirPermissao("programs:manage");
const atende = exigirPermissao("programs:attend");

/**
 * As duas listas de apoio dos formulários: as pessoas e os profissionais.
 *
 * Vivem aqui, e não nos cadastros de onde vêm, porque a coordenação do
 * programa não tem `health:read` nem `users:read` — e não deve ter. O que ela
 * alcança é o nome de quem inscrever e o nome de quem colocar na equipe; o
 * prontuário e o cadastro de usuários continuam do outro lado da porta.
 */
programasRouter.get("/pessoas", async (req, res, next) => {
  try {
    res.json(await container.gerenciarPrograma.procurarPessoas(
      req.sessao!.orgaoId, String(req.query.termo ?? ""),
    ));
  } catch (error) {
    next(error);
  }
});

/**
 * A coordenação cadastra a pessoa que vai inscrever.
 *
 * Foi a primeira coisa que travou o preenchimento na prática: boa parte das
 * crianças com TEA nunca passou pelo pronto atendimento, e o cadastro de
 * paciente estava atrás de `health:admit`, da recepção do hospital. A
 * coordenação ficava esperando o balcão digitar nome por nome — e a fila que o
 * Ministério Público quer medir não existia no sistema por um detalhe de
 * permissão.
 *
 * É o **mesmo** caso de uso da recepção, com as mesmas regras: documento
 * conferido no domínio, prontuário vitalício, e o segundo cadastro da mesma
 * pessoa devolvendo o que já existe em vez de duplicar. Cadastrar a pessoa não
 * abre ficha nenhuma: `health:admit` continua fora daqui, e o prontuário
 * também.
 */
programasRouter.post("/pessoas", coordena, async (req, res, next) => {
  try {
    const criada = await container.cadastrarPaciente.cadastrar(
      req.sessao!.orgaoId, pacienteSchema.parse(req.body), req.sessao!.usuarioId,
    );
    res.status(201).json(criada);
  } catch (error) {
    next(error);
  }
});

/**
 * O cadastro da pessoa, **sem as condições clínicas**.
 *
 * `ver` devolve o paciente inteiro, e o inteiro inclui hipertensão, diabetes e
 * alergias — que são prontuário. A coordenação do programa precisa do que vai
 * corrigir (nome, nascimento, documentos, contato) e de nada além disso, então
 * a lista de condições é retirada aqui, na fronteira, e não "esquecida" na
 * tela: tela esconde, rota nega.
 */
programasRouter.get("/pessoas/:id", coordena, async (req, res, next) => {
  try {
    const { condicoes, ...cadastro } = await container.cadastrarPaciente.ver(
      req.sessao!.orgaoId, req.params.id!,
    );
    void condicoes;
    res.json(cadastro);
  } catch (error) {
    next(error);
  }
});

/**
 * Completar o cadastro da pessoa — e é quase sempre a data de nascimento.
 *
 * Quem cadastra em mutirão preenche o nome e o telefone e deixa o nascimento
 * para depois. Sem ele a pessoa cai na linha "sem data de nascimento" do
 * relatório, que é honesta e feia, e quem vai corrigi-la é justamente a
 * coordenação — não o balcão do hospital, que nunca viu essa família.
 *
 * Continua sendo cadastro, e não prontuário: condição clínica, atendimento e
 * histórico seguem do outro lado da porta.
 */
programasRouter.put("/pessoas/:id", coordena, async (req, res, next) => {
  try {
    await container.cadastrarPaciente.atualizar(
      req.sessao!.orgaoId, req.params.id!, pacienteSchema.parse(req.body),
    );
    res.json({ message: "Cadastro atualizado" });
  } catch (error) {
    next(error);
  }
});

programasRouter.get("/profissionais", async (req, res, next) => {
  try {
    res.json(await container.gerenciarPrograma.listarProfissionais(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

// --- Inscritos ---

programasRouter.get("/inscritos", async (req, res, next) => {
  try {
    res.json(await container.gerenciarPrograma.listarInscritos(req.sessao!.orgaoId, {
      ...paginacaoSchema.parse(req.query),
      programaId: req.query.programa ? String(req.query.programa) : undefined,
      situacao: req.query.situacao ? String(req.query.situacao) : undefined,
      termo: req.query.termo ? String(req.query.termo) : undefined,
    }));
  } catch (error) {
    next(error);
  }
});

programasRouter.post("/inscritos", coordena, async (req, res, next) => {
  try {
    const dados = inscricaoSchema.parse(req.body);
    const criada = await container.gerenciarPrograma.inscrever({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      criadoPor: req.sessao!.usuarioId,
    });
    res.status(201).json(criada);
  } catch (error) {
    next(error);
  }
});

programasRouter.get("/inscritos/:id", async (req, res, next) => {
  try {
    res.json(await container.gerenciarPrograma.ver(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

programasRouter.put("/inscritos/:id/situacao", coordena, async (req, res, next) => {
  try {
    await container.gerenciarPrograma.atualizarSituacao(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
      situacaoSchema.parse(req.body),
    );
    res.json({ message: "Situação atualizada" });
  } catch (error) {
    next(error);
  }
});

// --- A fila ---

programasRouter.post("/inscritos/:id/indicacoes", coordena, async (req, res, next) => {
  try {
    const dados = indicacaoSchema.parse(req.body);
    const criada = await container.gerenciarPrograma.indicar(req.sessao!.orgaoId, {
      ...dados,
      inscricaoId: req.params.id!,
      indicadaPor: req.sessao!.usuarioId,
    });
    res.status(201).json(criada);
  } catch (error) {
    next(error);
  }
});

/**
 * Iniciar a terapia é o registro que fecha a espera.
 *
 * É o mais importante do módulo para o relatório: enquanto ele não existe, a
 * pessoa está na fila viva e a espera dela cresce sozinha todo dia.
 */
programasRouter.post("/indicacoes/:id/iniciar", coordena, async (req, res, next) => {
  try {
    const { em } = inicioSchema.parse(req.body);
    await container.gerenciarPrograma.iniciar(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, em,
    );
    res.json({ message: "Terapia iniciada" });
  } catch (error) {
    next(error);
  }
});

programasRouter.post("/indicacoes/:id/encerrar", coordena, async (req, res, next) => {
  try {
    const { em, motivo } = encerramentoSchema.parse(req.body);
    await container.gerenciarPrograma.encerrarTerapia(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, em, motivo,
    );
    res.json({ message: "Terapia encerrada" });
  } catch (error) {
    next(error);
  }
});

// --- As sessões ---

programasRouter.get("/indicacoes/:id/sessoes", async (req, res, next) => {
  try {
    res.json(await container.registrarSessao.listar(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

programasRouter.post("/indicacoes/:id/sessoes", atende, async (req, res, next) => {
  try {
    const dados = sessaoSchema.parse(req.body);
    const criada = await container.registrarSessao.registrar(
      req.sessao!.orgaoId, req.sessao!.usuarioId,
      {
        ...dados,
        indicacaoId: req.params.id!,
        // Quem registra é quem atendeu. Deixar o profissional vir no corpo
        // permitiria lançar sessão em nome de outro — e a resposta ao ofício
        // diz quem atendeu.
        profissionalId: req.sessao!.usuarioId,
      },
    );
    res.status(201).json(criada);
  } catch (error) {
    next(error);
  }
});

// --- A equipe ---

programasRouter.get("/:id/equipe", async (req, res, next) => {
  try {
    res.json(await container.gerenciarPrograma.listarEquipe(
      req.sessao!.orgaoId, req.params.id!,
    ));
  } catch (error) {
    next(error);
  }
});

programasRouter.post("/:id/equipe", coordena, async (req, res, next) => {
  try {
    const dados = membroSchema.parse(req.body);
    const criado = await container.gerenciarPrograma.adicionarMembro(
      req.sessao!.orgaoId, req.sessao!.usuarioId,
      { ...dados, programaId: req.params.id! },
    );
    res.status(201).json(criado);
  } catch (error) {
    next(error);
  }
});

programasRouter.post("/equipe/:membroId/encerrar", coordena, async (req, res, next) => {
  try {
    const { em } = encerrarMembroSchema.parse(req.body);
    await container.gerenciarPrograma.encerrarMembro(
      req.sessao!.orgaoId, req.params.membroId!, req.sessao!.usuarioId, em,
    );
    res.json({ message: "Vínculo encerrado" });
  } catch (error) {
    next(error);
  }
});

// --- O relatório do ofício ---

/**
 * Os três itens da requisição, numa resposta só.
 *
 * A leitura entra na auditoria: o relatório reúne situação e CID de todo mundo
 * do programa numa página, e quem o apurou fica registrado — mesmo raciocínio
 * do histórico clínico.
 */
/**
 * Guarda o recorte para o documento oficial apontar.
 *
 * A peça reapura na emissão: o recorte guarda a pergunta — programa e período
 * —, e nunca os números. É o que faz o ofício levar um retrato datado enquanto
 * a fila continua andando na tela, sem que os dois se contradigam.
 */
programasRouter.post("/:id/recortes", async (req, res, next) => {
  try {
    const { desde, ate } = janelaSchema.parse(req.body);
    const criado = await container.apurarRelatorio.recortar(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, desde, ate,
    );
    res.status(201).json(criado);
  } catch (error) {
    next(error);
  }
});

programasRouter.get("/recortes/:id", async (req, res, next) => {
  try {
    res.json(await container.apurarRelatorio.verRecorte(
      req.sessao!.orgaoId, req.params.id!,
    ));
  } catch (error) {
    next(error);
  }
});

programasRouter.get("/:id/relatorio", async (req, res, next) => {
  try {
    const { desde, ate } = janelaSchema.parse(req.query);
    res.json(await container.apurarRelatorio.apurar(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId, desde, ate,
    ));
  } catch (error) {
    next(error);
  }
});
