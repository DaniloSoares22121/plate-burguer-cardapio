import { fileUrl } from "./api"
import logo from "../assets/logo.webp"

const seeds = import.meta.glob("../assets/seed/*.webp", { eager: true, import: "default" }) as Record<string, string>
const SEED: Record<string, string> = {}
for (const [path, url] of Object.entries(seeds)) {
  const key = path.split("/").pop()!.replace(/\.webp$/, "")
  SEED[key] = url
}

export const SEED_KEYS = Object.keys(SEED).sort()
export const LOGO = logo

/** image = "seed:jantinha" (foto embutida), nome de arquivo enviado pelo admin, ou URL. */
export function imageUrl(image: string | undefined | null): string | null {
  const v = (image || "").trim()
  if (!v) return null
  if (v.startsWith("seed:")) return SEED[v.slice(5)] ?? null
  if (/^https?:\/\//.test(v) || v.startsWith("/")) return v
  return fileUrl(v)
}
