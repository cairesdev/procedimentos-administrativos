import { listEmails } from "@/features/emails/queries";
import { ResendButton } from "@/features/emails/components/ResendButton";
import { requirePermission } from "@/shared/auth/guards";
import { Pagination } from "@/shared/ui/Pagination";
import { humanize, toDateTime } from "@/shared/ui/labels";
import { Alert, Badge, Card, EmptyState, PageHeader, Stack, Table } from "@/shared/ui/layout";

type PageProps = { searchParams: Promise<{ pagina?: string }> };

const TOM = {
  ENVIADO: "success",
  PENDENTE: "accent",
  FALHOU: "warning",
} as const;

/**
 * Os e-mails que o sistema mandou em nome da prefeitura.
 *
 * Mesma permissão da auditoria: mostra o endereço do cidadão, que não é dado
 * para toda a repartição ver. E existe porque fila sem onde olhar é fila que
 * ninguém sabe que parou — sem esta tela, um SMTP mal configurado acumularia
 * exigências não entregues em silêncio até alguém reclamar por telefone.
 */
export default async function EmailsPage({ searchParams }: PageProps) {
  await requirePermission("audit:read");
  const { pagina } = await searchParams;

  const fila = await listEmails(pagina);
  const falhados = fila.itens.filter((email) => email.status === "FALHOU").length;
  const parados = fila.itens.filter((email) => email.status === "PENDENTE").length;

  /**
   * Cinco minutos de atraso no e-mail mais antigo = ninguém está processando.
   *
   * O worker roda a cada quinze segundos e a maior espera entre tentativas é
   * de dezesseis minutos, mas essa espera empurra `agendado_para` para frente
   * — o atraso só cresce quando **nada** pega a fila.
   */
  const travada = (fila.atrasoEmMinutos ?? 0) >= 5;

  return (
    <>
      <PageHeader
        title="E-mails enviados"
        subtitle="O que o sistema mandou em nome da prefeitura — e o que não conseguiu mandar"
      />

      <Stack>
        {falhados > 0 ? (
          <Alert tone="error">
            {falhados === 1
              ? "Um e-mail não pôde ser entregue."
              : `${falhados} e-mails não puderam ser entregues.`}{" "}
            Veja o motivo na linha e reenvie depois de corrigir.
          </Alert>
        ) : null}

        {/*
          A fila parada precisa parecer parada.
          ------------------------------------------------------------------
          Antes havia só o aviso azul de "esperando o próximo envio", que é o
          que a tela mostrava enquanto o worker estava morto havia 22 horas.
          Fila tranquila e fila travada eram a mesma frase.

          O corte de cinco minutos é folgado de propósito: o worker roda a cada
          quinze segundos, e um e-mail que falhou espera 1, 4, 9 ou 16 minutos
          entre tentativas. Cinco minutos de atraso no **mais antigo** não
          acontece com worker vivo.
        */}
        {travada ? (
          <Alert tone="error">
            <strong>A fila não está sendo processada.</strong> O e-mail mais antigo
            devia ter saído há {fila.atrasoEmMinutos} minutos e continua parado —
            o serviço de envio provavelmente está fora do ar. Avise o
            administrativo geral: nenhum aviso está chegando aos destinatários.
          </Alert>
        ) : parados > 0 ? (
          <Alert tone="info">
            {parados === 1 ? "Um e-mail está" : `${parados} e-mails estão`} na fila,
            esperando o próximo envio.
          </Alert>
        ) : null}

        <Card padded={false}>
          <Table
            columns={["Quando", "Para", "Assunto", "Situação", ""]}
            isEmpty={fila.itens.length === 0}
            emptyMessage="Nenhum e-mail ainda."
            empty={
              <EmptyState
                titulo="O sistema ainda não mandou nenhum e-mail"
                descricao={
                  "Aqui aparecem os avisos que saem sozinhos: convite de fornecedor, "
                  + "convite de checklist, exigência ao requerente e confirmação de "
                  + "protocolo. Cada linha mostra para quem foi e se chegou a sair."
                }
              />
            }
          >
            {fila.itens.map((email) => (
              <tr key={email.id}>
                <td>{toDateTime(email.criadoEm)}</td>
                <td>{email.destinatario}</td>
                <td>
                  {email.assunto}
                  <br />
                  <small style={{ color: "var(--texto_suave)" }}>
                    {humanize(email.tipo)}
                  </small>
                  {/*
                    O erro fica embaixo do assunto, e não numa coluna própria:
                    é texto do servidor SMTP, longo e irregular, e uma coluna
                    para ele espremeria todas as outras.
                  */}
                  {email.ultimoErro ? (
                    <>
                      <br />
                      <small style={{ color: "var(--erro)" }}>{email.ultimoErro}</small>
                    </>
                  ) : null}
                </td>
                <td>
                  <Badge tone={TOM[email.status]}>{email.status.toLowerCase()}</Badge>
                  {email.tentativas > 1 ? (
                    <>
                      {" "}
                      <small style={{ color: "var(--texto_suave)" }}>
                        {email.tentativas} tentativas
                      </small>
                    </>
                  ) : null}
                </td>
                <td>
                  {/* Só o que falhou: o entregue não se manda de novo por engano. */}
                  {email.status === "FALHOU" ? <ResendButton id={email.id} /> : null}
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Pagination info={fila} base="/administracao/emails" />
      </Stack>
    </>
  );
}
