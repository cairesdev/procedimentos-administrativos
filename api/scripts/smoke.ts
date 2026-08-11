// Smoke test do ciclo completo contra a API rodando.
// Pré-requisitos: migrations + db/seed.sql aplicados, `npm run dev` no ar.
// Uso: npm run smoke   (opcional: API_URL=http://host:porta)

const API = process.env.API_URL ?? "http://localhost:3333";
const SENHA = "12345678";
const marca = Date.now().toString().slice(-6);

let passos = 0;
const ok = (msg: string) => {
  passos += 1;
  console.log(`  ok  ${msg}`);
};

const conferir = (condicao: boolean, msg: string) => {
  if (!condicao) throw new Error(`FALHOU: ${msg}`);
  ok(msg);
};

const chamar = async (
  metodo: string,
  rota: string,
  corpo?: unknown,
  token?: string,
): Promise<any> => {
  const resposta = await fetch(`${API}${rota}`, {
    method: metodo,
    headers: {
      ...(corpo ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!resposta.ok) {
    throw new Error(`${metodo} ${rota} → ${resposta.status} ${JSON.stringify(dados)}`);
  }
  return dados;
};

const logar = async (identificador: string) => {
  const { token } = await chamar("POST", "/auth/login", { identificador, senha: SENHA });
  return token as string;
};

const criarUsuario = async (
  token: string,
  papel: string,
  lotacao: Record<string, string>,
): Promise<{ username: string; lotacaoId: string }> => {
  const username = `${papel.toLowerCase()}.${marca}`;
  await chamar("POST", "/usuarios", {
    nome: `Usuário ${papel}`,
    email: `${username}@demo.gov.br`,
    username,
    senha: SENHA,
    papelBase: papel,
    lotacoes: [lotacao],
  }, token);
  const tokenUsuario = await logar(username);
  const perfil = await chamar("GET", "/auth/eu", undefined, tokenUsuario);
  return { username, lotacaoId: perfil.lotacoes[0].id };
};

const executar = async () => {
  console.log(`\nSmoke test — ${API}\n`);

  // --- Cadastros de apoio -------------------------------------------------
  const admin = await logar("admin.demo");
  ok("login do admin (identificador, sem CNPJ)");

  const unidade = await chamar("POST", "/unidades",
    { nome: `Secretaria de Saúde ${marca}`, sigla: "SMS" }, admin);
  const protocolo = await chamar("POST", "/setores",
    { nome: `Protocolo ${marca}`, tipo: "PROTOCOLO" }, admin);
  const compras = await chamar("POST", "/setores",
    { nome: `Compras ${marca}`, tipo: "COMPRAS" }, admin);
  const controladoria = await chamar("POST", "/setores",
    { nome: `Controladoria ${marca}`, tipo: "CONTROLADORIA" }, admin);
  ok("unidade e três setores criados");

  await chamar("PUT", "/fluxos/SOLICITACAO_ITENS", {
    permiteOverrideUsuario: false,
    etapas: [
      { ordem: 1, setorId: protocolo.id, prazoDias: 5, prazoAtivo: true, visibilidadeEstendida: false },
      { ordem: 2, setorId: compras.id, prazoDias: 10, prazoAtivo: true, visibilidadeEstendida: false },
      { ordem: 3, setorId: controladoria.id, prazoAtivo: false, visibilidadeEstendida: true },
    ],
  }, admin);
  ok("fluxo Protocolo → Compras → Controladoria configurado");

  const uProtocolo = await criarUsuario(admin, "PROTOCOLO", { setorId: protocolo.id });
  const uCompras = await criarUsuario(admin, "COMPRAS", { setorId: compras.id });
  const uControle = await criarUsuario(admin, "CONTROLADORIA", { setorId: controladoria.id });
  const uServidor = await criarUsuario(admin, "SERVIDOR", { unidadeId: unidade.id });
  ok("quatro usuários com lotação (GET /auth/eu devolve lotacaoId)");

  const fornecedor = await chamar("POST", "/fornecedores", {
    documento: `1816203100${marca.slice(0, 4)}`,
    razaoSocial: `Fornecedor Demo ${marca}`,
    email: "contato@fornecedor.com.br",
  }, admin);
  ok("fornecedor global criado");

  // --- Licitação e contrato ----------------------------------------------
  const licitacao = await chamar("POST", "/licitacoes", {
    numero: `${marca}/2026`,
    objeto: "Aquisição de gêneros alimentícios",
    modalidade: "PREGAO_ELETRONICO",
    dataAssinatura: "2026-01-15",
    valorTotal: 100000,
    unidadesDestinadas: [unidade.id],
  }, admin);
  ok("licitação criada");

  const duplicada = await fetch(`${API}/licitacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      numero: `${marca}/2026`, objeto: "x", modalidade: "DISPENSA",
      dataAssinatura: "2026-01-15", valorTotal: 1, unidadesDestinadas: [unidade.id],
    }),
  });
  conferir(duplicada.status === 409, "número de licitação duplicado devolve 409");

  const contrato = await chamar("POST", "/contratos", {
    numero: `CT-${marca}`,
    fornecedorId: fornecedor.id,
    licitacaoId: licitacao.id,
    dataInicio: "2026-02-01",
    dataFim: "2027-01-31",
    valorTotal: 100000,
    fiscalNomeMatricula: "Maria Fiscal — mat. 1234",
    unidadesDestinadas: [unidade.id],
    itens: [
      { produto: "Copo descartável", unidadeMedida: "UN", quantidadeTotal: 100,
        modoMedicao: "UNIDADE", valorUnitario: 1, valorTotal: 100 },
      { produto: "Serviço de manutenção", unidadeMedida: "%", quantidadeTotal: 100,
        modoMedicao: "PERCENTUAL", valorUnitario: 0, valorTotal: 5000 },
    ],
  }, admin);
  conferir(!!contrato.numeroProtocolo && !!contrato.numeroProcessoAdm,
    `contrato nasce com processo (${contrato.numeroProtocolo} / ${contrato.numeroProcessoAdm})`);

  const itens = await chamar("GET", `/contratos/${contrato.id}/itens`, undefined, admin);
  const copo = itens.find((i: any) => i.produto === "Copo descartável");
  const servico = itens.find((i: any) => i.produto === "Serviço de manutenção");
  conferir(copo.saldoDisponivel === 100, "saldo inicial do item = quantidade total");

  // --- Solicitação --------------------------------------------------------
  const tokenServidor = await logar(uServidor.username);
  const rascunho = await chamar("POST", "/solicitacoes", {
    unidadeSolicitanteId: unidade.id,
    itens: [
      { itemId: copo.id, quantidadeSolicitada: 20 },
      { itemId: servico.id, quantidadeSolicitada: 10 },
    ],
  }, tokenServidor);

  const semReserva = await chamar("GET", `/contratos/${contrato.id}/itens`, undefined, admin);
  conferir(semReserva.find((i: any) => i.id === copo.id).saldoDisponivel === 100,
    "rascunho não reserva saldo");

  const detalhe = await chamar("GET", `/solicitacoes/${rascunho.id}`, undefined, tokenServidor);
  const valorCopo = detalhe.itens.find((i: any) => i.itemId === copo.id).valorCalculado;
  const valorServico = detalhe.itens.find((i: any) => i.itemId === servico.id).valorCalculado;
  conferir(valorCopo === 20, "cálculo UNIDADE: 20 × R$1,00 = R$20,00");
  conferir(valorServico === 500, "cálculo PERCENTUAL: 10% de R$5.000,00 = R$500,00");

  const envio = await chamar("POST", `/solicitacoes/${rascunho.id}/enviar`, {}, tokenServidor);
  conferir(!!envio.protocolo, `envio gera protocolo ${envio.protocolo} e processo ${envio.processoAdm}`);

  const comReserva = await chamar("GET", `/contratos/${contrato.id}/itens`, undefined, admin);
  conferir(comReserva.find((i: any) => i.id === copo.id).saldoDisponivel === 80,
    "envio reserva saldo: 100 − 20 = 80");

  const processoId = envio.processoId;
  const processo = await chamar("GET", `/processos/${processoId}`, undefined, tokenServidor);
  conferir(processo.setorAtualId === protocolo.id, "processo cai na 1ª etapa do fluxo (Protocolo)");

  // --- Tramitação ---------------------------------------------------------
  const tokenProtocolo = await logar(uProtocolo.username);
  await chamar("POST", `/processos/${processoId}/despachos`, {
    lotacaoId: uProtocolo.lotacaoId, tipo: "ANALISE", texto: "Processo autuado e conferido.",
  }, tokenProtocolo);
  await chamar("POST", `/processos/${processoId}/despachos`, {
    lotacaoId: uProtocolo.lotacaoId, tipo: "ENCAMINHAMENTO", texto: "Segue para Compras.",
  }, tokenProtocolo);
  const emCompras = await chamar("GET", `/processos/${processoId}`, undefined, tokenProtocolo);
  conferir(emCompras.setorAtualId === compras.id, "encaminhamento sem destino segue o fluxo → Compras");

  const tokenCompras = await logar(uCompras.username);
  const ordem = await chamar("POST", `/processos/${processoId}/ordens`, {
    lotacaoId: uCompras.lotacaoId,
    contratoId: contrato.id,
    valor: 520,
    numeroEmpenho: "2026NE000123",
    numeroNotaFiscal: `NF-${marca}`,
  }, tokenCompras);
  conferir(/^\d{4}\/\d{4}$/.test(ordem.numero), `ordem de fornecimento emitida (${ordem.numero})`);

  const nfRepetida = await fetch(`${API}/processos/${processoId}/ordens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenCompras}` },
    body: JSON.stringify({
      lotacaoId: uCompras.lotacaoId, contratoId: contrato.id, valor: 1,
      numeroNotaFiscal: `NF-${marca}`,
    }),
  });
  conferir(nfRepetida.status === 409, "NF duplicada para o mesmo fornecedor devolve 409");

  const parecerPorCompras = await fetch(`${API}/processos/${processoId}/parecer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenCompras}` },
    body: JSON.stringify({ lotacaoId: uCompras.lotacaoId, favoravel: true }),
  });
  conferir(parecerPorCompras.status === 403, "Compras não emite parecer (403)");

  await chamar("POST", `/processos/${processoId}/despachos`, {
    lotacaoId: uCompras.lotacaoId, tipo: "ENCAMINHAMENTO", texto: "Instruído, segue para parecer.",
  }, tokenCompras);

  const tokenControle = await logar(uControle.username);
  const lotacaoAlheia = await fetch(`${API}/processos/${processoId}/parecer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenControle}` },
    body: JSON.stringify({ lotacaoId: uCompras.lotacaoId, favoravel: true }),
  });
  conferir(lotacaoAlheia.status === 403, "lotação de outro usuário é recusada (403)");

  await chamar("POST", `/processos/${processoId}/parecer`, {
    lotacaoId: uControle.lotacaoId, favoravel: true, justificativa: "Regularidade confirmada.",
  }, tokenControle);
  const encerrado = await chamar("GET", `/processos/${processoId}`, undefined, tokenControle);
  conferir(encerrado.status === "ENCERRADO", "parecer favorável encerra o processo");
  conferir(encerrado.despachos.length === 5, `timeline com ${encerrado.despachos.length} despachos`);

  const saldoFinal = await chamar("GET", `/contratos/${contrato.id}/itens`, undefined, admin);
  conferir(saldoFinal.find((i: any) => i.id === copo.id).saldoDisponivel === 80,
    "aprovação mantém o saldo debitado");

  // --- Cenário 2: cancelamento devolve saldo ------------------------------
  const outra = await chamar("POST", "/solicitacoes", {
    unidadeSolicitanteId: unidade.id,
    itens: [{ itemId: copo.id, quantidadeSolicitada: 30 }],
  }, tokenServidor);
  await chamar("POST", `/solicitacoes/${outra.id}/enviar`, {}, tokenServidor);
  const reservado = await chamar("GET", `/contratos/${contrato.id}/itens`, undefined, admin);
  conferir(reservado.find((i: any) => i.id === copo.id).saldoDisponivel === 50,
    "segunda solicitação reserva: 80 − 30 = 50");

  await chamar("POST", `/solicitacoes/${outra.id}/cancelar`, {}, tokenServidor);
  const devolvido = await chamar("GET", `/contratos/${contrato.id}/itens`, undefined, admin);
  conferir(devolvido.find((i: any) => i.id === copo.id).saldoDisponivel === 80,
    "cancelamento devolve o saldo: 50 + 30 = 80");

  // --- Cenário 3: saldo insuficiente --------------------------------------
  const demais = await chamar("POST", "/solicitacoes", {
    unidadeSolicitanteId: unidade.id,
    itens: [{ itemId: copo.id, quantidadeSolicitada: 500 }],
  }, tokenServidor);
  const recusa = await fetch(`${API}/solicitacoes/${demais.id}/enviar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenServidor}` },
    body: "{}",
  });
  conferir(recusa.status === 422, "envio acima do saldo devolve 422");

  console.log(`\n${passos} verificações passaram.\n`);
};

executar().catch((erro) => {
  console.error(`\n${erro.message}\n`);
  process.exit(1);
});
