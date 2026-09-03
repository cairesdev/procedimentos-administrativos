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
import { ResolverAlcance } from "./application/almoxarifado/ResolverAlcance";
import { AnexosDoChecklist } from "./application/checklist/AnexosDoChecklist";
import { CumprirItem } from "./application/checklist/CumprirItem";
import { ConvidarParaChecklist } from "./application/checklist/ConvidarParaChecklist";
import { GerenciarChecklist } from "./application/checklist/GerenciarChecklist";
import { PostgresChecklistConviteRepository } from "./infrastructure/db/PostgresChecklistConviteRepository";
import { PostgresChecklistRepository } from "./infrastructure/db/PostgresChecklistRepository";
import { RegistrarQualidade } from "./application/almoxarifado/RegistrarQualidade";
import { PostgresQualidadeRepository } from "./infrastructure/db/PostgresQualidadeRepository";
import { ConvidarFornecedor } from "./application/fornecedor/ConvidarFornecedor";
import { PostgresFornecedorConviteRepository } from "./infrastructure/db/PostgresFornecedorConviteRepository";
import { ApurarConsumo } from "./application/almoxarifado/ApurarConsumo";
import { PostgresRelatorioConsumoRepository } from "./infrastructure/db/PostgresRelatorioConsumoRepository";
import {
  PostgresRecorteRepository, PostgresRelatorioProcessoRepository,
} from "./infrastructure/db/PostgresRelatorioProcessoRepository";
import { ApurarRelatorioDeProcessos } from "./application/relatorio/ApurarRelatorioDeProcessos";
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
import { InformarNotaFiscal } from "./application/tramitacao/InformarNotaFiscal";
import { EditarItemDoContrato } from "./application/contrato/EditarItemDoContrato";
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
import { PostgresAlmoxarifadoRepository } from "./infrastructure/db/PostgresAlmoxarifadoRepository";
import { GerenciarAlmoxarifado } from "./application/almoxarifado/GerenciarAlmoxarifado";
import { SolicitarEstoque } from "./application/almoxarifado/SolicitarEstoque";
import { LiberarEstoque } from "./application/almoxarifado/LiberarEstoque";
import { ReceberEstoque } from "./application/almoxarifado/ReceberEstoque";
import { MovimentarEstoque } from "./application/almoxarifado/MovimentarEstoque";

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
const almoxarifado = new PostgresAlmoxarifadoRepository();
const checklists = new PostgresChecklistRepository();

export const container = {
  almoxarifado,
  gerenciarAlmoxarifado: new GerenciarAlmoxarifado(
    almoxarifado, auditoria, executarEmTransacao,
  ),
  solicitarEstoque: new SolicitarEstoque(
    almoxarifado, usuarios, auditoria, executarEmTransacao,
  ),
  liberarEstoque: new LiberarEstoque(almoxarifado, auditoria, executarEmTransacao),
  receberEstoque: new ReceberEstoque(
    almoxarifado, usuarios, auditoria, executarEmTransacao,
  ),
  movimentarEstoque: new MovimentarEstoque(
    almoxarifado, usuarios, auditoria, executarEmTransacao,
  ),
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

  convidarFornecedor: new ConvidarFornecedor(
    new PostgresFornecedorConviteRepository(), fornecedores, auditoria,
  ),

  resolverAlcance: new ResolverAlcance(usuarios, almoxarifado),

  gerenciarChecklist: new GerenciarChecklist(
    checklists, auditoria, executarEmTransacao, organizacao,
  ),
  convidarParaChecklist: new ConvidarParaChecklist(
    new PostgresChecklistConviteRepository(), checklists, auditoria, executarEmTransacao,
  ),
  cumprirItem: new CumprirItem(checklists, auditoria, executarEmTransacao),
  anexosDoChecklist: new AnexosDoChecklist(checklists, new MinioArmazenamento()),

  registrarQualidade: new RegistrarQualidade(
    new PostgresQualidadeRepository(), auditoria,
  ),

  apurarConsumo: new ApurarConsumo(
    new PostgresRelatorioConsumoRepository(), almoxarifado,
  ),

  relatoriosDeProcessos: new ApurarRelatorioDeProcessos(
    new PostgresRelatorioProcessoRepository(),
    new PostgresRecorteRepository(),
  ),

  /**
   * Tipos de setor onde o servidor atua — é o que decide quais peças ele
   * alcança. Lotação de unidade não tem setor e não entra.
   */
  setoresDoUsuario: async (usuarioId: string): Promise<string[]> => {
    const perfil = await usuarios.buscarPerfil(usuarioId);
    return [...new Set(
      (perfil?.lotacoes ?? [])
        .map((lotacao) => lotacao.tipoSetor)
        .filter((tipo): tipo is string => Boolean(tipo)),
    )];
  },
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
  editarItemDoContrato: new EditarItemDoContrato(contratos, auditoria),

  informarNotaFiscal: new InformarNotaFiscal(tramitacao, auditoria),

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
