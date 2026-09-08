import { listPrograms } from "@/features/programs/queries";
import { ProgramForm, TherapyForm } from "@/features/programs/components/CatalogForms";
import { requirePermission } from "@/shared/auth/guards";
import { ModalTrigger } from "@/shared/ui/Modal";
import {
  Alert, Badge, Card, EmptyState, PageHeader, Stack, Table, Toolbar,
} from "@/shared/ui/layout";

/**
 * O catálogo dos programas de cuidado continuado e suas terapias.
 *
 * Aqui não há pessoa nenhuma: é a lista dos serviços que a prefeitura
 * oferece, e por isso ela abre para quem administra o módulo. Quem está
 * inscrito, com situação e CID, é outra tela e outra permissão — a de quem
 * acompanha as famílias.
 */
export default async function ProgramasPage() {
  await requirePermission("programs:setup", "SAUDE");
  const programas = await listPrograms();

  return (
    <>
      <PageHeader
        title="Programas de cuidado"
        subtitle="Os serviços de acompanhamento continuado e as terapias de cada um"
        action={
          <ModalTrigger
            label="Criar programa"
            title="Criar programa de cuidado"
            description="TEA, saúde mental, gestante de risco — o modelo é o mesmo."
          >
            <ProgramForm />
          </ModalTrigger>
        }
      />

      <Stack>
        <Alert tone="info">
          O cadastro aqui é do serviço, não das pessoas: quem está inscrito, em
          que fila e com qual diagnóstico aparece em Cuidado continuado, e é
          acompanhado pela coordenação.
        </Alert>

        {programas.length === 0 ? (
          <Card padded={false}>
            <Table columns={["Programa"]} isEmpty emptyMessage="Nenhum programa."
              empty={
                <EmptyState
                  titulo="Nenhum programa cadastrado"
                  descricao={
                    "Um programa reúne as terapias de um acompanhamento "
                    + "continuado — fonoaudiologia, terapia ocupacional, "
                    + "psicologia. É por terapia que a fila de espera é contada."
                  }
                />
              }
            >
              {null}
            </Table>
          </Card>
        ) : null}

        {programas.map((programa) => (
          <Card
            key={programa.id}
            title={programa.sigla ? `${programa.nome} (${programa.sigla})` : programa.nome}
            action={
              <Toolbar>
                <ModalTrigger
                  label="Nova terapia"
                  variant="secondary"
                  title={`Nova terapia — ${programa.nome}`}
                  description="A fila de espera é contada por terapia, e não pelo programa inteiro."
                >
                  <TherapyForm programaId={programa.id} />
                </ModalTrigger>
                <ModalTrigger
                  label="Editar"
                  variant="ghost"
                  title={`Editar ${programa.nome}`}
                >
                  <ProgramForm programa={programa} />
                </ModalTrigger>
              </Toolbar>
            }
            padded={false}
          >
            {programa.descricao ? (
              <p style={{ padding: "0 16px", color: "var(--texto_suave)" }}>
                {programa.descricao}
              </p>
            ) : null}

            <Table
              columns={["Terapia", "Conselho", "Situação", ""]}
              isEmpty={programa.terapias.length === 0}
              emptyMessage="Nenhuma terapia neste programa — ninguém pode ser indicado ainda."
            >
              {programa.terapias.map((terapia) => (
                <tr key={terapia.id}>
                  <td>{terapia.nome}</td>
                  <td>{terapia.conselho ?? "—"}</td>
                  <td>
                    {terapia.ativo
                      ? <Badge tone="success">ativa</Badge>
                      : <Badge tone="neutral">desativada</Badge>}
                  </td>
                  <td>
                    <ModalTrigger
                      label="Editar"
                      variant="ghost"
                      title={`Editar ${terapia.nome}`}
                    >
                      <TherapyForm programaId={programa.id} terapia={terapia} />
                    </ModalTrigger>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        ))}
      </Stack>
    </>
  );
}
