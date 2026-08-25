import { getProfile } from "@/features/auth/queries";
import { RequestBuilder } from "@/features/requests/components/RequestBuilder";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, PageHeader } from "@/shared/ui/layout";

export default async function NewRequestPage() {
  await requirePermission("requests:create", "PROCESSOS");

  const [units, profile] = await Promise.all([listUnits(), getProfile()]);

  /**
   * Lotação de unidade prende o pedido à unidade do servidor. Quem é de setor
   * — compras, protocolo — continua escolhendo qualquer uma: são justamente os
   * que atendem várias unidades.
   */
  const unidadesDaLotacao = profile.lotacoes
    .map((lotacao) => lotacao.unidadeId)
    .filter((id): id is string => Boolean(id));

  const disponiveis = unidadesDaLotacao.length > 0
    ? units.filter((unit) => unidadesDaLotacao.includes(unit.id))
    : units;

  // Uma única lotação de unidade: não há escolha a fazer, e mostrar um select
  // de uma opção só sugeriria que existem outras.
  const unidadeFixa = unidadesDaLotacao.length === 1 ? unidadesDaLotacao[0] : undefined;

  return (
    <>
      <PageHeader
        title="Nova solicitação"
        subtitle="Escolha a unidade, o contrato e então os itens — o saldo é reservado no envio"
      />

      {disponiveis.length === 0 ? (
        <Alert tone="error">
          Sua lotação aponta para uma unidade que não está mais cadastrada. Procure o administrador
          da prefeitura antes de solicitar.
        </Alert>
      ) : (
        <RequestBuilder units={disponiveis} unidadeFixa={unidadeFixa} />
      )}
    </>
  );
}
