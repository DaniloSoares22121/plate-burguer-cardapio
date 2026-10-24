import { api, type DbRecord } from "./api"
import { normalize } from "./format"
import type { Catalog, Category, Product, Region, Settings } from "./types"

export const COLLECTION = "catalog"
export const DEFAULT_WHATSAPP = "5562992513487"

export const DEFAULT_SETTINGS: Omit<Settings, "id"> = {
  type: "settings",
  whatsapp: DEFAULT_WHATSAPP,
  open: true,
  closedMessage: "Estamos fechados no momento. Volte mais tarde!",
  hoursText: "",
  minOrder: 0,
  otherRegion: true,
  delivery: true,
  pickup: true,
  deliveryTime: "",
  instagram: "",
  alsoWhatsapp: false,
  paperWidth: 80,
  autoPrint: false,
  receiptFooter: "Obrigado pela preferência! Volte sempre.",
  storeLat: null,
  storeLon: null,
  storeAddress: "",
  perKm: 2,
  routeFactor: 1.3,
  minFee: 0,
  maxKm: 0,
}

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d)
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d)

function parseChoice(v: unknown): Product["choice"] {
  if (!v || typeof v !== "object") return null
  const c = v as Record<string, unknown>
  if (!Array.isArray(c.options)) return null
  const options = (c.options as Record<string, unknown>[])
    .filter((o) => o && str(o.name))
    .map((o) => ({ name: str(o.name), extra: num(o.extra) }))
  if (!options.length) return null
  return { title: str(c.title, "Escolha"), required: !!c.required, options }
}

export function parseCatalog(records: DbRecord[]): Catalog {
  const categories: Category[] = []
  const products: Product[] = []
  const regions: Region[] = []
  let settings: Settings | null = null
  for (const r of records) {
    const d = (r.data || {}) as Record<string, unknown>
    if (d.type === "category") {
      categories.push({
        id: r.id,
        type: "category",
        name: str(d.name, "Categoria"),
        order: num(d.order, r.id),
        highlight: !!d.highlight,
        ...(typeof d.addon === "boolean" ? { addon: d.addon } : {}),
        icon: str(d.icon),
        extras: Array.isArray(d.extras)
          ? (d.extras as Record<string, unknown>[]).filter((x) => x && str(x.name) && typeof x.price === "number").map((x) => ({ name: str(x.name), price: num(x.price) }))
          : [],
      })
    } else if (d.type === "product") {
      products.push({
        id: r.id,
        type: "product",
        categoryId: num(d.categoryId),
        name: str(d.name, "Produto"),
        description: str(d.description),
        price: typeof d.price === "number" ? d.price : null,
        sizes: Array.isArray(d.sizes)
          ? (d.sizes as Record<string, unknown>[])
              .filter((s) => s && typeof s.price === "number")
              .map((s) => ({ label: str(s.label, "?"), desc: str(s.desc), price: num(s.price) }))
          : [],
        choice: parseChoice(d.choice),
        image: str(d.image),
        gallery: Array.isArray(d.gallery) ? (d.gallery as unknown[]).map((x) => str(x)).filter(Boolean).slice(0, 8) : [],
        available: d.available !== false,
        order: num(d.order, r.id),
      })
    } else if (d.type === "region") {
      regions.push({
        id: r.id,
        type: "region",
        name: str(d.name, "Região"),
        fee: typeof d.fee === "number" ? d.fee : null,
        order: num(d.order, r.id),
      })
    } else if (d.type === "settings" && !settings) {
      settings = { ...DEFAULT_SETTINGS, ...(d as Partial<Settings>), id: r.id, type: "settings" }
    }
  }
  const byOrder = <T extends { order: number; id: number }>(a: T, b: T) => a.order - b.order || a.id - b.id
  categories.sort(byOrder)
  products.sort(byOrder)
  regions.sort(byOrder)
  return { categories, products, regions, settings: settings ?? { ...DEFAULT_SETTINGS, id: 0 } }
}

export async function fetchCatalogRecords(): Promise<DbRecord[]> {
  const j = await api<{ records: DbRecord[] }>("db/list", { collection: COLLECTION, limit: 2000, order: "asc" })
  return j.records || []
}

const CACHE_KEY = "plate:catalog:v1"

export function readCache(): Catalog | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Catalog) : null
  } catch {
    return null
  }
}

export function writeCache(c: Catalog): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* sem storage: tudo bem */
  }
}

export function stripId<T extends { id: number }>(o: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...o }
  delete copy.id
  return copy as Omit<T, "id">
}

/** Categoria entra nos "Adicionais"? Sem o campo gravado (dados antigos), decide pelo nome:
 *  sucos, cremes, refrigerantes e bebidas sim; o resto não. */
export function isAddonCategory(c: Category): boolean {
  if (typeof c.addon === "boolean") return c.addon
  const n = normalize(c.name)
  return /bebida|refri|suco|creme/.test(n)
}

export function productPriceLabel(p: Product, brl: (n: number) => string): string {
  if (p.sizes.length) {
    const min = Math.min(...p.sizes.map((s) => s.price))
    return p.sizes.length === 1 ? brl(p.sizes[0].price) : `a partir de ${brl(min)}`
  }
  return brl(p.price ?? 0)
}
