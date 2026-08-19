/** Monograma para o selo de marca: "Procedimentos administrativos" → "PA". */
export const initials = (name: string): string =>
  name
    .split(" ")
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export const humanize = (value: string): string =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

export const toCurrency = (value: number | string): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

export const toDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export const toDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const toDocument = (value: string): string =>
  value.length === 14
    ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
