import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { withPage, type Page } from "@/shared/api/pagination";
import type {
  Adjustment, Availability, Consumption, Intake, IntakeDetail, LocalStock, Product,
  ReceiptPlan, ReleasePlan, StockLocation, StockRequest, StockRequestSummary,
  StockReturn, StockSettings, StockTransfer, StockType, Warehouse,
  ConsumptionReport, ConsumptionReportDetail, QualityRecord,
} from "./types";

export const listWarehouses = () => apiRequest<Warehouse[]>(endpoints.warehouses);

export const listStockTypes = () => apiRequest<StockType[]>(endpoints.stockTypes);

/** Catálogo global. A busca existe porque a lista cresce entre prefeituras. */
export const listProducts = (busca?: string) =>
  apiRequest<Product[]>(
    `${endpoints.products}${busca ? `?busca=${encodeURIComponent(busca)}` : ""}`,
  );

export const getStockSettings = () => apiRequest<StockSettings>(endpoints.stockSettings);

export const listStockLocations = (almoxarifado?: string) =>
  apiRequest<StockLocation[]>(
    `${endpoints.stockLocations}${almoxarifado ? `?almoxarifado=${almoxarifado}` : ""}`,
  );

export const getLocalStock = (localId: string) =>
  apiRequest<LocalStock[]>(endpoints.localStock(localId));

export const listIntakes = (
  filtros: { almoxarifado?: string; tipo?: string; busca?: string; pagina?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filtros.almoxarifado) query.set("almoxarifado", filtros.almoxarifado);
  if (filtros.tipo) query.set("tipo", filtros.tipo);
  if (filtros.busca) query.set("busca", filtros.busca);
  withPage(query, filtros.pagina);
  return apiRequest<Page<Intake>>(
    `${endpoints.intakes}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const getIntake = (id: string) =>
  apiRequest<IntakeDetail>(`${endpoints.intakes}/${id}`);

/** Disponível = saldo dos lotes menos as reservas do mesmo almoxarifado. */
export const listAvailability = (warehouseId: string, tipo?: string) =>
  apiRequest<Availability[]>(
    `${endpoints.availability(warehouseId)}${tipo ? `?tipo=${tipo}` : ""}`,
  );

export const listStockRequests = (
  filtros: { status?: string; local?: string; almoxarifado?: string; pagina?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filtros.status) query.set("status", filtros.status);
  if (filtros.local) query.set("local", filtros.local);
  if (filtros.almoxarifado) query.set("almoxarifado", filtros.almoxarifado);
  withPage(query, filtros.pagina);
  return apiRequest<Page<StockRequestSummary>>(
    `${endpoints.stockRequests}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const getStockRequest = (id: string) =>
  apiRequest<StockRequest>(`${endpoints.stockRequests}/${id}`);

/** Plano de liberação com a distribuição FEFO já sugerida pela API. */
export const getReleasePlan = (id: string) =>
  apiRequest<ReleasePlan>(endpoints.stockRequestAction(id, "liberacao"));

export const getReceiptPlan = (id: string) =>
  apiRequest<ReceiptPlan>(endpoints.stockRequestAction(id, "recebimento"));

const comFiltros = (base: string, filtros: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) query.set(chave, valor);
  }
  return `${base}${query.size > 0 ? `?${query}` : ""}`;
};

export const listConsumption = (
  filtros: { local?: string; produto?: string; de?: string; ate?: string; pagina?: string } = {},
) => apiRequest<Page<Consumption>>(comFiltros(endpoints.consumption, filtros));

export const listReturns = (
  filtros: { status?: string; almoxarifado?: string; local?: string; pagina?: string } = {},
) => apiRequest<Page<StockReturn>>(comFiltros(endpoints.returns, filtros));

export const listTransfers = (
  filtros: { almoxarifado?: string; pagina?: string } = {},
) => apiRequest<Page<StockTransfer>>(comFiltros(endpoints.stockTransfers, filtros));

export const listAdjustments = (
  filtros: { almoxarifado?: string; local?: string; pagina?: string } = {},
) => apiRequest<Page<Adjustment>>(comFiltros(endpoints.adjustments, filtros));

export const listConsumptionReports = () =>
  apiRequest<ConsumptionReport[]>(endpoints.consumptionReports);

/** Os números do recorte, apurados agora — não os do dia em que foi criado. */
export const getConsumptionReport = (id: string) =>
  apiRequest<ConsumptionReportDetail>(`${endpoints.consumptionReports}/${id}`);

export const listQualityRecords = (
  filtros: { lote?: string; estoqueLocal?: string; tipo?: string } = {},
) => apiRequest<QualityRecord[]>(comFiltros(endpoints.quality, filtros));
