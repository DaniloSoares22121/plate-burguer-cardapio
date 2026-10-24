import { createContext, useContext } from "react"
import { api, type DbRecord } from "../lib/api"
import { COLLECTION } from "../lib/catalog"
import type { Catalog } from "../lib/types"

export type Admin = {
  token: string
  catalog: Catalog
  reload: () => Promise<void>
  toast: (msg: string, kind?: "ok" | "err") => void
  logout: () => void
  email: string
}

export const AdminCtx = createContext<Admin | null>(null)
export function useAdmin(): Admin {
  const v = useContext(AdminCtx)
  if (!v) throw new Error("AdminCtx ausente")
  return v
}

export function catalogDb(token: string) {
  return {
    create: (data: Record<string, unknown>) => api<DbRecord>("db/create", { collection: COLLECTION, data }, token),
    update: (id: number, data: Record<string, unknown>) => api<DbRecord>("db/update", { collection: COLLECTION, id, data }, token),
    remove: (id: number) => api("db/delete", { collection: COLLECTION, id }, token),
  }
}

/** Reordena `list` movendo o item idx em dir (-1/+1) e grava só o que mudou (ordem = 10, 20, 30…). */
export async function moveItem<T extends { id: number; order: number }>(
  list: T[],
  idx: number,
  dir: -1 | 1,
  save: (item: T, order: number) => Promise<unknown>,
): Promise<void> {
  const j = idx + dir
  if (j < 0 || j >= list.length) return
  const arr = list.slice()
  ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
  const jobs: Promise<unknown>[] = []
  arr.forEach((it, i) => {
    const want = (i + 1) * 10
    if (it.order !== want) jobs.push(save(it, want))
  })
  await Promise.all(jobs)
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado."
}

/** Reduz a foto no navegador antes de enviar (celular manda 4000px / 5MB). */
export async function shrinkImage(file: File, max = 1400): Promise<{ blob: Blob; name: string }> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("canvas")
    ctx.drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85))
    if (!blob) throw new Error("toBlob")
    return { blob, name: "foto.jpg" }
  } catch {
    return { blob: file, name: file.name || "foto.jpg" }
  }
}
