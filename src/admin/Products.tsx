import { useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { uploadFile } from "../lib/api"
import { stripId } from "../lib/catalog"
import { brl, moneyInput, parseMoney } from "../lib/format"
import { imageUrl, SEED_KEYS } from "../lib/images"
import { CategoryIcon } from "../lib/icons"
import type { Product, Size } from "../lib/types"
import { CloseButton, Sheet } from "../ui"
import { catalogDb, errMsg, moveItem, shrinkImage, useAdmin } from "./ctx"

export default function Products() {
  const { catalog, token, reload, toast } = useAdmin()
  const db = catalogDb(token)
  const [editing, setEditing] = useState<Product | "new" | null>(null)
  const [newCat, setNewCat] = useState<number | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const orphan = catalog.products.filter((p) => !catalog.categories.some((c) => c.id === p.categoryId))
  const groups = [
    ...catalog.categories.map((c) => ({ id: c.id, name: c.name, items: catalog.products.filter((p) => p.categoryId === c.id) })),
    ...(orphan.length ? [{ id: -1, name: "Sem categoria", items: orphan }] : []),
  ]

  const toggle = async (p: Product) => {
    setBusy(p.id)
    try {
      await db.update(p.id, { ...stripId(p), available: !p.available })
      await reload()
      toast(p.available ? `“${p.name}” marcado como esgotado.` : `“${p.name}” disponível de novo.`)
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setBusy(null)
    }
  }

  const move = async (list: Product[], i: number, dir: -1 | 1) => {
    setBusy(list[i].id)
    try {
      await moveItem(list, i, dir, (it, order) => db.update(it.id, { ...stripId(it), order }))
      await reload()
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setBusy(null)
    }
  }

  const remove = async (p: Product) => {
    if (!confirm(`Excluir “${p.name}” do cardápio? Isso não pode ser desfeito.`)) return
    setBusy(p.id)
    try {
      await db.remove(p.id)
      await reload()
      toast("Produto excluído.")
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h-display text-2xl">Produtos</h1>
          <p className="text-sm text-muted">{catalog.products.length} itens no cardápio · toque no interruptor para marcar como esgotado</p>
        </div>
        <button
          type="button"
          className="btn-gold hidden lg:inline-flex"
          onClick={() => {
            setNewCat(catalog.categories[0]?.id ?? null)
            setEditing("new")
          }}
          disabled={!catalog.categories.length}
        >
          <Plus size={18} /> Novo produto
        </button>
        {/* celular: botão flutuante acima das abas, como em app */}
        <button
          type="button"
          className={`fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] right-4 z-30 ${editing ? "hidden" : "grid"} size-14 place-items-center rounded-2xl bg-gold text-coal shadow-[0_12px_30px_-8px_rgba(0,0,0,.9)] active:scale-95 disabled:opacity-50 lg:hidden`}
          onClick={() => {
            setNewCat(catalog.categories[0]?.id ?? null)
            setEditing("new")
          }}
          disabled={!catalog.categories.length}
          aria-label="Novo produto"
        >
          <Plus size={26} />
        </button>
      </div>
      {!catalog.categories.length && <p className="panel p-4 text-muted">Crie uma categoria primeiro (aba Categorias).</p>}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.id}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="h-display text-lg text-gold">{g.name}</h2>
              {g.id > 0 && (
                <button
                  type="button"
                  className="text-sm text-muted hover:text-cream"
                  onClick={() => {
                    setNewCat(g.id)
                    setEditing("new")
                  }}
                >
                  + adicionar aqui
                </button>
              )}
            </div>
            {!g.items.length && <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Nenhum produto nesta categoria.</p>}
            <ul className="space-y-2 xl:grid xl:grid-cols-2 xl:gap-2 xl:space-y-0">
              {g.items.map((p, i) => {
                return (
                  <li key={p.id} className={`panel flex flex-wrap items-center gap-x-3 gap-y-1 p-2.5 sm:flex-nowrap ${p.available ? "" : "opacity-70"}`}>
                    {imageUrl(p.image) ? (
                      <img src={imageUrl(p.image)!} alt="" className="size-14 shrink-0 rounded-lg bg-coal-3 object-cover" />
                    ) : (
                      <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-gold text-coal">
                        <CategoryIcon c={catalog.categories.find((c) => c.id === p.categoryId)} size={22} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{p.name}</p>
                      <p className="text-sm text-gold-2">
                        {p.sizes.length ? p.sizes.map((s) => `${s.label} ${brl(s.price)}`).join(" · ") : brl(p.price ?? 0)}
                        {p.choice && <span className="text-muted"> · {p.choice.title}</span>}
                      </p>
                    </div>
                    <div className="flex w-full items-center justify-end gap-1 border-t border-line/60 pt-1.5 sm:w-auto sm:border-0 sm:pt-0">
                      <Switch on={p.available} onClick={() => toggle(p)} disabled={busy === p.id} label={p.available ? "Disponível" : "Esgotado"} />
                      <span className="flex-1 sm:hidden" />
                      <IconBtn label="Subir" onClick={() => move(g.items, i, -1)} disabled={i === 0 || busy !== null}>
                        <ArrowUp size={16} />
                      </IconBtn>
                      <IconBtn label="Descer" onClick={() => move(g.items, i, 1)} disabled={i === g.items.length - 1 || busy !== null}>
                        <ArrowDown size={16} />
                      </IconBtn>
                      <IconBtn label={`Editar ${p.name}`} onClick={() => setEditing(p)}>
                        <Pencil size={16} />
                      </IconBtn>
                      <IconBtn label={`Excluir ${p.name}`} onClick={() => remove(p)} danger disabled={busy === p.id}>
                        <Trash2 size={16} />
                      </IconBtn>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {editing && <ProductEditor product={editing === "new" ? null : editing} defaultCategory={newCat} onClose={() => setEditing(null)} />}
    </div>
  )
}

export function Switch({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={onClick} disabled={disabled} className="flex shrink-0 items-center gap-2 disabled:opacity-50">
      <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-emerald-500" : "bg-coal-4"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className={`text-xs font-medium ${on ? "text-emerald-400" : "text-ember-3"}`}>{on ? "Ativo" : "Esgotado"}</span>
    </button>
  )
}

export function IconBtn({ children, label, onClick, disabled, danger }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-coal-3 disabled:opacity-30 ${danger ? "hover:text-ember-3" : "hover:text-cream"}`}
    >
      {children}
    </button>
  )
}

type Draft = {
  name: string
  description: string
  categoryId: number
  mode: "unico" | "tamanhos"
  price: string
  sizes: { label: string; desc: string; price: string }[]
  hasChoice: boolean
  choiceTitle: string
  choiceRequired: boolean
  options: { name: string; extra: string }[]
  image: string
  available: boolean
}

function toDraft(p: Product | null, cat: number): Draft {
  return {
    name: p?.name ?? "",
    description: p?.description ?? "",
    categoryId: p?.categoryId ?? cat,
    mode: p?.sizes.length ? "tamanhos" : "unico",
    price: p && !p.sizes.length ? moneyInput(p.price) : "",
    sizes: p?.sizes.length
      ? p.sizes.map((s) => ({ label: s.label, desc: s.desc ?? "", price: moneyInput(s.price) }))
      : [
          { label: "P", desc: "", price: "" },
          { label: "G", desc: "", price: "" },
        ],
    hasChoice: !!p?.choice,
    choiceTitle: p?.choice?.title ?? "Escolha uma opção",
    choiceRequired: p?.choice?.required ?? true,
    options: p?.choice?.options.map((o) => ({ name: o.name, extra: o.extra ? moneyInput(o.extra) : "" })) ?? [{ name: "", extra: "" }],
    image: p?.image ?? "",
    available: p?.available ?? true,
  }
}

function ProductEditor({ product, defaultCategory, onClose }: { product: Product | null; defaultCategory: number | null; onClose: () => void }) {
  const { catalog, token, reload, toast } = useAdmin()
  const db = catalogDb(token)
  const [d, setD] = useState<Draft>(() => toDraft(product, defaultCategory ?? catalog.categories[0]?.id ?? 0))
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const img = imageUrl(d.image)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setUploading(true)
    try {
      const { blob, name } = await shrinkImage(f)
      const saved = await uploadFile(blob, name, token)
      set("image", saved)
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setErr("")
    const name = d.name.trim()
    if (!name) return setErr("Dê um nome ao produto.")
    if (!catalog.categories.some((c) => c.id === d.categoryId)) return setErr("Escolha a categoria.")
    let price: number | null = null
    let sizes: Size[] = []
    if (d.mode === "unico") {
      price = parseMoney(d.price)
      if (!Number.isFinite(price) || price < 0) return setErr("Informe o preço (ex.: 24,90).")
    } else {
      const rows = d.sizes.filter((s) => s.label.trim() || s.price.trim())
      if (!rows.length) return setErr("Adicione pelo menos um tamanho.")
      for (const s of rows) {
        const v = parseMoney(s.price)
        if (!s.label.trim()) return setErr("Todo tamanho precisa de um nome (ex.: P, G).")
        if (!Number.isFinite(v) || v < 0) return setErr(`Informe o preço do tamanho ${s.label}.`)
        sizes.push({ label: s.label.trim().slice(0, 20), desc: s.desc.trim().slice(0, 60), price: v })
      }
    }
    let choice: Product["choice"] = null
    if (d.hasChoice) {
      const options = d.options
        .filter((o) => o.name.trim())
        .map((o) => ({ name: o.name.trim().slice(0, 40), extra: Number.isFinite(parseMoney(o.extra)) ? parseMoney(o.extra) : 0 }))
      if (!options.length) return setErr("Adicione as opções de escolha ou desligue a escolha.")
      choice = { title: d.choiceTitle.trim() || "Escolha uma opção", required: d.choiceRequired, options }
    }
    const siblings = catalog.products.filter((p) => p.categoryId === d.categoryId && p.id !== product?.id)
    const order =
      product && product.categoryId === d.categoryId ? product.order : (siblings.reduce((m, p) => Math.max(m, p.order), 0) || 0) + 10
    const data = {
      type: "product",
      categoryId: d.categoryId,
      name: name.slice(0, 80),
      description: d.description.trim().slice(0, 400),
      price,
      sizes,
      choice,
      image: d.image,
      gallery: d.image === (product?.image ?? "") ? product?.gallery ?? [] : [],
      available: d.available,
      order,
    }
    setSaving(true)
    try {
      if (product) await db.update(product.id, data)
      else await db.create(data)
      await reload()
      toast(product ? "Produto atualizado." : "Produto criado.")
      onClose()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onClose={onClose} label={product ? "Editar produto" : "Novo produto"} wide>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="h-display text-xl">{product ? "Editar produto" : "Novo produto"}</h2>
        <CloseButton onClick={onClose} className="!bg-coal-3" />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex gap-4">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-xl border border-line bg-coal-3">
            <img src={img || undefined} alt="" className={`size-full ${img ? "object-cover" : "object-contain p-2 opacity-40"}`} />
            {uploading && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <Loader2 className="animate-spin" />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label className="btn-ghost cursor-pointer !justify-start text-sm">
              <ImagePlus size={17} /> {d.image ? "Trocar foto" : "Enviar foto"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <select className="field !py-2 text-sm" value={d.image.startsWith("seed:") ? d.image : ""} onChange={(e) => e.target.value && set("image", e.target.value)} aria-label="Usar uma foto do cardápio">
              <option value="">Usar foto já cadastrada…</option>
              {SEED_KEYS.map((k) => (
                <option key={k} value={`seed:${k}`}>
                  {k.replace(/-/g, " ")}
                </option>
              ))}
            </select>
            {d.image && (
              <button type="button" className="self-start text-sm text-muted hover:text-ember-3" onClick={() => set("image", "")}>
                Remover foto
              </button>
            )}
          </div>
        </div>

        <L label="Nome">
          <input className="field" value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Ex.: Sr Zé" />
        </L>
        <L label="Descrição">
          <textarea className="field resize-none" rows={3} value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={400} placeholder="Blend bovino 110g, queijo cheddar…" />
        </L>
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Categoria">
            <select className="field" value={d.categoryId} onChange={(e) => set("categoryId", Number(e.target.value))}>
              {catalog.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </L>
          <L label="Situação">
            <select className="field" value={d.available ? "1" : "0"} onChange={(e) => set("available", e.target.value === "1")}>
              <option value="1">Disponível</option>
              <option value="0">Esgotado</option>
            </select>
          </L>
        </div>

        <div className="rounded-xl border border-line p-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Seg on={d.mode === "unico"} onClick={() => set("mode", "unico")}>
              Preço único
            </Seg>
            <Seg on={d.mode === "tamanhos"} onClick={() => set("mode", "tamanhos")}>
              Tamanhos / porções
            </Seg>
          </div>
          {d.mode === "unico" ? (
            <L label="Preço (R$)">
              <input className="field" inputMode="decimal" value={d.price} onChange={(e) => set("price", e.target.value)} placeholder="0,00" />
            </L>
          ) : (
            <div className="space-y-2">
              {d.sizes.map((s, i) => (
                <div key={i} className="grid grid-cols-[64px_1fr_96px_36px] items-center gap-2">
                  <input className="field !px-2 text-center" value={s.label} maxLength={20} onChange={(e) => set("sizes", d.sizes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="P" aria-label="Tamanho" />
                  <input className="field" value={s.desc} maxLength={60} onChange={(e) => set("sizes", d.sizes.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} placeholder="serve 1 pessoa (opcional)" aria-label="Descrição do tamanho" />
                  <input className="field !px-2" inputMode="decimal" value={s.price} onChange={(e) => set("sizes", d.sizes.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} placeholder="0,00" aria-label="Preço" />
                  <IconBtn label="Remover tamanho" onClick={() => set("sizes", d.sizes.filter((_, j) => j !== i))} danger>
                    <X size={16} />
                  </IconBtn>
                </div>
              ))}
              <button type="button" className="text-sm text-gold-2 hover:underline" onClick={() => set("sizes", [...d.sizes, { label: "", desc: "", price: "" }])}>
                + adicionar tamanho
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line p-3">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" className="size-4 accent-[#ffb81c]" checked={d.hasChoice} onChange={(e) => set("hasChoice", e.target.checked)} />
            Cliente escolhe uma opção (ex.: ponto da carne)
          </label>
          {d.hasChoice && (
            <div className="mt-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <input className="field" value={d.choiceTitle} onChange={(e) => set("choiceTitle", e.target.value)} placeholder="Título (ex.: Escolha uma opção)" aria-label="Título da escolha" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-[#ffb81c]" checked={d.choiceRequired} onChange={(e) => set("choiceRequired", e.target.checked)} />
                  Obrigatório
                </label>
              </div>
              <p className="text-xs text-muted">Opções (acréscimo em R$ é opcional):</p>
              {d.options.map((o, i) => (
                <div key={i} className="grid grid-cols-[1fr_96px_36px] items-center gap-2">
                  <input className="field" value={o.name} onChange={(e) => set("options", d.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Nome da opção" aria-label="Opção" />
                  <input className="field !px-2" inputMode="decimal" value={o.extra} onChange={(e) => set("options", d.options.map((x, j) => (j === i ? { ...x, extra: e.target.value } : x)))} placeholder="+0,00" aria-label="Acréscimo" />
                  <IconBtn label="Remover opção" onClick={() => set("options", d.options.filter((_, j) => j !== i))} danger>
                    <X size={16} />
                  </IconBtn>
                </div>
              ))}
              <button type="button" className="text-sm text-gold-2 hover:underline" onClick={() => set("options", [...d.options, { name: "", extra: "" }])}>
                + adicionar opção
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-line px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
        {err && <p className="err mb-2" role="alert">{err}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-gold flex-1" onClick={save} disabled={saving || uploading}>
            {saving ? <Loader2 className="animate-spin" size={18} /> : "Salvar produto"}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function L({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${on ? "bg-gold text-coal" : "bg-coal-3 text-cream/80 hover:text-cream"}`}>
      {children}
    </button>
  )
}
