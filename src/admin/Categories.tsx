import { useState } from "react"
import { ArrowDown, ArrowUp, Check, ListPlus, Pencil, Plus, Trash2, X } from "lucide-react"
import { moneyInput, parseMoney } from "../lib/format"
import { CATEGORY_ICONS, CategoryIcon, categoryIconId } from "../lib/icons"
import { isAddonCategory, stripId } from "../lib/catalog"
import type { Category } from "../lib/types"
import { catalogDb, errMsg, moveItem, useAdmin } from "./ctx"
import { IconBtn } from "./Products"

export default function Categories() {
  const { catalog, token, reload, toast } = useAdmin()
  const db = catalogDb(token)
  const [name, setName] = useState("")
  const [edit, setEdit] = useState<{ id: number; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [extrasFor, setExtrasFor] = useState<number | null>(null)
  const list = catalog.categories

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      await reload()
      if (ok) toast(ok)
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const n = name.trim()
    if (!n) return
    const order = list.reduce((m, c) => Math.max(m, c.order), 0) + 10
    run(() => db.create({ type: "category", name: n.slice(0, 40), order, highlight: false }), "Categoria criada.").then(() => setName(""))
  }

  const rename = (c: Category) => {
    const n = edit?.name.trim()
    if (!n) return
    run(() => db.update(c.id, { ...stripId(c), name: n.slice(0, 40) }), "Categoria renomeada.").then(() => setEdit(null))
  }

  const remove = (c: Category) => {
    const n = catalog.products.filter((p) => p.categoryId === c.id).length
    if (n) {
      toast(`“${c.name}” tem ${n} produto${n > 1 ? "s" : ""}. Mova ou exclua os produtos antes.`, "err")
      return
    }
    if (!confirm(`Excluir a categoria “${c.name}”?`)) return
    run(() => db.remove(c.id), "Categoria excluída.")
  }

  return (
    <div className="max-w-3xl">
      <h1 className="h-display text-2xl">Categorias</h1>
      <p className="mb-4 text-sm text-muted">A ordem aqui é a ordem das abas no cardápio.</p>
      <form
        className="mb-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria (ex.: Sobremesas)" maxLength={40} aria-label="Nome da nova categoria" />
        <button className="btn-gold shrink-0" disabled={busy || !name.trim()}>
          <Plus size={18} /> Criar
        </button>
      </form>
      <ul className="space-y-2">
        {list.map((c, i) => {
          const count = catalog.products.filter((p) => p.categoryId === c.id).length
          const editing = edit?.id === c.id
          return (
            <li key={c.id} className="panel p-3 sm:p-4">
              <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <IconBtn label="Subir" disabled={i === 0 || busy} onClick={() => run(() => moveItem(list, i, -1, (it, order) => db.update(it.id, { ...stripId(it), order })))}>
                  <ArrowUp size={15} />
                </IconBtn>
                <IconBtn label="Descer" disabled={i === list.length - 1 || busy} onClick={() => run(() => moveItem(list, i, 1, (it, order) => db.update(it.id, { ...stripId(it), order })))}>
                  <ArrowDown size={15} />
                </IconBtn>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold text-coal">
                <CategoryIcon c={c} size={18} />
              </span>
              {editing ? (
                <form
                  className="flex min-w-0 flex-1 gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    rename(c)
                  }}
                >
                  <input autoFocus className="field !py-2" value={edit.name} onChange={(e) => setEdit({ id: c.id, name: e.target.value })} maxLength={40} aria-label="Novo nome" />
                  <IconBtn label="Salvar nome" onClick={() => rename(c)}>
                    <Check size={17} />
                  </IconBtn>
                  <IconBtn label="Cancelar" onClick={() => setEdit(null)}>
                    <X size={17} />
                  </IconBtn>
                </form>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-snug">{c.name}</p>
                  <p className="text-xs text-muted">{count} produto{count === 1 ? "" : "s"}</p>
                </div>
              )}
              {!editing && (
                <div className="flex shrink-0 items-center gap-1">
                  <IconBtn label={`Renomear ${c.name}`} onClick={() => setEdit({ id: c.id, name: c.name })}>
                    <Pencil size={16} />
                  </IconBtn>
                  <IconBtn label={`Excluir ${c.name}`} onClick={() => remove(c)} danger disabled={busy}>
                    <Trash2 size={16} />
                  </IconBtn>
                </div>
              )}
              </div>
              {!editing && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-cream/85">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#ffb81c]"
                      checked={!!c.highlight}
                      disabled={busy}
                      onChange={(e) => run(() => db.update(c.id, { ...stripId(c), highlight: e.target.checked }))}
                    />
                    Destaque
                  </label>
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-cream/85" title="Aparece em “Peça também” na ficha dos outros produtos">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#ffb81c]"
                      checked={isAddonCategory(c)}
                      disabled={busy}
                      onChange={(e) => run(() => db.update(c.id, { ...stripId(c), addon: e.target.checked }))}
                    />
                    Adicional
                  </label>
                  <select
                    className="rounded-lg border border-line bg-coal-3 px-2.5 py-1.5 text-sm text-cream"
                    value={categoryIconId(c)}
                    disabled={busy}
                    aria-label={`Ícone de ${c.name}`}
                    onChange={(e) => run(() => db.update(c.id, { ...stripId(c), icon: e.target.value }))}
                  >
                    {CATEGORY_ICONS.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm text-gold-2 hover:bg-coal-3" onClick={() => setExtrasFor(extrasFor === c.id ? null : c.id)}>
                    <ListPlus size={15} /> Adicionais {c.extras?.length ? `(${c.extras.length})` : ""}
                  </button>
                </div>
              )}
              {extrasFor === c.id && (
                <ExtrasEditor
                  c={c}
                  busy={busy}
                  onSave={(extras) => run(() => db.update(c.id, { ...stripId(c), extras }), "Adicionais salvos.").then(() => setExtrasFor(null))}
                  onCancel={() => setExtrasFor(null)}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ExtrasEditor({ c, busy, onSave, onCancel }: { c: Category; busy: boolean; onSave: (x: { name: string; price: number }[]) => void; onCancel: () => void }) {
  const [rows, setRows] = useState(() => (c.extras || []).map((x) => ({ name: x.name, price: moneyInput(x.price) })))
  const [err, setErr] = useState("")
  const save = () => {
    const out: { name: string; price: number }[] = []
    for (const r of rows) {
      const n = r.name.trim()
      if (!n) continue
      const p = parseMoney(r.price)
      if (!Number.isFinite(p) || p < 0) return setErr(`Preço inválido em “${n}”.`)
      out.push({ name: n.slice(0, 40), price: p })
    }
    onSave(out)
  }
  return (
    <div className="w-full basis-full space-y-2 border-t border-line/60 pt-2">
      <p className="text-xs text-muted">Extras pagos de “{c.name}”. O cliente escolhe na ficha de cada item.</p>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input className="field !py-2" value={r.name} placeholder="Ex.: Bacon" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Nome do adicional" />
          <input className="field !w-28 !py-2" inputMode="decimal" value={r.price} placeholder="0,00" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} aria-label="Preço do adicional" />
          <IconBtn label="Remover adicional" danger onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <Trash2 size={16} />
          </IconBtn>
        </div>
      ))}
      {err && <p className="err">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !min-h-[38px] text-sm" onClick={() => setRows([...rows, { name: "", price: "" }])}>
          <Plus size={16} /> Novo adicional
        </button>
        <span className="flex-1" />
        <button type="button" className="btn-ghost !min-h-[38px] text-sm" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn-gold !min-h-[38px] text-sm" onClick={save} disabled={busy}>
          Salvar
        </button>
      </div>
    </div>
  )
}
