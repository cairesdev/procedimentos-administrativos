import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { findContract } from "@/features/contracts/queries";
import { Apresentacao } from "@/features/contracts/components/Apresentacao";
import { ChecklistCard } from "@/features/checklists/components/ChecklistCard";
import { LinhasPorCategoria } from "@/shared/ui/LinhasPorCategoria";
import { ContractItemActions } from "@/features/contracts/components/ContractItemActions";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { humanize, toCurrency, toDate, toDocument } from "@/shared/ui/labels";
import { Alert, Badge, Card, PageHeader, Stack, SummaryGrid, Table, celulaLonga, numericCell } from "@/shared/ui/layout";

type ContractPageProps = { params: Promise<{ id: string }> };

const quantidade = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

export default async function ContractDetailPage({ params }: ContractPageProps) {
  const viewer = await requirePermission("contracts:read", "PROCESSOS");
  const { id } = await params;

  const contrato = await findContract(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const vencido = contrato.dataFim ? new Date(contrato.dataFim) < new Date() : false;
  const consumido = contrato.itens.reduce(
    (soma, item) => soma + (item.quantidadeTotal - item.saldoDisponivel) * item.valorUnitario,
    0,
  );

  /**
   * Os dois valores do contrato.
   *
   * O valor assinado é digitado — vem do contrato em papel, com o
   * arredondamento do edital. A soma dos itens é outra conta. Eles deveriam
   * bater, e quando não batem alguém precisa saber: a tela mostra os dois em
   * vez de escolher um.
   */
  const podeEditarItens = viewer.can("contracts:write");
  const somaDosItens = contrato.itens.reduce((soma, item) => soma + item.valorTotal, 0);
  const divergencia = Math.round((somaDosItens - contrato.valorTotal) * 100) / 100;

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/processos/contratos"
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Contratos
        </Link>
      </p>

      <PageHeader
        title={`Contrato ${contrato.numero}`}
        subtitle={contrato.fornecedorRazaoSocial}
        action={vencido ? <Badge tone="warning">vigência vencida</Badge> : null}
      />

      <Stack>
        <Apresentacao
          fornecedor={{
            razaoSocial: contrato.fornecedorRazaoSocial,
            documento: contrato.fornecedorDocumento,
            endereco: contrato.fornecedorEndereco,
            email: contrato.fornecedorEmail,
            telefone: contrato.fornecedorTelefone,
            inscricaoEstadual: contrato.fornecedorInscricaoEstadual,
          }}
          procedimento={{
            rotulo: contrato.origem === "ATA" ? "Ata de registro de preços" : "Licitação",
            numero: contrato.origemNumero,
            modalidade: contrato.origemModalidade,
            objeto: contrato.origemObjeto,
            valor: contrato.origemValor,
            data: contrato.origemData,
          }}
        />

        {divergencia !== 0 ? (
          <Alert tone="info">
            O valor do contrato é {toCurrency(contrato.valorTotal)} e a soma dos itens dá{" "}
            {toCurrency(somaDosItens)} — diferença de {toCurrency(Math.abs(divergencia))}.
            Os dois números são digitados separadamente; corrija o que estiver errado.
          </Alert>
        ) : null}

        <Card title="Dados do contrato">
          <SummaryGrid
            items={[
              { label: "Fornecedor", value: contrato.fornecedorRazaoSocial },
              { label: "CNPJ/CPF", value: toDocument(contrato.fornecedorDocumento) },
              {
                label: "Vigência",
                value: `${toDate(contrato.dataInicio)} a ${
                  contrato.dataFim ? toDate(contrato.dataFim) : "sem termo"
                }`,
              },
              { label: "Valor total", value: toCurrency(contrato.valorTotal) },
              { label: "Já solicitado", value: toCurrency(consumido) },
              { label: "Fiscal", value: contrato.fiscalNomeMatricula ?? "—" },
              { label: "Solicitações", value: `${contrato.solicitacoes}` },
              {
                label: "Unidades destinadas",
                value: contrato.unidades.map((unidade) => unidade.nome).join(", ") || "—",
                wide: true,
              },
            ]}
          />
        </Card>

        {/* De onde o contrato veio: licitação direta, ou ata e a licitação dela. */}
        <Card title="Origem">
          <SummaryGrid
            items={[
              {
                label: contrato.origem === "ATA" ? "Ata de registro de preços" : "Licitação",
                value:
                  contrato.origem === "ATA" && contrato.origemId ? (
                    <Link href={`/processos/atas/${contrato.origemId}`} style={{ color: "var(--acao)" }}>
                      {contrato.origemNumero ?? "—"}
                    </Link>
                  ) : contrato.origemId ? (
                    <Link href={`/processos/licitacoes/${contrato.origemId}`} style={{ color: "var(--acao)" }}>
                      {contrato.origemNumero ?? "—"}
                    </Link>
                  ) : (
                    contrato.origemNumero ?? "—"
                  ),
              },
              ...(contrato.licitacaoDaAtaId
                ? [{
                    label: "Licitação que gerou a ata",
                    value: (
                      <Link
                        href={`/processos/licitacoes/${contrato.licitacaoDaAtaId}`}
                        style={{ color: "var(--acao)" }}
                      >
                        {contrato.licitacaoDaAtaNumero}
                      </Link>
                    ),
                  }]
                : []),
              { label: "Objeto", value: contrato.origemObjeto ?? "—", wide: true },
            ]}
          />
        </Card>

        <Card title={`Itens (${contrato.itens.length})`} padded={false}>
          <Table
            columns={[
              "Produto", "Marca", "Medição", "Valor unitário", "Contratado", "Saldo",
              "Valor total",
              ...(podeEditarItens ? [""] : []),
            ]}
            isEmpty={contrato.itens.length === 0}
            emptyMessage="Nenhum item neste contrato."
          >
            <LinhasPorCategoria
              itens={contrato.itens}
              colunas={podeEditarItens ? 8 : 7}
            >
              {(item) => (
              <tr key={item.id}>
                <td className={celulaLonga}>
                  <strong>{item.produto}</strong>
                  {item.descricao ? (
                    <>
                      <br />
                      <small>{item.descricao}</small>
                    </>
                  ) : null}
                </td>
                <td>{item.marca ?? "—"}</td>
                <td>{humanize(item.modoMedicao)}</td>
                <td className={numericCell}>{toCurrency(item.valorUnitario)}</td>
                <td className={numericCell}>
                  {quantidade(item.quantidadeTotal)} {item.unidadeMedida}
                </td>
                <td className={numericCell}>
                  {item.saldoDisponivel === 0 ? (
                    <Badge tone="warning">esgotado</Badge>
                  ) : (
                    `${quantidade(item.saldoDisponivel)} ${item.unidadeMedida}`
                  )}
                </td>
                <td className={numericCell}>{toCurrency(item.valorTotal)}</td>
                {podeEditarItens ? (
                  <td>
                    <ContractItemActions contractId={contrato.id} item={item} />
                  </td>
                ) : null}
              </tr>
              )}
            </LinhasPorCategoria>
          </Table>
        </Card>

        <ChecklistCard alvoTipo="CONTRATO" alvoId={contrato.id}
          podeCriar={viewer.can("checklists:manage")}
        />

        {contrato.unidades.length === 0 ? (
          <Alert tone="error">
            Este contrato não está vinculado a nenhuma unidade, então nenhuma consegue solicitar a
            partir dele. Edite o contrato para destiná-lo às unidades atendidas.
          </Alert>
        ) : null}
      </Stack>
    </>
  );
}
