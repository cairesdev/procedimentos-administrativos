"use client";

import { Badge, Table } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { RowActions } from "@/shared/ui/RowActions";
import { setStockPlaceActive } from "../actions";
import { StockLocationForm } from "./StockLocationForm";
import { StockPlaceForm } from "./StockPlaceForm";
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
      emptyMessage="Nenhum local cadastrado. Comece pela escola que mais recebe material."
    >
      {locations.map((location) => (
        <tr key={location.id}>
          <td>
            <strong>{location.nome}</strong>
            {location.ativo ? null : <> <Badge tone="neutral">inativo</Badge></>}
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
            <td style={{ textAlign: "right", display: "flex", gap: "8px",
              justifyContent: "flex-end" }}
            >
              {/* Dois botões porque são duas coisas: quem a escola é, e para
                  onde entregar nela. */}
              <ModalTrigger
                label="Entrega"
                title={`Local · ${location.nome}`}
                description="Vínculo com o almoxarifado, endereço de entrega e responsável."
              >
                <StockLocationForm location={location} warehouses={warehouses} />
              </ModalTrigger>
              <RowActions
                label={location.nome}
                editTitle="Editar local"
                editForm={<StockPlaceForm place={location} warehouses={warehouses} />}
                isActive={location.ativo}
                onToggleActive={setStockPlaceActive.bind(
                  null, location.id, location.nome, location.codigo, !location.ativo,
                )}
              />
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
