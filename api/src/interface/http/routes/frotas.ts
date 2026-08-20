import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";

const veiculoSchema = z.object({
  placa: z.string().min(6).max(10),
  modelo: z.string().min(1).max(100),
  ano: z.number().int().min(1950).max(2100).optional(),
  tipo: z.string().max(40).optional(),
  unidadeId: z.string().uuid().optional(),
});

const edicaoVeiculoSchema = z.object({
  modelo: z.string().min(1).max(100).optional(),
  ano: z.number().int().min(1950).max(2100).nullable().optional(),
  tipo: z.string().max(40).nullable().optional(),
  unidadeId: z.string().uuid().nullable().optional(),
  ativo: z.boolean().optional(),
});

const motoristaSchema = z.object({
  nome: z.string().min(1).max(150),
  cnh: z.string().min(5).max(20),
  categoriaCnh: z.string().min(1).max(5),
  validadeCnh: z.string().date(),
  usuarioId: z.string().uuid().optional(),
});

const edicaoMotoristaSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  cnh: z.string().min(5).max(20).optional(),
  categoriaCnh: z.string().min(1).max(5).optional(),
  validadeCnh: z.string().date().optional(),
  usuarioId: z.string().uuid().nullable().optional(),
  ativo: z.boolean().optional(),
});

const viagemSchema = z.object({
  unidadeSolicitanteId: z.string().uuid(),
  veiculoId: z.string().uuid(),
  motoristaId: z.string().uuid(),
  dataHoraDesejada: z.string().datetime({ offset: true }),
  motivo: z.string().min(1).max(2000),
  responsavel: z.string().min(1).max(150),
});

const recusaSchema = z.object({ motivo: z.string().min(1).max(2000) });
const remarcacaoSchema = z.object({ dataHora: z.string().datetime({ offset: true }) });

const retiradaSchema = z.object({
  kmInicial: z.number().nonnegative(),
  dataHora: z.string().datetime({ offset: true }),
  motoristaId: z.string().uuid(),
  notaCombustivelTipo: z.enum(["LITRO", "VALOR"]).optional(),
  notaCombustivelQuantidade: z.number().positive().optional(),
});

const finalizacaoSchema = z.object({
  dataHora: z.string().datetime({ offset: true }),
  kmFinal: z.number().nonnegative(),
  sinistro: z.string().max(4000).optional(),
});

const abastecimentoSchema = z.object({
  data: z.string().datetime({ offset: true }),
  litros: z.number().positive().optional(),
  valor: z.number().positive().optional(),
});

const periodoSchema = z.object({
  de: z.string().datetime({ offset: true }),
  ate: z.string().datetime({ offset: true }),
});

const manutencaoSchema = z.object({
  veiculoId: z.string().uuid(),
  tipo: z.enum(["PREVENTIVA", "CORRETIVA"]),
  dataInicio: z.string().date(),
  descricao: z.string().max(4000).optional(),
  oficina: z.string().max(150).optional(),
  custo: z.number().nonnegative().optional(),
});

const encerramentoSchema = z.object({
  dataFim: z.string().date(),
  custo: z.number().nonnegative().optional(),
  descricao: z.string().max(4000).optional(),
});

const texto = (valor: unknown): string | undefined =>
  typeof valor === "string" && valor.length > 0 ? valor : undefined;

// Quem opera a frota: gestor de frota, gestor da prefeitura ou admin.
const podeEscrever = exigirPapel("ADMIN", "GESTOR", "FROTAS");

export const frotasRouter = Router();

// ---- Veículos --------------------------------------------------------------

frotasRouter.get("/veiculos", async (req, res, next) => {
  try {
    res.json(await container.frota.listarVeiculos(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/veiculos", podeEscrever, async (req, res, next) => {
  try {
    const dados = veiculoSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarFrota.criarVeiculo({ ...dados, orgaoId: req.sessao!.orgaoId }),
    );
  } catch (error) {
    next(error);
  }
});

frotasRouter.patch("/veiculos/:id", podeEscrever, async (req, res, next) => {
  try {
    const dados = edicaoVeiculoSchema.parse(req.body);
    await container.gerenciarFrota.atualizarVeiculo(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Veículo atualizado" });
  } catch (error) {
    next(error);
  }
});

frotasRouter.delete("/veiculos/:id", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarFrota.removerVeiculo(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Veículo excluído" });
  } catch (error) {
    next(error);
  }
});

// ---- Motoristas ------------------------------------------------------------

frotasRouter.get("/motoristas", async (req, res, next) => {
  try {
    res.json(await container.frota.listarMotoristas(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/motoristas", podeEscrever, async (req, res, next) => {
  try {
    const dados = motoristaSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarFrota.criarMotorista({ ...dados, orgaoId: req.sessao!.orgaoId }),
    );
  } catch (error) {
    next(error);
  }
});

frotasRouter.patch("/motoristas/:id", podeEscrever, async (req, res, next) => {
  try {
    const dados = edicaoMotoristaSchema.parse(req.body);
    await container.gerenciarFrota.atualizarMotorista(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Motorista atualizado" });
  } catch (error) {
    next(error);
  }
});

frotasRouter.delete("/motoristas/:id", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarFrota.removerMotorista(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Motorista excluído" });
  } catch (error) {
    next(error);
  }
});

// ---- Viagens ---------------------------------------------------------------

frotasRouter.get("/viagens", async (req, res, next) => {
  try {
    res.json(
      await container.frota.listarViagens(req.sessao!.orgaoId, {
        status: texto(req.query.status),
        veiculoId: texto(req.query.veiculo),
        de: texto(req.query.de),
        ate: texto(req.query.ate),
      }),
    );
  } catch (error) {
    next(error);
  }
});

frotasRouter.get("/viagens/:id", async (req, res, next) => {
  try {
    const viagem = await container.frota.buscarViagem(req.sessao!.orgaoId, req.params.id!);
    if (!viagem) {
      res.status(404).json({ message: "Viagem não encontrada" });
      return;
    }
    res.json(viagem);
  } catch (error) {
    next(error);
  }
});

// Solicitar é aberto a qualquer servidor autenticado: a unidade pede, o gestor decide.
frotasRouter.post("/viagens", async (req, res, next) => {
  try {
    const dados = viagemSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarFrota.solicitarViagem({ ...dados, orgaoId: req.sessao!.orgaoId }),
    );
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/viagens/:id/aprovar", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarFrota.aprovarViagem(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
    );
    res.json({ message: "Viagem aprovada" });
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/viagens/:id/recusar", podeEscrever, async (req, res, next) => {
  try {
    const { motivo } = recusaSchema.parse(req.body);
    await container.gerenciarFrota.recusarViagem(
      req.sessao!.orgaoId, req.params.id!, motivo, req.sessao!.usuarioId,
    );
    res.json({ message: "Viagem recusada" });
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/viagens/:id/remarcar", podeEscrever, async (req, res, next) => {
  try {
    const { dataHora } = remarcacaoSchema.parse(req.body);
    res.json(
      await container.gerenciarFrota.remarcarViagem(
        req.sessao!.orgaoId, req.params.id!, dataHora, req.sessao!.usuarioId,
      ),
    );
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/viagens/:id/cancelar", async (req, res, next) => {
  try {
    await container.gerenciarFrota.cancelarViagem(
      req.sessao!.orgaoId, req.params.id!, req.sessao!.usuarioId,
    );
    res.json({ message: "Viagem cancelada" });
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/viagens/:id/retirada", podeEscrever, async (req, res, next) => {
  try {
    const dados = retiradaSchema.parse(req.body);
    await container.gerenciarFrota.registrarRetirada(
      req.sessao!.orgaoId, req.params.id!, dados, req.sessao!.usuarioId,
    );
    res.json({ message: "Retirada registrada" });
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/viagens/:id/finalizar", podeEscrever, async (req, res, next) => {
  try {
    const dados = finalizacaoSchema.parse(req.body);
    await container.gerenciarFrota.finalizarViagem(
      req.sessao!.orgaoId, req.params.id!, dados, req.sessao!.usuarioId,
    );
    res.json({ message: "Viagem finalizada" });
  } catch (error) {
    next(error);
  }
});

// ---- Abastecimento ---------------------------------------------------------

frotasRouter.get("/viagens/:id/abastecimentos", async (req, res, next) => {
  try {
    res.json(await container.frota.listarAbastecimentos(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/viagens/:id/abastecimentos", podeEscrever, async (req, res, next) => {
  try {
    const dados = abastecimentoSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarFrota.registrarAbastecimento(
        req.sessao!.orgaoId, req.params.id!, dados,
      ),
    );
  } catch (error) {
    next(error);
  }
});

frotasRouter.delete("/abastecimentos/:id", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarFrota.removerAbastecimento(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Abastecimento excluído" });
  } catch (error) {
    next(error);
  }
});

// ---- Agenda e relatório ----------------------------------------------------

frotasRouter.get("/agenda", async (req, res, next) => {
  try {
    const { de, ate } = periodoSchema.parse(req.query);
    res.json(await container.frota.agenda(req.sessao!.orgaoId, de, ate));
  } catch (error) {
    next(error);
  }
});

frotasRouter.get("/relatorios/uso", async (req, res, next) => {
  try {
    const { de, ate } = periodoSchema.parse(req.query);
    res.json(await container.frota.relatorioDeUso(req.sessao!.orgaoId, de, ate));
  } catch (error) {
    next(error);
  }
});

// ---- Manutenção ------------------------------------------------------------

frotasRouter.get("/manutencoes", async (req, res, next) => {
  try {
    const abertas = req.query.abertas;
    res.json(
      await container.frota.listarManutencoes(req.sessao!.orgaoId, {
        veiculoId: texto(req.query.veiculo),
        abertas: abertas === undefined ? undefined : abertas === "true",
      }),
    );
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/manutencoes", podeEscrever, async (req, res, next) => {
  try {
    const dados = manutencaoSchema.parse(req.body);
    res.status(201).json(
      await container.gerenciarFrota.abrirManutencao(
        req.sessao!.orgaoId, dados, req.sessao!.usuarioId,
      ),
    );
  } catch (error) {
    next(error);
  }
});

frotasRouter.post("/manutencoes/:id/encerrar", podeEscrever, async (req, res, next) => {
  try {
    const dados = encerramentoSchema.parse(req.body);
    await container.gerenciarFrota.encerrarManutencao(
      req.sessao!.orgaoId, req.params.id!, dados, req.sessao!.usuarioId,
    );
    res.json({ message: "Manutenção encerrada" });
  } catch (error) {
    next(error);
  }
});

frotasRouter.delete("/manutencoes/:id", podeEscrever, async (req, res, next) => {
  try {
    await container.gerenciarFrota.removerManutencao(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Manutenção excluída" });
  } catch (error) {
    next(error);
  }
});
