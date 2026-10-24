/** Cliente do backend embutido do Brixly (/_api/*). Funciona no preview
 *  (/preview/{pid}/_api) e publicado (/_api) porque parte do BASE_URL do build. */
const raw = import.meta.env.BASE_URL || "/"
export const BASE = raw.endsWith("/") ? raw : raw + "/"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type DbRecord<T = Record<string, unknown>> = {
  id: number
  data: T
  created_at: number
  updated_at: number
}

export async function api<T = unknown>(
  action: string,
  body: Record<string, unknown> = {},
  token?: string | null,
  opts: { keepalive?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000)
  let r: Response
  try {
    r = await fetch(`${BASE}_api/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { "x-app-token": token } : {}) },
      body: JSON.stringify(body),
      keepalive: opts.keepalive,
      signal: opts.keepalive ? undefined : ctrl.signal,
    })
  } catch {
    throw new ApiError("Sem conexão. Verifique a internet e tente de novo.", 0)
  } finally {
    clearTimeout(timer)
  }
  let j: unknown = {}
  try {
    j = await r.json()
  } catch {
    /* corpo não-JSON (ex.: página de erro do proxy) */
  }
  if (!r.ok) {
    const msg = (j as { error?: unknown })?.error
    throw new ApiError(typeof msg === "string" && msg ? msg : `Erro ${r.status} no servidor.`, r.status)
  }
  return j as T
}

export async function uploadFile(file: Blob, filename: string, token: string): Promise<string> {
  const fd = new FormData()
  fd.append("file", file, filename)
  let r: Response
  try {
    r = await fetch(`${BASE}_api/upload`, { method: "POST", body: fd, headers: { "x-app-token": token } })
  } catch {
    throw new ApiError("Sem conexão para enviar a foto.", 0)
  }
  let j: { name?: string; error?: string } = {}
  try {
    j = await r.json()
  } catch {
    /* ignore */
  }
  if (!r.ok || !j.name) throw new ApiError(j.error || `Falha ao enviar a foto (${r.status}).`, r.status)
  return j.name
}

export function fileUrl(name: string): string {
  return `${BASE}_api/file/${encodeURIComponent(name)}`
}
