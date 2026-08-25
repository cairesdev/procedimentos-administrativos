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
import { PostgresDocumentoRepository } from "./infrastructure/db/PostgresDocumentoRepository";
import { PostgresFonteDeContexto } from "./infrastructure/db/PostgresFonteDeContexto";
import { EmitirDocumento } from "./application/documento/EmitirDocumento";
import { ManterModelos } from "./application/documento/ManterModelos";
import { AnexosDeProcesso } from "./application/anexo/AnexosDeProcesso";
import { PostgresAuditoriaRepository } from "./infrastructure/db/PostgresAuditoriaRepository";
import { PostgresAtaRepository } from "./infrastructure/db/PostgresAtaRepository";
import { CriarAta } from "./application/ata/CriarAta";
import { EditarAta } from "./application/ata/EditarAta";
import { EditarLicitacao } from "./application/licitacao/EditarLicitacao";
import { EditarContrato } from "./application/contrato/EditarContrato";
import { GeradorNumeroProcesso } from "./application/shared/GeradorNumeroProcesso";
import { CriarLicitacao } from "./application/licitacao/CriarLicitacao";
import { CriarContrato } from "./application/contrato/CriarContrato";
import { MontarRascunhoSolicitacao } from "./application/solicitacao/MontarRascunhoSolicitacao";
import { EnviarSolicitacao } from "./application/solicitacao/EnviarSolicitacao";
import { CancelarSolicitacao } from "./application/solicitacao/CancelarSolicitacao";
import { AutenticarUsuario } from "./application/auth/AutenticarUsuario";
import { CriarUsuario } from "./application/usuario/CriarUsuario";
import { EditarUsuario } from "./application/usuario/EditarUsuario";
import { ManterFornecedor } from "./application/fornecedor/ManterFornecedor";
import { PostgresAdminSistemaRepository } from "./infrastructure/db/PostgresAdminSistemaRepository";
import { AdministrarSistema } from "./application/admin/AdministrarSistema";
import { PostgresPatrimonioRepository } from "./infrastructure/db/PostgresPatrimonioRepository";
import { GerenciarPatrimonio } from "./application/patrimonio/GerenciarPatrimonio";
import { PostgresFrotaRepository } from "./infrastructure/db/PostgresFrotaRepository";
import { GerenciarFrota } from "./application/frota/GerenciarFrota";
import { PostgresProtocoloRepository } from "./infrastructure/db/PostgresProtocoloRepository";
import { AtenderProtocolo } from "./application/protocolo/AtenderProtocolo";
import { ExigirDoRequerente } from "./application/protocolo/ExigirDoRequerente";

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
const atas = new PostgresAtaRepository();
const adminSistema = new PostgresAdminSistemaRepository();
const patrimonio = new PostgresPatrimonioRepository();
const frota = new PostgresFrotaRepository();
const numeracao = new GeradorNumeroProcesso(processos);
const documentos = new PostgresDocumentoRepository();
const protocolo = new PostgresProtocoloRepository();

export const container = {
  protocolo,
  atenderProtocolo: new AtenderProtocolo(
    protocolo, usuarios, numeracao, auditoria, executarEmTransacao,
  ),
  exigirDoRequerente: new ExigirDoRequerente(
    protocolo, new PostgresAnexoRepository(), new MinioArmazenamento(), auditoria,
  ),
  documentos,
  manterModelos: new ManterModelos(documentos),
  emitirDocumento: new EmitirDocumento(
    documentos, new PostgresFonteDeContexto(), usuarios, auditoria,
  ),
  frota,
  gerenciarFrota: new GerenciarFrota(frota, auditoria),
  patrimonio,
  gerenciarPatrimonio: new GerenciarPatrimonio(patrimonio, auditoria, executarEmTransacao),
  adminSistema,
  administrarSistema: new AdministrarSistema(
    adminSistema, usuarios, auditoria, new MinioArmazenamento(),
  ),
  licitacoes,
  contratos,
  solicitacoes,
  usuarios,
  organizacao,
  fornecedores,
  fluxoConfiguracao,
  autenticarUsuario: new AutenticarUsuario(usuarios),
  criarUsuario: new CriarUsuario(usuarios),
  editarUsuario: new EditarUsuario(usuarios),
  manterFornecedor: new ManterFornecedor(fornecedores),
  atas,
  criarAta: new CriarAta(atas, executarEmTransacao),
  editarAta: new EditarAta(atas, executarEmTransacao),
  editarLicitacao: new EditarLicitacao(licitacoes),
  editarContrato: new EditarContrato(contratos, executarEmTransacao),
  criarLicitacao: new CriarLicitacao(licitacoes),
  criarContrato: new CriarContrato(contratos, auditoria, executarEmTransacao),
  montarRascunho: new MontarRascunhoSolicitacao(
    solicitacoes, contratos, usuarios, executarEmTransacao,
  ),
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
