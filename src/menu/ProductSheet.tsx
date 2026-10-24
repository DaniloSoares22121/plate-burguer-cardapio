import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, ChevronDown, Plus } from "lucide-react"
import { isAddonCategory } from "../lib/catalog"
import { cart } from "../lib/cart"
import { brl } from "../lib/format"
import { imageUrl } from "../lib/images"
import { iconCat, Placeholder } from "./ProductCard"
import type { Category } from "../lib/types"
import { round } from "../lib/order"
import type { Catalog, Product } from "../lib/types"
import { CloseButton, Sheet, Stepper } from "../ui"

export default function ProductSheet({ product, catalog, onClose }: { product: Product | null; catalog: Catalog; onClose: () => void }) {
  const [size, setSize] = useState<string>("")
  const [choice, setChoice] = useState<string>("")
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState("")
  const [tried, setTried] = useState(false)
  const [extras, setExtras] = useState<Record<string, number>>({})

  const addonGroups = useMemo(() => addonGroupsFor(product, catalog), [product, catalog])

  useEffect(() => {
    setExtras({})
    setSize(product?.sizes.length === 1 ? product.sizes[0].label : "")
    setChoice("")
    setQty(1)
    setNote("")
    setTried(false)
  }, [product])

  if (!product) return <Sheet open={false} onClose={onClose} label="">{null}</Sheet>
  const p = product
  const own = catalog.categories.find((c) => c.id === p.categoryId)
  const catExtras = own?.extras || []
  const sz = p.sizes.find((s) => s.label === size)
  const opt = p.choice?.options.find((o) => o.name === choice)
  const base = p.sizes.length ? sz?.price ?? null : p.price ?? 0
  const picked = catExtras.map((x) => ({ ...x, qty: extras[`x|${x.name}`] || 0 })).filter((x) => x.qty > 0)
  const pickedTotal = round(picked.reduce((t, x) => t + x.price * x.qty, 0))
  const unit = base === null ? null : round(base + (opt?.extra || 0) + pickedTotal)
  const needSize = p.sizes.length > 0 && !sz
  const needChoice = !!p.choice?.required && !opt
  const blocked = !catalog.settings.open
  const extrasTotal = round(addonGroups.reduce((t, g) => t + g.items.reduce((s2, a) => s2 + a.price * (extras[a.key] || 0), 0), 0))
  const extrasCount = Object.entries(extras).reduce((a, [k, b]) => (k.startsWith("x|") ? a : a + b), 0)
  const setExtra = (k: string, v: number) => setExtras((x) => ({ ...x, [k]: Math.max(0, Math.min(99, v)) }))

  const add = () => {
    setTried(true)
    if (needSize || needChoice || unit === null) return
    cart.add({
      productId: p.id,
      name: p.name,
      size: sz?.label,
      choice: opt && p.choice ? { title: p.choice.title, name: opt.name, extra: opt.extra || 0 } : undefined,
      ...(picked.length ? { extras: picked } : {}),
      unitPrice: unit,
      qty,
      note: note.trim().slice(0, 200),
      image: p.image,
    })
    // cada adicional vira uma linha normal da sacola (edita/remove como qualquer item)
    for (const g of addonGroups)
      for (const a of g.items) {
        const q = extras[a.key] || 0
        if (q > 0) cart.add({ productId: a.productId, name: a.name, size: a.size, unitPrice: a.price, qty: q, note: "", image: a.image })
      }
    onClose()
  }

  return (
    <Sheet open onClose={onClose} label={p.name}>
      <div className="relative flex-1 overflow-y-auto overscroll-contain">
        <Photos p={p} own={own} />
        <div className="relative px-5 pt-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">{own?.name}</p>
          <h2 className="font-display text-[30px] uppercase leading-none text-cream">{p.name}</h2>
        </div>
        <div className="absolute right-3 top-3 z-10"><CloseButton onClick={onClose} className="!bg-black/60 backdrop-blur" /></div>
        <div className="px-5 pb-4 pt-4">
          {p.description && <p className="text-[15px] leading-relaxed text-cream/85">{p.description}</p>}
          {!p.sizes.length && <p className="price mt-2 text-2xl">{brl(p.price ?? 0)}</p>}

          {p.sizes.length > 0 && (
            <fieldset className="mt-5">
              <legend className="mb-2 flex w-full items-center justify-between">
                <span className="font-semibold text-cream">Escolha o tamanho</span>
                <Req ok={!needSize} tried={tried} />
              </legend>
              <div className="grid gap-2">
                {p.sizes.map((s) => (
                  <Option key={s.label} on={size === s.label} onClick={() => setSize(s.label)}>
                    <span className="flex-1">
                      <span className="font-semibold text-cream">{s.label === "P" ? "Pequena (P)" : s.label === "G" ? "Grande (G)" : s.label}</span>
                      {s.desc && <span className="block text-[13px] text-muted">{s.desc}</span>}
                    </span>
                    <span className="price">{brl(s.price)}</span>
                  </Option>
                ))}
              </div>
            </fieldset>
          )}

          {p.choice && (
            <fieldset className="mt-5">
              <legend className="mb-2 flex w-full items-center justify-between">
                <span className="font-semibold text-cream">{p.choice.title}</span>
                {p.choice.required ? <Req ok={!needChoice} tried={tried} /> : <span className="text-xs text-muted">Opcional</span>}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {p.choice.options.map((o) => (
                  <Option key={o.name} on={choice === o.name} onClick={() => setChoice(choice === o.name && !p.choice?.required ? "" : o.name)}>
                    <span className="flex-1 font-medium text-cream">{o.name}</span>
                    {!!o.extra && <span className="text-sm text-gold-2">+{brl(o.extra)}</span>}
                  </Option>
                ))}
              </div>
            </fieldset>
          )}

          {catExtras.length > 0 && (
            <section className="mt-6" aria-label="Adicionais">
              <div className="mb-2 flex items-end justify-between">
                <h3 className="font-semibold text-cream">Adicionais</h3>
                {picked.length > 0 ? <span className="text-xs font-semibold text-gold-2">+{brl(pickedTotal)} por unidade</span> : <span className="text-xs text-muted">Opcional</span>}
              </div>
              <ul className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-coal-3/40">
                {catExtras.map((x) => {
                  const k = `x|${x.name}`
                  const q = extras[k] || 0
                  return (
                    <li key={k} className={`flex items-center gap-3 px-3 py-1.5 ${q ? "bg-gold/[.08]" : ""}`}>
                      <span className="min-w-0 flex-1 text-[15px] font-medium text-cream">{x.name}</span>
                      <span className="text-sm text-gold-2">+{brl(x.price)}</span>
                      <MiniStep label={x.name} q={q} set={(v) => setExtra(k, Math.min(v, 5))} />
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {addonGroups.length > 0 && (
            <section className="mt-6" aria-label="Adicionais">
              <div className="mb-1 flex items-end justify-between">
                <h3 className="h-display text-lg text-gold">Peça também</h3>
                {extrasCount > 0 ? (
                  <span className="text-xs font-semibold text-gold-2">
                    {extrasCount} {extrasCount === 1 ? "adicional" : "adicionais"} · +{brl(extrasTotal)}
                  </span>
                ) : (
                  <span className="text-xs text-muted">Opcional</span>
                )}
              </div>
              <p className="mb-3 text-[13px] text-muted">Toque no + para juntar ao mesmo pedido.</p>
              <div className="space-y-4">
                {addonGroups.map((g) => (
                  <AddonGroup key={g.id} name={g.name} items={g.items} extras={extras} setExtra={setExtra} />
                ))}
              </div>
            </section>
          )}

          <label className="mt-5 block">
            <span className="label">Alguma observação?</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Ex.: sem cebola, bem assada…"
              className="field resize-none"
            />
          </label>
        </div>
      </div>
      <div className="border-t border-line bg-coal-2/95 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
        {tried && (needSize || needChoice) && (
          <p className="err mb-2" role="alert">
            {needSize ? "Escolha o tamanho para continuar." : `Escolha uma opção em “${p.choice?.title}”.`}
          </p>
        )}
        {blocked && <p className="mb-2 text-[13px] text-ember-3">Estamos fechados agora — você pode montar a sacola, mas o envio só abre no horário de atendimento.</p>}
        <div className="flex items-center gap-3">
          <Stepper value={qty} onChange={setQty} />
          <button type="button" onClick={add} className="btn-gold flex-1 justify-between px-5 text-base">
            <span>
              Adicionar
              {extrasCount > 0 && <span className="ml-1 text-sm font-medium opacity-75">+{extrasCount}</span>}
            </span>
            <span className="font-display text-lg">{unit === null ? (extrasCount ? `+${brl(extrasTotal)}` : "") : brl(round(unit * qty + extrasTotal))}</span>
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
        on ? "border-gold bg-gold/10 shadow-glow" : "border-line bg-coal-3/60 hover:border-gold/40"
      }`}
    >
      <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${on ? "border-gold bg-gold text-coal" : "border-muted/60"}`}>
        {on && <Check size={13} strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

function Req({ ok, tried }: { ok: boolean; tried: boolean }) {
  if (ok) return <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={14} /> OK</span>
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tried ? "bg-ember text-white" : "bg-coal-4 text-cream/80"}`}>
      Obrigatório
    </span>
  )
}

type AddonItem = { key: string; productId: number; name: string; size?: string; label: string; price: number; image: string }
type AddonGroupT = { id: number; name: string; items: AddonItem[] }

function addonGroupsFor(p: Product | null, cat: Catalog): AddonGroupT[] {
  if (!p) return []
  const own = cat.categories.find((c) => c.id === p.categoryId)
  if (own && isAddonCategory(own)) return [] // na ficha de uma bebida/espetinho a lista seria ruído
  const out: AddonGroupT[] = []
  for (const c of cat.categories) {
    if (!isAddonCategory(c)) continue
    const items: AddonItem[] = []
    for (const x of cat.products) {
      if (x.categoryId !== c.id || x.id === p.id || !x.available) continue
      if (x.sizes.length) {
        for (const sz of x.sizes)
          items.push({ key: `${x.id}|${sz.label}`, productId: x.id, name: x.name, size: sz.label, label: `${x.name} ${sz.label}`, price: sz.price, image: x.image })
      } else if (!(x.choice && x.choice.required)) {
        // produto com escolha obrigatória só entra pela ficha dele (a escolha não cabe aqui)
        items.push({ key: `${x.id}|`, productId: x.id, name: x.name, label: x.name, price: x.price ?? 0, image: x.image })
      }
    }
    if (items.length) out.push({ id: c.id, name: c.name, items })
  }
  // bebida é o adicional mais pedido: vem primeiro; o resto segue a ordem do cardápio
  const beb = (g: AddonGroupT) => (/bebida/i.test(g.name) ? 0 : 1)
  return out.sort((a, b) => beb(a) - beb(b))
}

const VISIBLE = 4

function AddonGroup({ name, items, extras, setExtra }: { name: string; items: AddonItem[]; extras: Record<string, number>; setExtra: (k: string, v: number) => void }) {
  const [all, setAll] = useState(false)
  // o que já foi escolhido nunca fica escondido atrás do "ver mais"
  const shown = all ? items : items.filter((a, i) => i < VISIBLE || (extras[a.key] || 0) > 0)
  const hidden = items.length - shown.length
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream/60">{name}</p>
      <ul className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-coal-3/40">
        {shown.map((a) => {
          const q = extras[a.key] || 0
          return (
            <li key={a.key} className={`flex items-center gap-3 px-2.5 py-1.5 transition ${q ? "bg-gold/[.07]" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[15px] font-medium leading-tight text-cream">
                  <span className="truncate">{a.name}</span>
                  {a.size && <span className="shrink-0 rounded-md bg-gold/15 px-1.5 py-px text-[11px] font-bold text-gold-2">{a.size}</span>}
                </p>
                <p className="price text-sm leading-tight">{brl(a.price)}</p>
              </div>
              {q === 0 ? (
                <button
                  type="button"
                  onClick={() => setExtra(a.key, 1)}
                  aria-label={`Adicionar ${a.label}`}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/50 text-gold-2 transition hover:bg-gold hover:text-coal"
                >
                  <Plus size={17} strokeWidth={2.5} />
                </button>
              ) : (
                <div className="flex shrink-0 items-center rounded-full bg-gold text-coal">
                  <button type="button" aria-label={`Diminuir ${a.label}`} className="grid size-9 place-items-center text-lg font-bold" onClick={() => setExtra(a.key, q - 1)}>
                    −
                  </button>
                  <span className="min-w-5 text-center text-sm font-bold tabular-nums">{q}</span>
                  <button type="button" aria-label={`Aumentar ${a.label}`} className="grid size-9 place-items-center text-lg font-bold" onClick={() => setExtra(a.key, q + 1)}>
                    +
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {(hidden > 0 || (all && items.length > VISIBLE)) && (
        <button type="button" onClick={() => setAll(!all)} className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-gold-2 hover:underline">
          {all ? "Ver menos" : `Ver mais ${hidden}`}
          <ChevronDown size={16} className={all ? "rotate-180" : ""} />
        </button>
      )}
    </div>
  )
}

function MiniStep({ label, q, set }: { label: string; q: number; set: (v: number) => void }) {
  if (q === 0)
    return (
      <button type="button" onClick={() => set(1)} aria-label={`Adicionar ${label}`} className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/50 text-gold-2 transition hover:bg-gold hover:text-coal">
        <Plus size={17} strokeWidth={2.5} />
      </button>
    )
  return (
    <div className="flex shrink-0 items-center rounded-full bg-gold text-coal">
      <button type="button" aria-label={`Diminuir ${label}`} className="grid size-9 place-items-center text-lg font-bold" onClick={() => set(q - 1)}>
        −
      </button>
      <span className="min-w-5 text-center text-sm font-bold tabular-nums">{q}</span>
      <button type="button" aria-label={`Aumentar ${label}`} className="grid size-9 place-items-center text-lg font-bold" onClick={() => set(q + 1)}>
        +
      </button>
    </div>
  )
}

/** Foto de capa + galeria (desliza no celular; miniaturas embaixo). */
function Photos({ p, own }: { p: Product; own?: Category }) {
  const urls = [p.image, ...(p.gallery || [])].map((x) => imageUrl(x)).filter((x): x is string => !!x)
  const [i, setI] = useState(0)
  useEffect(() => setI(0), [p.id])
  if (!urls.length)
    return <Placeholder cat={iconCat(p, own)} className="aspect-[16/9] w-full" size={48} />
  const go = (n: number) => setI((n + urls.length) % urls.length)
  let x0 = 0
  return (
    <div className="relative">
      <div
        className="relative aspect-[4/3] w-full overflow-hidden bg-coal-3 sm:aspect-[16/11]"
        onTouchStart={(e) => (x0 = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - x0
          if (Math.abs(dx) > 40 && urls.length > 1) go(i + (dx < 0 ? 1 : -1))
        }}
      >
        {urls.map((u, k) => (
          <img key={u} src={u} alt={k ? `${p.name} — foto ${k + 1}` : p.name} className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${k === i ? "opacity-100" : "opacity-0"}`} loading={k ? "lazy" : "eager"} />
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-coal-2 to-transparent" />
        {urls.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {urls.map((u, k) => (
              <button key={u} type="button" aria-label={`Foto ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-gold" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
