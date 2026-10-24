import { brl, dateTime, onlyDigits } from "./format"
import { findOption, fmtKm, quoteKm } from "./frete"
import type { CartItem, Catalog, Checkout, Order } from "./types"

/** "Escolha o espeto" → "Espeto" (fica natural no pedido). */
export function choiceLabel(title: string): string {
  const t = title.replace(/^\s*escolha\s+(o|a|os|as|um|uma|seu|sua)?\s*/i, "").trim() || title
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function round(n: number): number {
  return Math.round(n * 100) / 100
}

export function cartSubtotal(items: CartItem[]): number {
  return round(items.reduce((s, i) => s + i.unitPrice * i.qty, 0))
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.qty, 0)
}

export type Frete =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "fee"; value: number; region: string; km?: number }
  | { kind: "combinar"; region: string }

export function computeFrete(c: Checkout, cat: Catalog): Frete {
  if (c.mode !== "entrega") return { kind: "none" }
  if (!c.regionId) return { kind: "pending" }
  if (c.regionId === "outra") return { kind: "combinar", region: "" }
  if (c.regionId === "geo") {
    if (!c.geo) return { kind: "pending" }
    // ponto exato do aparelho → mesma regra dos bairros (R$/km, arredondamento, mínimo, raio)
    const q = quoteKm(cat.settings, c.geo.lat, c.geo.lon)
    const label = c.district.trim() || "Localização atual"
    return q.kind === "fee" ? { kind: "fee", value: q.value, region: label, km: q.km } : { kind: "combinar", region: label }
  }
  const o = findOption(cat, c.regionId)
  if (!o) return { kind: "pending" }
  if (o.fee === null) return { kind: "combinar", region: o.name }
  return { kind: "fee", value: o.fee, region: o.name, km: o.km }
}

/** Bairro escolhido na lista vira o bairro do endereço; "outra"/"geo" usam o texto do cliente. */
export function isListedBairro(c: Checkout): boolean {
  return c.mode === "entrega" && !!c.regionId && c.regionId !== "outra" && c.regionId !== "geo"
}

export function parseChange(s: string): number {
  const t = s.replace(/[^\d,.]/g, "")
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t)
  return Number.isFinite(n) ? n : NaN
}

export function validateCheckout(c: Checkout, cat: Catalog, subtotal: number): Record<string, string> {
  const e: Record<string, string> = {}
  if (c.name.trim().length < 2) e.name = "Informe seu nome."
  const ph = onlyDigits(c.phone)
  if (ph.length < 10 || ph.length > 11) e.phone = "Informe um telefone com DDD."
  if (c.mode === "entrega") {
    if (!c.regionId || (c.regionId === "geo" && !c.geo)) e.regionId = "Use sua localização ou escolha o bairro."
    else if (c.regionId === "outra" && !c.district.trim()) e.district = "Informe o bairro."
    const addr = c.address.trim()
    if (!addr) e.address = "Informe a rua e o número."
    else if (!/\d|\bs\/?n\b/i.test(addr)) e.address = "Faltou o número (ou escreva S/N)."
  }
  if (!c.payment) e.payment = "Escolha a forma de pagamento."
  if (c.payment === "dinheiro" && !c.noChange) {
    const v = parseChange(c.changeFor)
    if (!c.changeFor.trim() || !Number.isFinite(v)) {
      e.changeFor = "Informe o valor para troco ou marque que não precisa."
    } else {
      const fr = computeFrete(c, cat)
      const total = subtotal + (fr.kind === "fee" ? fr.value : 0)
      if (v < total) e.changeFor = `O valor precisa ser maior que o total (${brl(total)}).`
    }
  }
  const min = cat.settings.minOrder || 0
  if (min > 0 && subtotal < min) e.min = `Pedido mínimo de ${brl(min)} (sem contar o frete).`
  return e
}

export function newOrderNumber(now = Date.now()): string {
  const d = new Date(now)
  const base = (d.getHours() * 60 + d.getMinutes()) % 100
  const rnd = Math.floor(Math.random() * 100)
  return String(base * 100 + rnd).padStart(4, "0")
}

export function paymentLabel(c: Checkout): string {
  if (c.payment === "dinheiro") {
    if (c.noChange) return "Dinheiro (não precisa de troco)"
    const v = parseChange(c.changeFor)
    return `Dinheiro — troco para ${Number.isFinite(v) ? brl(v) : c.changeFor.trim()}`
  }
  if (c.payment === "cartao") return c.mode === "entrega" ? "Cartão na entrega" : "Cartão na retirada"
  return "Pix"
}

export function buildOrder(items: CartItem[], c: Checkout, cat: Catalog, number: string, now = Date.now()): Order {
  const subtotal = cartSubtotal(items)
  const fr = computeFrete(c, cat)
  const fee = c.mode === "entrega" ? (fr.kind === "fee" ? fr.value : null) : 0
  const listed = isListedBairro(c)
  return {
    number,
    createdAt: now,
    status: "novo",
    customer: { name: c.name.trim(), phone: c.phone.trim() },
    mode: c.mode,
    address:
      c.mode === "entrega"
        ? {
            street: c.address.trim(),
            number: "",
            district: listed && (fr.kind === "fee" || fr.kind === "combinar") ? fr.region : c.district.trim(),
            complement: c.extra.trim(),
            reference: "",
            region: c.regionId === "outra" ? "Não encontrado na lista" : "",
            ...(c.geo ? { lat: round6(c.geo.lat), lon: round6(c.geo.lon) } : {}),
          }
        : undefined,
    fee,
    ...(fr.kind === "fee" && fr.km !== undefined ? { km: fr.km } : {}),
    items: items.map((i) => ({
      name: i.name,
      size: i.size,
      choice: i.choice ? `${choiceLabel(i.choice.title)}: ${i.choice.name}${i.choice.extra ? ` (+${brl(i.choice.extra)})` : ""}` : undefined,
      ...(i.extras && i.extras.length ? { extras: i.extras.map(extraText) } : {}),
      qty: i.qty,
      unitPrice: i.unitPrice,
      note: i.note || undefined,
    })),
    subtotal,
    total: round(subtotal + (fee ?? 0)),
    payment: paymentLabel(c),
    notes: "",
  }
}

export function extraText(e: { name: string; qty: number; price: number }): string {
  return `${e.qty > 1 ? `${e.qty}x ` : ""}${e.name} (+${brl(round(e.price * e.qty))})`
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

export function mapsLink(lat: number, lon: number): string {
  return `https://maps.google.com/?q=${round6(lat)},${round6(lon)}`
}

/** Texto do pedido pro WhatsApp. Sem emoji de propósito: alguns WhatsApp Desktop/Web
 *  trocam emoji vindo pelo wa.me por "?". Negrito com *...* funciona em todos. */
export function orderMessage(o: Order, restaurant = "PLATE BURGUER"): string {
  const L: string[] = []
  L.push(`*NOVO PEDIDO — ${restaurant}*`)
  L.push(`Pedido nº ${o.number} · ${dateTime(o.createdAt)}`)
  L.push("")
  L.push("*ITENS*")
  for (const it of o.items) {
    const size = it.size ? ` (${it.size})` : ""
    L.push(`${it.qty}x ${it.name}${size} — ${brl(round(it.unitPrice * it.qty))}`)
    if (it.choice) L.push(`   • ${it.choice}`)
    for (const e of it.extras || []) L.push(`   + ${e}`)
    if (it.qty > 1) L.push(`   • ${brl(it.unitPrice)} cada`)
    if (it.note) L.push(`   • Obs.: ${it.note}`)
  }
  L.push("")
  L.push(`Subtotal: ${brl(o.subtotal)}`)
  if (o.mode === "entrega") {
    if (o.fee === null) {
      L.push("Frete: a combinar")
      L.push(`*Total: ${brl(o.total)} + frete*`)
    } else {
      L.push(`Frete: ${o.fee === 0 ? "grátis" : brl(o.fee)}${o.km !== undefined ? ` (≈ ${fmtKm(o.km)} km)` : ""}`)
      L.push(`*Total: ${brl(o.total)}*`)
    }
  } else {
    L.push(`*Total: ${brl(o.total)}*`)
  }
  L.push("")
  L.push("*CLIENTE*")
  L.push(`Nome: ${o.customer.name}`)
  L.push(`Telefone: ${o.customer.phone}`)
  L.push("")
  if (o.mode === "entrega" && o.address) {
    const a = o.address
    L.push("*ENTREGA*")
    L.push(a.number ? `${a.street}, ${a.number}` : a.street)
    if (a.district) L.push(`Bairro: ${a.district}${a.region ? ` (${a.region.toLowerCase()})` : ""}`)
    if (a.complement) L.push(`Compl./referência: ${a.complement}`)
    if (a.reference) L.push(`Referência: ${a.reference}`)
    if (typeof a.lat === "number" && typeof a.lon === "number") L.push(`Localização: ${mapsLink(a.lat, a.lon)}`)
  } else {
    L.push("*RETIRADA NO LOCAL*")
  }
  L.push("")
  L.push("*PAGAMENTO*")
  L.push(o.payment)
  if (o.notes) {
    L.push("")
    L.push("*OBSERVAÇÕES*")
    L.push(o.notes)
  }
  return L.join("\n")
}

export function waLink(phone: string, text: string): string {
  const p = onlyDigits(phone) || "5562992513487"
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`
}
