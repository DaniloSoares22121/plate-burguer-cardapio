import { useMemo, useState, type ReactNode } from "react"
import { Loader2, MapPin, Wand2 } from "lucide-react"
import { BAIRROS } from "../data/bairros"
import { brl, moneyInput, parseMoney } from "../lib/format"
import { fmtKm, parseLatLon, quoteKm, storeLocation } from "../lib/frete"
import type { Settings } from "../lib/types"
import { errMsg, useAdmin } from "./ctx"
import { useSaveSettings } from "./SettingsTab"

const num = (s: string) => {
  const v = Number(String(s).trim().replace(",", "."))
  return Number.isFinite(v) ? v : NaN
}

export default function DistanceSettings() {
  const { catalog, reload, toast } = useAdmin()
  const save = useSaveSettings()
  const s = catalog.settings
  const [f, setF] = useState({
    address: s.storeAddress || "",
    lat: typeof s.storeLat === "number" ? String(s.storeLat) : "",
    lon: typeof s.storeLon === "number" ? String(s.storeLon) : "",
    perKm: moneyInput(s.perKm ?? 2),
    factor: String(s.routeFactor ?? 1.3).replace(".", ","),
    minFee: s.minFee ? moneyInput(s.minFee) : "",
    maxKm: s.maxKm ? String(s.maxKm).replace(".", ",") : "",
  })
  const [link, setLink] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const on = !!storeLocation(s)

  const extract = () => {
    const ll = parseLatLon(link)
    if (!ll) {
      toast("Não achei coordenadas nesse link. Abra o ponto no Google Maps e copie o link da barra de endereço (com @-16.3…,-48.9…).", "err")
      return
    }
    setF((x) => ({ ...x, lat: String(ll.lat), lon: String(ll.lon) }))
    toast("Coordenadas extraídas. Confira e salve.")
  }

  // prévia com os valores DIGITADOS (antes de salvar)
  const draft: Settings | null = useMemo(() => {
    const lat = num(f.lat)
    const lon = num(f.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return {
      ...s,
      storeLat: lat,
      storeLon: lon,
      perKm: parseMoney(f.perKm),
      routeFactor: num(f.factor),
      minFee: f.minFee.trim() ? parseMoney(f.minFee) : 0,
      maxKm: f.maxKm.trim() ? num(f.maxKm) : 0,
    }
  }, [f, s])
  const preview = useMemo(() => {
    if (!draft || !storeLocation(draft)) return []
    const rows = BAIRROS.map(([name, lat, lon]) => ({ name, q: quoteKm(draft, lat, lon) })).sort((a, b) => (a.q.km ?? 0) - (b.q.km ?? 0))
    if (!rows.length) return []
    const pick = [rows[0], rows[Math.floor(rows.length * 0.25)], rows[Math.floor(rows.length / 2)], rows[Math.floor(rows.length * 0.75)], rows[rows.length - 1]]
    return pick.filter((r, i) => pick.findIndex((x) => x.name === r.name) === i)
  }, [draft])

  const submit = async () => {
    setErr("")
    const hasLat = f.lat.trim() !== "" || f.lon.trim() !== ""
    const lat = num(f.lat)
    const lon = num(f.lon)
    if (hasLat && (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)) return setErr("Latitude/longitude inválidas (ex.: -16.3281 e -48.9534).")
    const perKm = parseMoney(f.perKm)
    if (!Number.isFinite(perKm) || perKm < 0) return setErr("Valor por km inválido.")
    const factor = num(f.factor)
    if (!Number.isFinite(factor) || factor < 1 || factor > 3) return setErr("Fator de rota deve ficar entre 1,0 e 3,0 (padrão 1,3).")
    const minFee = f.minFee.trim() ? parseMoney(f.minFee) : 0
    if (!Number.isFinite(minFee) || minFee < 0) return setErr("Frete mínimo inválido.")
    const maxKm = f.maxKm.trim() ? num(f.maxKm) : 0
    if (!Number.isFinite(maxKm) || maxKm < 0) return setErr("Raio máximo inválido.")
    setBusy(true)
    try {
      await save({
        storeAddress: f.address.trim().slice(0, 160),
        storeLat: hasLat ? lat : null,
        storeLon: hasLat ? lon : null,
        perKm,
        routeFactor: factor,
        minFee,
        maxKm,
      })
      await reload()
      toast(hasLat ? "Frete por distância salvo." : "Salvo. Sem a localização da loja, os bairros ficam “a combinar”.")
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel mb-5 space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h-display text-lg">Frete por distância</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${on ? "bg-emerald-600/20 text-emerald-400" : "bg-ember/15 text-ember-3"}`}>
          {on ? "Ligado" : "Desligado — falta a localização da loja"}
        </span>
      </div>
      <p className="text-sm text-muted">
        Com a localização da loja marcada, o cliente que tocar em “Usar minha localização” no fechamento tem o frete calculado pela distância da loja até ele × fator de rota,
        arredondado pra cima em R$ 0,50. Sem a localização, só valem as regiões cadastradas abaixo (ou “a combinar”).
      </p>

      <F label="Endereço da loja (só pra referência)">
        <input className="field" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={160} placeholder="Rua, número, bairro" />
      </F>
      <div className="rounded-xl border border-dashed border-line p-3">
        <span className="label">Colar link do Google Maps (opcional)</span>
        <div className="flex gap-2">
          <input className="field" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.google.com/maps/…@-16.33,-48.95,17z" />
          <button type="button" className="btn-ghost shrink-0" onClick={extract} disabled={!link.trim()}>
            <Wand2 size={16} /> Extrair
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Aceita links com @lat,lon ou q=lat,lon, ou as coordenadas coladas (ex.: -16.3281, -48.9534).</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <F label="Latitude">
          <input className="field" inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} placeholder="-16.3281" />
        </F>
        <F label="Longitude">
          <input className="field" inputMode="decimal" value={f.lon} onChange={(e) => setF({ ...f, lon: e.target.value })} placeholder="-48.9534" />
        </F>
      </div>
      {draft && (
        <a
          className="inline-flex items-center gap-1.5 text-sm text-gold-2 hover:underline"
          href={`https://www.google.com/maps/search/?api=1&query=${draft.storeLat},${draft.storeLon}`}
          target="_blank"
          rel="noopener"
        >
          <MapPin size={15} /> Conferir o ponto no mapa
        </a>
      )}
      <div className="grid grid-cols-2 gap-2">
        <F label="Valor por km (R$)">
          <input className="field" inputMode="decimal" value={f.perKm} onChange={(e) => setF({ ...f, perKm: e.target.value })} />
        </F>
        <F label="Fator de rota" hint="Rua não é linha reta. 1,3 = +30%.">
          <input className="field" inputMode="decimal" value={f.factor} onChange={(e) => setF({ ...f, factor: e.target.value })} />
        </F>
        <F label="Frete mínimo (R$)" hint="Vazio = sem mínimo.">
          <input className="field" inputMode="decimal" value={f.minFee} onChange={(e) => setF({ ...f, minFee: e.target.value })} placeholder="0,00" />
        </F>
        <F label="Raio máximo (km)" hint="Além disso: a combinar. Vazio = sem limite.">
          <input className="field" inputMode="decimal" value={f.maxKm} onChange={(e) => setF({ ...f, maxKm: e.target.value })} placeholder="—" />
        </F>
      </div>

      {preview.length > 0 && (
        <div className="rounded-xl bg-coal/50 p-3 text-sm">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Prévia com esses valores</p>
          <ul className="space-y-1">
            {preview.map((r) => (
              <li key={r.name} className="flex justify-between gap-3">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 text-muted">
                  {r.q.km !== undefined ? `≈ ${fmtKm(r.q.km)} km · ` : ""}
                  <span className={r.q.kind === "fee" ? "text-gold-2" : ""}>{r.q.kind === "fee" ? brl(r.q.value) : "a combinar"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {err && <p className="err">{err}</p>}
      <button type="button" className="btn-gold w-full sm:w-auto" onClick={submit} disabled={busy}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : "Salvar frete por distância"}
      </button>
    </section>
  )
}

function F({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}
