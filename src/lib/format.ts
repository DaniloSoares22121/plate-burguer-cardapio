const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** "R$ 10,00" com espaço normal (o Intl usa NBSP, que fica estranho em texto do WhatsApp). */
export function brl(v: number): string {
  return fmt.format(Number.isFinite(v) ? v : 0).replace(/ /g, " ")
}

/** Aceita "10", "10,5", "10.50", "R$ 1.234,56" → número (NaN se inválido). */
export function parseMoney(s: string | number | null | undefined): number {
  if (typeof s === "number") return s
  const t = String(s ?? "").replace(/[^\d,.-]/g, "").trim()
  if (!t) return NaN
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t
  const n = Number(norm)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

export function moneyInput(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return ""
  return v.toFixed(2).replace(".", ",")
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "")
}

/** (62) 99999-9999 enquanto digita */
export function maskPhone(s: string): string {
  const d = onlyDigits(s).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ""
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function dateTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
