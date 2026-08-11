import { auth } from "@/auth";

const baseUrl = (process.env.API_URL ?? "http://localhost:8004").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

// Chamadas saem do servidor Next com o token guardado na sessão NextAuth.
export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const token = options.token ?? (await auth())?.accessToken;

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message ?? "Falha na comunicação com a API",
      data?.contexto ?? data?.erros,
    );
  }
  return data as T;
};

export const apiBaseUrl = baseUrl;
