import { useState } from "react"
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { stripId } from "../lib/catalog"
import { brl, moneyInput, parseMoney } from "../lib/format"
import type { Region } from "../lib/types"
import { catalogDb, errMsg, moveItem, useAdmin } from "./ctx"
import { IconBtn } from "./Products"
import DistanceSettings from "./DistanceSettings"
import { useSaveSettings } from "./SettingsTab"

type Draft = { name: string; fee: string; combinar: boolean }
const EMPTY: Draft = { name: "", fee: "", combinar: false }

export default function Regions() {
  const { catalog, token, reload, toast } = useAdmin()
  const db = catalogDb(token)
  const saveSettings = useSaveSettings()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [edit, setEdit] = useState<(Draft & { id: number }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const list = catalog.regions
  const s = catalog.settings
  const storeOn = typeof s.storeLat === "number" && typeof s.storeLon === "number"

  const parse = (d: Draft): { name: string; fee: number | null } | string => {
    const name = d.name.trim()
    if (!name) return "Informe o nome da região ou bairro."
    if (d.combinar) return { name, fee: null }
    const fee = parseMoney(d.fee)
    if (!Number.isFinite(fee) || fee < 0) return "Informe o valor do frete (0 = grátis) ou marque “a combinar”."
    return { name, fee }
  }

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      await reload()
      if (ok) toast(ok)
      return true
    } catch (e) {
      toast(errMsg(e), "err")
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async () => {
    const v = parse(draft)
    if (typeof v === "string") return setErr(v)
    setErr("")
    const order = list.reduce((m, r) => Math.max(m, r.order), 0) + 10
    if (await run(() => db.create({ type: "region", name: v.name.slice(0, 60), fee: v.fee, order }), "Região adicionada.")) setDraft(EMPTY)
  }

  const saveEdit = async (r: Region) => {
    if (!edit) return
    const v = parse(edit)
    if (typeof v === "string") return toast(v, "err")
    if (await run(() => db.update(r.id, { ...stripId(r), name: v.name.slice(0, 60), fee: v.fee }), "Região atualizada.")) setEdit(null)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="h-display text-2xl">Frete</h1>
      <p className="mb-4 text-sm text-muted">
        No fechamento do pedido o cliente escolhe o bairro e o frete entra no total. Frete “a combinar” manda o pedido sem valor de frete, pra você combinar no WhatsApp.
      </p>

      <DistanceSettings />

      <div className="panel mb-5 space-y-3 p-4">
        <Toggle
          on={s.otherRegion}
          disabled={busy}
          onChange={(v) => run(() => saveSettings({ otherRegion: v }), v ? "Outras regiões liberadas (frete a combinar)." : "Só as regiões da lista.")}
          title="Aceitar “Não encontrei meu bairro — frete a combinar”"
          hint="Para quem não acha o bairro na lista. Recomendado deixar ligado."
        />
        <Toggle on={s.delivery} disabled={busy} onChange={(v) => run(() => saveSettings({ delivery: v }))} title="Aceitar entrega" />
        <Toggle on={s.pickup} disabled={busy} onChange={(v) => run(() => saveSettings({ pickup: v }))} title="Aceitar retirada no local" />
      </div>

      <h2 className="h-display mb-1 text-lg">Regiões com frete fixo</h2>
      <p className="mb-3 text-sm text-muted">Opcional. Um bairro cadastrado aqui com o mesmo nome da lista usa este valor no lugar do cálculo por km. Também serve pra regiões fora da lista (ex.: zona rural).</p>
      <form
        className="panel mb-5 grid gap-2 p-4 sm:grid-cols-[1fr_120px_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label className="block">
          <span className="label">Região / bairro</span>
          <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Setor Central" maxLength={60} />
        </label>
        <label className="block">
          <span className="label">Frete (R$)</span>
          <input className="field" inputMode="decimal" value={draft.fee} disabled={draft.combinar} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} placeholder="0,00" />
        </label>
        <label className="flex min-h-[48px] items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[#ffb81c]" checked={draft.combinar} onChange={(e) => setDraft({ ...draft, combinar: e.target.checked })} />
          A combinar
        </label>
        <button className="btn-gold" disabled={busy}>
          <Plus size={18} /> Adicionar
        </button>
        {err && <p className="err sm:col-span-4">{err}</p>}
      </form>

      {!list.length && (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          Nenhuma região com frete fixo.{" "}
          {storeOn ? "Os bairros usam o cálculo por km." : "Sem a localização da loja, os bairros aparecem com frete a combinar."}
        </p>
      )}
      <ul className="space-y-2">
        {list.map((r, i) =>
          edit?.id === r.id ? (
            <li key={r.id} className="panel grid gap-2 p-3 sm:grid-cols-[1fr_110px_auto_auto] sm:items-center">
              <input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label="Nome da região" />
              <input className="field" inputMode="decimal" disabled={edit.combinar} value={edit.fee} onChange={(e) => setEdit({ ...edit, fee: e.target.value })} aria-label="Frete" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[#ffb81c]" checked={edit.combinar} onChange={(e) => setEdit({ ...edit, combinar: e.target.checked })} />A combinar
              </label>
              <div className="flex">
                <IconBtn label="Salvar" onClick={() => saveEdit(r)} disabled={busy}>
                  <Check size={17} />
                </IconBtn>
                <IconBtn label="Cancelar" onClick={() => setEdit(null)}>
                  <X size={17} />
                </IconBtn>
              </div>
            </li>
          ) : (
            <li key={r.id} className="panel flex items-center gap-2 p-2.5">
              <div className="flex flex-col">
                <IconBtn label="Subir" disabled={i === 0 || busy} onClick={() => run(() => moveItem(list, i, -1, (it, order) => db.update(it.id, { ...stripId(it), order })))}>
                  <ArrowUp size={15} />
                </IconBtn>
                <IconBtn label="Descer" disabled={i === list.length - 1 || busy} onClick={() => run(() => moveItem(list, i, 1, (it, order) => db.update(it.id, { ...stripId(it), order })))}>
                  <ArrowDown size={15} />
                </IconBtn>
              </div>
              <p className="min-w-0 flex-1 truncate font-semibold">{r.name}</p>
              <span className={`shrink-0 text-sm ${r.fee === null ? "text-muted" : "price"}`}>{r.fee === null ? "a combinar" : r.fee === 0 ? "grátis" : brl(r.fee)}</span>
              <IconBtn label={`Editar ${r.name}`} onClick={() => setEdit({ id: r.id, name: r.name, fee: moneyInput(r.fee), combinar: r.fee === null })}>
                <Pencil size={16} />
              </IconBtn>
              <IconBtn
                label={`Excluir ${r.name}`}
                danger
                disabled={busy}
                onClick={() => confirm(`Excluir a região “${r.name}”?`) && run(() => db.remove(r.id), "Região excluída.")}
              >
                <Trash2 size={16} />
              </IconBtn>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

export function Toggle({ on, onChange, title, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; title: string; hint?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 text-left disabled:opacity-60">
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-coal-4"}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  )
}
