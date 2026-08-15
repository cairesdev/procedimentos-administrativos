import { Toolbar } from "@/shared/ui/layout";
import { Button } from "@/shared/ui/button";
import type { AssetLocation } from "../types";

const STATUSES = [
  { value: "ATIVO", label: "Ativo" },
  { value: "EM_AVERIGUACAO", label: "Em averiguação" },
  { value: "BAIXADO", label: "Baixado" },
];

// Formulário GET: filtra sem JavaScript, o estado fica na URL.
export const AssetFilters = ({
  locations,
  selectedLocation,
  selectedStatus,
}: {
  locations: AssetLocation[];
  selectedLocation?: string;
  selectedStatus?: string;
}) => (
  <form method="get">
    <Toolbar>
      <select name="local" defaultValue={selectedLocation ?? ""} aria-label="Local">
        <option value="">Todos os locais</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.codigo} · {location.nome}
          </option>
        ))}
      </select>

      <select name="status" defaultValue={selectedStatus ?? ""} aria-label="Situação">
        <option value="">Todas as situações</option>
        {STATUSES.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>

      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
    </Toolbar>
  </form>
);
