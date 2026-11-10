export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, method = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api" + path, {
    method, signal, credentials: "same-origin", cache: "no-store",
    headers: method === "GET" ? undefined : {
      "x-mail-action": "1", ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error ?? "O serviço está indisponível. Tente novamente.");
  return data as T;
}

export const dateText = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short",
}).format(new Date(value));

export function messageFor(error: unknown) {
  return error instanceof ApiError ? error.message : "Falha na conexão. Tente novamente.";
}
