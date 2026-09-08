import { listHealthUnits } from "@/features/health/queries";
import { HealthUnitForm } from "@/features/health/components/HealthUnitForm";
import { requirePermission } from "@/shared/auth/guards";
import { ModalTrigger } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { Alert, Card, EmptyState, PageHeader, Stack, Table } from "@/shared/ui/layout";

/**
 * As unidades de saúde da prefeitura — hospital, UBS, postos.
 *
 * Tabela própria, e não a `unidade` administrativa: `unidade` é secretaria que
 * consome contrato e faz solicitação; isto aqui é o que o CNES conhece, com
 * código, tipo e endereço vindos do cadastro nacional.
 *
 * **Mora na administração, e não em `/saude`.** Quem cadastra é o ADMIN, e o
 * ADMIN não tem permissão clínica nenhuma — não lê prontuário nem abre ficha.
 * A tela dentro do sistema de saúde seria inalcançável justamente para a única
 * pessoa que pode usá-la, que foi como ela nasceu.
 */
export default async function UnidadesDeSaudePage() {
  await requirePermission("health:manage", "SAUDE");
  const unidades = await listHealthUnits();
  const podeAdministrar = true;

  return (
    <>
      <PageHeader
        title="Unidades de saúde"
        subtitle="Hospital, UBS e postos — com o código do cadastro nacional"
        action={
          podeAdministrar ? (
            <ModalTrigger
              label="Cadastrar unidade"
              title="Cadastrar unidade de saúde"
              description="Procure no CNES pelo município, ou preencha à mão."
            >
              <HealthUnitForm />
            </ModalTrigger>
          ) : null
        }
      />

      <Stack>
        {/*
          O CNES é leitura e fica fora do caminho crítico. Vale dizer isso na
          tela: quem cadastra precisa saber que o serviço do Ministério não é
          requisito para o hospital funcionar.
        */}
        {podeAdministrar ? (
          <Alert tone="info">
            A consulta ao cadastro nacional (CNES) preenche nome, tipo e endereço
            automaticamente — e é opcional. Se o serviço do Ministério estiver
            fora do ar, cadastre à mão: nenhum atendimento depende dessa consulta.
          </Alert>
        ) : null}

        <Card padded={false}>
          <Table
            columns={["Unidade", "CNES", "Tipo", "Endereço", "Consultado em", ""]}
            isEmpty={unidades.length === 0}
            emptyMessage="Nenhuma unidade cadastrada."
            empty={
              <EmptyState
                titulo="Nenhuma unidade de saúde cadastrada"
                descricao={
                  "Sem ao menos uma, não há onde abrir atendimento. Cadastre o "
                  + "hospital: a busca pelo município no CNES traz nome, tipo e "
                  + "endereço prontos."
                }
              />
            }
          >
            {unidades.map((unidade) => (
              <tr key={unidade.id}>
                <td>
                  {unidade.nome}
                  {!unidade.ativo ? " (inativa)" : ""}
                </td>
                <td>{unidade.codigoCnes ?? "—"}</td>
                <td>{unidade.tipoUnidade ?? "—"}</td>
                <td>{unidade.endereco ?? "—"}</td>
                <td>
                  {/*
                    Toda leitura externa fica datada. Sem isto ninguém sabe se o
                    dado é de ontem ou de 2019, e cadastro velho apresentado como
                    atual é pior que cadastro vazio.
                  */}
                  {unidade.cnesConsultadoEm ? toDate(unidade.cnesConsultadoEm) : "—"}
                </td>
                <td>
                  {podeAdministrar ? (
                    <ModalTrigger
                      label="Editar"
                      variant="ghost"
                      title={`Editar ${unidade.nome}`}
                    >
                      <HealthUnitForm unidade={unidade} />
                    </ModalTrigger>
                  ) : null}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </Stack>
    </>
  );
}
