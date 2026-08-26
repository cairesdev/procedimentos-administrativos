import Link from "next/link";
import { Alert, Badge, Card, Stack, SummaryGrid, Table, numericCell } from "@/shared/ui/layout";
import { toCurrency, toDate, toDateTime, toDocument, humanize } from "@/shared/ui/labels";
import { MEASUREMENT_LABELS, type RequestDetail } from "../types";

const quantidade = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Tudo sobre a solicitação numa tela só: o pedido, o processo que ele gerou,
 * cada item com o que veio do contrato, e os contratos de origem com
 * fornecedor e vigência. Reaproveitada pela versão de impressão.
 *
 * Traz o próprio `Stack`. Antes devolvia os cards soltos num fragmento e o
 * espaçamento vinha de fora — contrato invisível que a tela de detalhe da
 * solicitação não cumpria, e os cards saíam colados, um por cima do outro.
 */
export const RequestDetailView = ({ request }: { request: RequestDetail }) => {
  const rascunho = request.situacao === "RASCUNHO";
  const hoje = new Date();

  return (
    <Stack>
      <Card title="Solicitação">
        <SummaryGrid
          items={[
            { label: "Unidade solicitante", value: request.unidadeSolicitanteNome },
            {
              label: "Situação",
              value: (
                <Badge tone={rascunho ? "warning" : "success"}>
                  {rascunho ? "rascunho" : "enviada"}
                </Badge>
              ),
            },
            { label: "Criada em", value: toDateTime(request.criadaEm) },
            { label: "Protocolo", value: request.numeroProtocolo ?? "—" },
            { label: "Processo administrativo", value: request.numeroProcessoAdm ?? "—" },
            {
              label: "Situação do processo",
              value: request.statusProcesso ? humanize(request.statusProcesso) : "—",
            },
            { label: "Itens", value: request.totalItens },
            { label: "Valor total", value: toCurrency(request.valorTotal) },
          ]}
        />

        {rascunho ? (
          <div style={{ marginTop: "12px" }}>
            <Alert tone="info">
              Rascunho: os números de protocolo e processo só são gerados no envio, e o saldo dos
              contratos ainda não foi reservado.
            </Alert>
          </div>
        ) : null}
      </Card>

      <Card title={`Itens solicitados (${request.itens.length})`} padded={false}>
        <Table
          columns={[
            "Produto", "Marca", "Medição", "Valor unitário",
            "Qtd. solicitada", "Valor", "Saldo do contrato",
          ]}
          isEmpty={request.itens.length === 0}
          emptyMessage="Nenhum item nesta solicitação."
        >
          {request.itens.map((item) => (
            <tr key={item.itemId}>
              <td>
                <strong>{item.produto}</strong>
                {item.descricao ? (
                  <>
                    <br />
                    <small>{item.descricao}</small>
                  </>
                ) : null}
              </td>
              <td>{item.marca ?? "—"}</td>
              <td>{MEASUREMENT_LABELS[item.modoMedicao]}</td>
              <td className={numericCell}>{toCurrency(item.valorUnitario)}</td>
              <td className={numericCell}>
                {quantidade(item.quantidadeSolicitada)} {item.unidadeMedida}
              </td>
              <td className={numericCell}>{toCurrency(item.valorCalculado)}</td>
              <td className={numericCell}>
                {quantidade(item.saldoDisponivel)} de{" "}
                {quantidade(item.quantidadeTotalContratada)}
              </td>
            </tr>
          ))}

          {request.itens.length > 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "right", fontWeight: 600 }}>
                Total
              </td>
              <td className={numericCell} style={{ fontWeight: 600 }}>
                {toCurrency(request.valorTotal)}
              </td>
              <td />
            </tr>
          ) : null}
        </Table>
      </Card>

      {request.contratos.map((contrato) => {
        // Vigência vencida não bloqueia nada, mas quem despacha precisa ver.
        const vencido = new Date(contrato.dataFim) < hoje;
        const doContrato = request.itens.filter((item) => item.contratoId === contrato.id);
        const valorDoContrato = doContrato.reduce(
          (soma, item) => soma + item.valorCalculado,
          0,
        );

        return (
          <Card key={contrato.id} title={`Contrato ${contrato.numero}`}>
            <SummaryGrid
              items={[
                {
                  label: "Fornecedor",
                  value: contrato.fornecedorRazaoSocial,
                },
                { label: "CNPJ/CPF", value: toDocument(contrato.fornecedorDocumento) },
                { label: "Contato", value: contrato.fornecedorEmail ?? contrato.fornecedorTelefone ?? "—" },
                {
                  label: "Contrato",
                  value: (
                    <Link href={`/processos/contratos/${contrato.id}`} style={{ color: "var(--acao)" }}>
                      {contrato.numero}
                    </Link>
                  ),
                },
                {
                  label: contrato.origem === "ATA" ? "Ata de registro" : "Licitação de origem",
                  value: contrato.origemId ? (
                    <Link
                      href={
                        contrato.origem === "ATA"
                          ? `/processos/atas/${contrato.origemId}`
                          : `/processos/licitacoes/${contrato.origemId}`
                      }
                      style={{ color: "var(--acao)" }}
                    >
                      {contrato.origemNumero}
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
                {
                  label: "Vigência",
                  value: (
                    <>
                      {toDate(contrato.dataInicio)} a {toDate(contrato.dataFim)}
                      {vencido ? (
                        <>
                          {" "}
                          <Badge tone="warning">vencido</Badge>
                        </>
                      ) : null}
                    </>
                  ),
                },
                { label: "Valor do contrato", value: toCurrency(contrato.valorTotal) },
                { label: "Fiscal", value: contrato.fiscalNomeMatricula ?? "—" },
                {
                  label: "Nesta solicitação",
                  value: `${doContrato.length} item(ns) · ${toCurrency(valorDoContrato)}`,
                },
              ]}
            />
          </Card>
        );
      })}
    </Stack>
  );
};
