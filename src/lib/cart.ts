import { useSyncExternalStore } from "react"
import type { CartItem } from "./types"

const KEY = "plate:cart:v1"
let items: CartItem[] = load()
const subs = new Set<() => void>()

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function commit(next: CartItem[]) {
  items = next
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f())
}

export const cart = {
  get: () => items,
  subscribe(fn: () => void) {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  add(item: Omit<CartItem, "key">) {
    // mesmo produto + mesma opção + mesma observação = soma quantidade
    const ex = (item.extras || []).map((e) => `${e.name}x${e.qty}`).sort().join(",")
    const key = [item.productId, item.size || "", item.choice?.name || "", ex, item.note.trim()].join("|")
    const found = items.find((i) => i.key === key)
    if (found) commit(items.map((i) => (i.key === key ? { ...i, qty: Math.min(99, i.qty + item.qty) } : i)))
    else commit([...items, { ...item, key }])
  },
  setQty(key: string, qty: number) {
    if (qty <= 0) commit(items.filter((i) => i.key !== key))
    else commit(items.map((i) => (i.key === key ? { ...i, qty: Math.min(99, qty) } : i)))
  },
  remove(key: string) {
    commit(items.filter((i) => i.key !== key))
  },
  clear() {
    commit([])
  },
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(cart.subscribe, cart.get, cart.get)
}
