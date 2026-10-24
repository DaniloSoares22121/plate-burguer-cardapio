import { BAIRROS } from "../data/bairros"
import { normalize } from "./format"
import type { Catalog, Settings } from "./types"

/** Distância em linha reta (km) entre dois pontos. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(lat2 - lat1)
  const dLon = r(lon2 - lon1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function storeLocation(s: Settings): { lat: number; lon: number } | null {
  const lat = s.storeLat
  const lon = s.storeLon
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null
  return { lat, lon }
}

export type KmQuote = { kind: "fee"; value: number; km: number } | { kind: "combinar"; km?: number; reason: "sem-loja" | "raio" }

/** Preço por km: km de rota ≈ linha reta × fator; arredonda PRA CIMA em R$ 0,50; respeita mínimo e raio. */
export function quoteKm(s: Settings, lat: number, lon: number): KmQuote {
  const store = storeLocation(s)
  if (!store) return { kind: "combinar", reason: "sem-loja" }
  const factor = s.routeFactor && s.routeFactor > 0 ? s.routeFactor : 1.3
  const km = Math.round(haversineKm(store.lat, store.lon, lat, lon) * factor * 10) / 10
  if (s.maxKm && s.maxKm > 0 && km > s.maxKm) return { kind: "combinar", km, reason: "raio" }
  // Faixas (ex.: até 5 km R$ 6 · até 9,9 km R$ 8 · 10 km em diante R$ 12) mandam quando existem.
  const faixas = (s.faixas || []).filter((f) => typeof f.preco === "number" && f.preco >= 0)
  if (faixas.length) {
    const ord = [...faixas].sort((a, b) => (a.ateKm ?? Infinity) - (b.ateKm ?? Infinity))
    const f = ord.find((x) => x.ateKm == null || km <= x.ateKm) || ord[ord.length - 1]
    return { kind: "fee", value: Math.round(f.preco * 100) / 100, km }
  }
  const perKm = typeof s.perKm === "number" && s.perKm >= 0 ? s.perKm : 2
  const raw = Math.round(perKm * km * 100) / 100 // R$/km exato, em centavos (pedido do dono)
  const value = Math.max(s.minFee && s.minFee > 0 ? s.minFee : 0, raw)
  return { kind: "fee", value: Math.round(value * 100) / 100, km }
}

/** Uma opção do seletor de bairro no fechamento. id: "r:<id>" (região manual), "b:<nome>" (bairro), "outra". */
export type DeliveryOption = {
  id: string
  name: string
  search: string
  fee: number | null
  km?: number
  manual?: boolean
}

const optCache = new WeakMap<Catalog, DeliveryOption[]>()

/** Lista de bairros com preço — calculada UMA vez por catálogo (não a cada tecla). */
export function deliveryOptions(cat: Catalog): DeliveryOption[] {
  let v = optCache.get(cat)
  if (!v) {
    v = buildOptions(cat)
    optCache.set(cat, v)
  }
  return v
}

function buildOptions(cat: Catalog): DeliveryOption[] {
  const s = cat.settings
  const out: DeliveryOption[] = []
  const manualByName = new Map<string, (typeof cat.regions)[number]>()
  for (const r of cat.regions) manualByName.set(normalize(r.name).trim(), r)
  const usedManual = new Set<number>()
  for (const [name, lat, lon, aliases] of BAIRROS) {
    const key = normalize(name)
    const manual = manualByName.get(key) ?? (aliases || []).map((a) => manualByName.get(normalize(a))).find(Boolean)
    const search = normalize([name, ...(aliases || [])].join(" | "))
    if (manual) {
      // região cadastrada à mão com o mesmo nome manda no preço
      usedManual.add(manual.id)
      out.push({ id: `r:${manual.id}`, name, search, fee: manual.fee, manual: true })
      continue
    }
    const q = quoteKm(s, lat, lon)
    out.push({ id: `b:${name}`, name, search, fee: q.kind === "fee" ? q.value : null, km: q.km })
  }
  for (const r of cat.regions) {
    if (usedManual.has(r.id)) continue
    out.push({ id: `r:${r.id}`, name: r.name, search: normalize(r.name), fee: r.fee, manual: true })
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
  return out
}

export function findOption(cat: Catalog, id: string): DeliveryOption | null {
  if (!id || id === "outra" || id === "geo") return null
  return deliveryOptions(cat).find((o) => o.id === id) ?? null
}

/** Extrai lat/lon de um link do Google Maps (…/@-16.33,-48.95,17z, ?q=-16.33,-48.95, !3d-16.33!4d-48.95) ou de "lat, lon". */
export function parseLatLon(text: string): { lat: number; lon: number } | null {
  const t = decodeURIComponent(String(text || "")).trim()
  const pats = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // ponto marcado (mais preciso que o centro da tela)
    /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/,
  ]
  for (const re of pats) {
    const m = t.match(re)
    if (m) {
      const lat = Number(m[1].replace(",", "."))
      const lon = Number(m[2].replace(",", "."))
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon }
    }
  }
  return null
}

export function fmtKm(km: number): string {
  return km.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: km < 10 ? 1 : 0 })
}

/** Casa o bairro devolvido pelo geocoder com a nossa lista (nome ou apelido, sem acento). */
export function matchBairro(raw: string): string | null {
  const t = normalize(raw || "").replace(/^(bairro|setor)\s+/, "").trim()
  if (!t) return null
  let best: string | null = null
  for (const [name, , , aliases] of BAIRROS) {
    const cands = [name, ...(aliases || [])].map((x) => normalize(x).replace(/^(bairro|setor)\s+/, "").trim())
    if (cands.includes(t)) return name
    if (!best && cands.some((c) => c.length > 4 && (c.startsWith(t + " ") || t.startsWith(c + " ")))) best = name
  }
  return best
}
