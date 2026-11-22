export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem("ts_token")),
  set: (t: string) => localStorage.setItem("ts_token", t),
  clear: () => localStorage.removeItem("ts_token"),
};

interface Opts { method?: string; body?: unknown; form?: FormData }

export async function api<T>(path: string, { method, body, form }: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, {
    method: method ?? (body !== undefined || form ? "POST" : "GET"),
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || res.statusText);
  return data as T;
}
