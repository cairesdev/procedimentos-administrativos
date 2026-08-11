import { executarEmTransacao } from "./infrastructure/db/pool";
import { PostgresLicitacaoRepository } from "./infrastructure/db/PostgresLicitacaoRepository";
import { PostgresContratoRepository } from "./infrastructure/db/PostgresContratoRepository";
import { PostgresProcessoRepository } from "./infrastructure/db/PostgresProcessoRepository";
import { PostgresSolicitacaoRepository } from "./infrastructure/db/PostgresSolicitacaoRepository";
import { PostgresUsuarioRepository } from "./infrastructure/db/PostgresUsuarioRepository";
import { PostgresOrganizacaoRepository } from "./infrastructure/db/PostgresOrganizacaoRepository";
import { PostgresFornecedorRepository } from "./infrastructure/db/PostgresFornecedorRepository";
import { PostgresFluxoConfiguracaoRepository } from "./infrastructure/db/PostgresFluxoConfiguracaoRepository";
import { PostgresTramitacaoRepository } from "./infrastructure/db/PostgresTramitacaoRepository";
import { DespacharProcesso } from "./application/tramitacao/DespacharProcesso";
import { EmitirParecer } from "./application/tramitacao/EmitirParecer";
import { EmitirOrdemFornecimento } from "./application/tramitacao/EmitirOrdemFornecimento";
import { PostgresAnexoRepository } from "./infrastructure/db/PostgresAnexoRepository";
import { MinioArmazenamento } from "./infrastructure/storage/MinioArmazenamento";
import { AnexosDeProcesso } from "./application/anexo/AnexosDeProcesso";
import { PostgresAuditoriaRepository } from "./infrastructure/db/PostgresAuditoriaRepository";
import { GeradorNumeroProcesso } from "./application/shared/GeradorNumeroProcesso";
import { CriarLicitacao } from "./application/licitacao/CriarLicitacao";
import { CriarContrato } from "./application/contrato/CriarContrato";
import { MontarRascunhoSolicitacao } from "./application/solicitacao/MontarRascunhoSolicitacao";
import { EnviarSolicitacao } from "./application/solicitacao/EnviarSolicitacao";
import { CancelarSolicitacao } from "./application/solicitacao/CancelarSolicitacao";
import { AutenticarUsuario } from "./application/auth/AutenticarUsuario";
import { CriarUsuario } from "./application/usuario/CriarUsuario";
import { ManterFornecedor } from "./application/fornecedor/ManterFornecedor";

const licitacoes = new PostgresLicitacaoRepository();
const contratos = new PostgresContratoRepository();
const processos = new PostgresProcessoRepository();
const solicitacoes = new PostgresSolicitacaoRepository();
const usuarios = new PostgresUsuarioRepository();
const organizacao = new PostgresOrganizacaoRepository();
const fornecedores = new PostgresFornecedorRepository();
const fluxoConfiguracao = new PostgresFluxoConfiguracaoRepository();
const tramitacao = new PostgresTramitacaoRepository();
const auditoria = new PostgresAuditoriaRepository();
const numeracao = new GeradorNumeroProcesso(processos);

export const container = {
  licitacoes,
  contratos,
  solicitacoes,
  usuarios,
  organizacao,
  fornecedores,
  fluxoConfiguracao,
  autenticarUsuario: new AutenticarUsuario(usuarios),
  criarUsuario: new CriarUsuario(usuarios),
  manterFornecedor: new ManterFornecedor(fornecedores),
  criarLicitacao: new CriarLicitacao(licitacoes),
  criarContrato: new CriarContrato(contratos, processos, numeracao, auditoria, executarEmTransacao),
  montarRascunho: new MontarRascunhoSolicitacao(solicitacoes, executarEmTransacao),
  enviarSolicitacao: new EnviarSolicitacao(solicitacoes, processos, usuarios, numeracao, auditoria, executarEmTransacao),
  cancelarSolicitacao: new CancelarSolicitacao(solicitacoes, processos, auditoria, executarEmTransacao),
  tramitacao,
  auditoria,
  despacharProcesso: new DespacharProcesso(tramitacao, usuarios, auditoria, executarEmTransacao),
  emitirParecer: new EmitirParecer(tramitacao, solicitacoes, auditoria, executarEmTransacao),
  emitirOrdem: new EmitirOrdemFornecimento(tramitacao, processos, auditoria, executarEmTransacao),
  anexosDeProcesso: new AnexosDeProcesso(
    new PostgresAnexoRepository(), tramitacao, new MinioArmazenamento(), auditoria,
  ),
};
