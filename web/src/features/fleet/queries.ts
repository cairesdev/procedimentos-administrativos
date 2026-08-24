import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { withPage, type Page } from "@/shared/api/pagination";
import type {
  Driver, Maintenance, Refuel, ScheduleRow, Trip, TripDetail, UsageRow, Vehicle,
} from "./types";

export const listVehicles = () => apiRequest<Vehicle[]>(endpoints.vehicles);

export const listDrivers = () => apiRequest<Driver[]>(endpoints.drivers);

export const listTrips = (
  filters: { status?: string; veiculo?: string; pagina?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.veiculo) query.set("veiculo", filters.veiculo);
  withPage(query, filters.pagina);
  return apiRequest<Page<Trip>>(`${endpoints.trips}${query.size > 0 ? `?${query}` : ""}`);
};

export const getTrip = (id: string) => apiRequest<TripDetail>(`${endpoints.trips}/${id}`);

export const listMaintenances = (
  filters: { veiculo?: string; abertas?: boolean; pagina?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filters.veiculo) query.set("veiculo", filters.veiculo);
  if (filters.abertas !== undefined) query.set("abertas", String(filters.abertas));
  withPage(query, filters.pagina);
  return apiRequest<Page<Maintenance>>(
    `${endpoints.maintenances}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const listRefuels = (tripId: string) =>
  apiRequest<Refuel[]>(endpoints.refuels(tripId));

export const getSchedule = (de: string, ate: string) =>
  apiRequest<ScheduleRow[]>(`${endpoints.fleetSchedule}?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`);

export const getUsageReport = (de: string, ate: string) =>
  apiRequest<UsageRow[]>(`${endpoints.fleetUsageReport}?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`);
