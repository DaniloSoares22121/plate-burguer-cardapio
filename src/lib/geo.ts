import type { GeoPoint } from "./types"

export class GeoError extends Error {}

/** Posição do aparelho, com mensagem amigável pra cada falha. */
export function currentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      reject(new GeoError("Seu navegador só libera a localização em conexão segura. Escolha o bairro na lista."))
      return
    }
    if (!("geolocation" in navigator)) {
      reject(new GeoError("Este aparelho não informa a localização. Escolha o bairro na lista."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) }),
      (e) => {
        const msg =
          e.code === 1
            ? "Você não permitiu o acesso à localização. Tudo bem — escolha o bairro na lista (ou libere a localização nas configurações do navegador)."
            : e.code === 3
              ? "A localização demorou demais. Tente de novo em local aberto, ou escolha o bairro na lista."
              : "Não conseguimos pegar sua localização agora. Escolha o bairro na lista."
        reject(new GeoError(msg))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}

export type ReverseAddress = { road: string; number: string; suburb: string }

/** Endereço aproximado do ponto (OpenStreetMap/Nominatim). Uma chamada por toque; falha = null. */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseAddress | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const u =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}` + `&accept-language=pt-BR&zoom=18&addressdetails=1`
    const r = await fetch(u, { signal: ctrl.signal, headers: { Accept: "application/json" } })
    if (!r.ok) return null
    const j = (await r.json()) as { address?: Record<string, string> }
    const a = j.address || {}
    return {
      road: a.road || a.pedestrian || a.residential || "",
      number: a.house_number || "",
      suburb: a.suburb || a.neighbourhood || a.quarter || a.city_district || a.hamlet || "",
    }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}
