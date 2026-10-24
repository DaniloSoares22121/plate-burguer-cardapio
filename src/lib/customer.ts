import type { Checkout } from "./types"

/** Chaves antigas onde o cardápio lembrava os dados do cliente (só pra apagar). */
const KEY = "plate:cliente:v2"
const OLD = "plate:cliente:v1"

export const EMPTY_CHECKOUT: Checkout = {
  name: "",
  phone: "",
  mode: "entrega",
  address: "",
  extra: "",
  regionId: "",
  district: "",
  geo: null,
  payment: "",
  changeFor: "",
  noChange: false,
}

/**
 * O cardápio NÃO lembra mais os dados do cliente (decisão do dono, 12/10/2026): num celular compartilhado o pedido
 * saiu com nome, telefone e endereço de OUTRA pessoa (pedido 6779). Todo pedido começa em branco, e o que ficou
 * guardado de versões antigas é apagado na primeira abertura.
 */
export function loadCustomer(): { data: Checkout; saved: boolean } {
  clearCustomer()
  return { data: { ...EMPTY_CHECKOUT }, saved: false }
}

export function saveCustomer(_c: Checkout): void {
  /* não guarda nada neste aparelho */
}

export function clearCustomer(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(OLD)
  } catch {
    /* ignore */
  }
}
