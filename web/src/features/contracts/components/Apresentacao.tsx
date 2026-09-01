import { humanize, toCurrency, toDate, toDocument } from "@/shared/ui/labels";
import { Card, SummaryGrid } from "@/shared/ui/layout";

export type DadosDoFornecedor = {
  razaoSocial: string;
  documento: string;
  endereco?: string | null;
  email?: string | null;
  telefone?: string | null;
  inscricaoEstadual?: string | null;
};

export type DadosDoProcedimento = {
  rotulo: string;
  numero: string | null;
  modalidade?: string | null;
  objeto?: string | null;
  valor?: number | null;
  data?: string | null;
};

/**
 * Quem é, e do que se trata.
 *
 * Abre a tela de contrato e a de licitação porque é a primeira pergunta de
 * quem chega: com quem a prefeitura está contratando, e por qual
 * procedimento. Antes, o CNPJ estava lá mas o endereço e o contato só existiam
 * no cadastro de fornecedores, a duas telas de distância.
 */
export const Apresentacao = ({
  fornecedor,
  procedimento,
}: {
  /** Ausente na licitação até haver contrato: ela não tem fornecedor único. */
  fornecedor?: DadosDoFornecedor;
  procedimento: DadosDoProcedimento;
}) => (
  <Card title="Apresentação">
    <SummaryGrid
      items={[
        ...(fornecedor
          ? [
            { label: "Fornecedor", value: fornecedor.razaoSocial },
            { label: "CNPJ/CPF", value: toDocument(fornecedor.documento) },
            { label: "Inscrição estadual", value: fornecedor.inscricaoEstadual ?? "—" },
            { label: "Endereço", value: fornecedor.endereco ?? "—", wide: true },
            { label: "Telefone", value: fornecedor.telefone ?? "—" },
            { label: "E-mail", value: fornecedor.email ?? "—" },
          ]
          : []),
        { label: procedimento.rotulo, value: procedimento.numero ?? "—" },
        ...(procedimento.modalidade
          ? [{ label: "Modalidade", value: humanize(procedimento.modalidade) }]
          : []),
        ...(procedimento.data
          ? [{ label: "Assinatura", value: toDate(procedimento.data) }]
          : []),
        ...(procedimento.valor !== null && procedimento.valor !== undefined
          ? [{ label: "Valor do procedimento", value: toCurrency(procedimento.valor) }]
          : []),
        { label: "Objeto", value: procedimento.objeto ?? "—", wide: true },
      ]}
    />
  </Card>
);
