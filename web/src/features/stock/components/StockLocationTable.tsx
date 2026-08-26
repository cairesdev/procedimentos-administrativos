"use client";

import { Badge, Table } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { StockLocationForm } from "./StockLocationForm";
import type { StockLocation, Warehouse } from "../types";

const cnpjFormatado = (cnpj: string) =>
  cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export const StockLocationTable = ({
  locations,
  warehouses,
  canWrite,
}: {
  locations: StockLocation[];
  warehouses: Warehouse[];
  canWrite: boolean;
}) => {
  const colunas = ["Local", "Almoxarifado", "CNPJ", "Endereço", "Responsável"];

  return (
    <Table
      columns={canWrite ? [...colunas, ""] : colunas}
      isEmpty={locations.length === 0}
      emptyMessage="Nenhum local cadastrado. Os locais vêm do módulo de patrimônio."
    >
      {locations.map((location) => (
        <tr key={location.id}>
          <td>
            <strong>{location.nome}</strong>
            <br />
            <small>{location.codigo}</small>
          </td>
          <td>
            {location.almoxarifadoNome ?? (
              <Badge tone="warning">sem almoxarifado</Badge>
            )}
          </td>
          <td>{location.cnpj ? cnpjFormatado(location.cnpj) : "—"}</td>
          <td>{location.endereco ?? "—"}</td>
          <td>{location.responsavel ?? "—"}</td>
          {canWrite ? (
            <td style={{ textAlign: "right" }}>
              <ModalTrigger
                label="Editar"
                title={`Local · ${location.nome}`}
                description="Vínculo com o almoxarifado, endereço de entrega e responsável."
              >
                <StockLocationForm location={location} warehouses={warehouses} />
              </ModalTrigger>
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
