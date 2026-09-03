import { Button } from "@/shared/ui/button";
import { Toolbar } from "@/shared/ui/layout";

/** Primeiro e último dia do mês corrente — o recorte que a maioria quer. */
export const mesCorrente = () => {
  const hoje = new Date();
  const primeiro = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
  const ultimo = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  return {
    inicio: primeiro.toISOString().slice(0, 10),
    fim: ultimo.toISOString().slice(0, 10),
  };
};

/**
 * Os filtros do relatório, num formulário GET.
 *
 * `method="get"` de propósito: o recorte vira query string, e o endereço passa
 * a descrever o relatório. Assim ele pode ser recarregado, favoritado, mandado
 * por mensagem para o colega e reaberto amanhã — com os números de amanhã, que
 * é o comportamento certo para uma consulta. Formulário com JavaScript daria o
 * mesmo resultado na tela e um endereço que não leva a lugar nenhum.
 */
export const ReportFilterBar = ({
  inicio,
  fim,
  children,
}: {
  inicio: string;
  fim: string;
  /** Os filtros que variam por relatório — unidade, fornecedor, setor. */
  children?: React.ReactNode;
}) => (
  <form method="get">
    <Toolbar>
      <label style={{ display: "grid", gap: "4px", fontSize: "12px" }}>
        De
        <input type="date" name="inicio" defaultValue={inicio} required />
      </label>
      <label style={{ display: "grid", gap: "4px", fontSize: "12px" }}>
        Até
        <input type="date" name="fim" defaultValue={fim} required />
      </label>

      {children}

      <Button type="submit" variant="secondary">
        Aplicar
      </Button>
    </Toolbar>
  </form>
);
