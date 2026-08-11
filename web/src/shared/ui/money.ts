// Máscara de moeda: o usuário digita centavos da direita para a esquerda
// (1 → 0,01 · 12345 → 123,45) e o valor numérico fica guardado em reais.
export const digitsToAmount = (input: string): number => {
  const digits = input.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
};

export const amountToMasked = (amount: number | string | undefined): string => {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value) || value === 0) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const maskWhileTyping = (input: string): string => {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  const cents = digits.padStart(3, "0");
  const whole = cents.slice(0, -2);
  return `${Number(whole).toLocaleString("pt-BR")},${cents.slice(-2)}`;
};

// Quantidade aceita até três casas (contratos usam 14,3).
export const parseQuantity = (input: string): number => {
  const normalized = input.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
};

export const formatQuantity = (value: number | string | undefined): string => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount === 0) return "";
  return amount.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
};
