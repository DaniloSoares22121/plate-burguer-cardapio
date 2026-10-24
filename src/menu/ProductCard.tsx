import { Plus } from "lucide-react"
import { productPriceLabel } from "../lib/catalog"
import { brl } from "../lib/format"
import { CategoryIcon } from "../lib/icons"
import { imageUrl } from "../lib/images"
import type { Category, Product } from "../lib/types"

/** Ícone do cartão sem foto: pelo nome do produto quando ajuda (frango, pepino), senão o da categoria. */
export function iconCat(p: Product, cat?: Category): Category | undefined {
  const n = p.name.toLowerCase()
  const icon = /chicken|frango/.test(n) ? "frango" : /pepino|picles/.test(n) ? "salada" : /batata/.test(n) ? "batata" : ""
  return icon && cat ? { ...cat, icon } : cat
}

/** Sem foto: cartão desenhado com o ícone da categoria (nada de foto de banco de imagens). */
export function Placeholder({ cat, className = "", size = 34 }: { cat?: Category; className?: string; size?: number }) {
  return (
    <div className={`ph grid place-items-center ${className}`} aria-hidden="true">
      <span className="grid place-items-center rounded-full border border-gold/40 bg-black/35 p-3 text-gold-2 shadow-[0_0_0_6px_rgba(244,122,31,.08)]">
        <CategoryIcon c={cat} size={size} />
      </span>
    </div>
  )
}

export default function ProductCard({ p, cat, big = false, onOpen }: { p: Product; cat?: Category; big?: boolean; onOpen: (p: Product) => void }) {
  const img = imageUrl(p.image)
  const off = !p.available
  const price = productPriceLabel(p, brl)

  if (big) {
    return (
      <button
        type="button"
        disabled={off}
        onClick={() => onOpen(p)}
        className="panel group flex flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:border-gold/70 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-coal-3">
          {img ? (
            <img src={img} alt={p.name} loading="lazy" className={`size-full object-cover transition duration-500 group-hover:scale-[1.04] ${off ? "grayscale" : ""}`} />
          ) : (
            <Placeholder cat={iconCat(p, cat)} className="size-full" size={44} />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-coal-2 to-transparent" />
          {off && <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cream">Esgotado</span>}
        </div>
        <div className="flex flex-1 flex-col p-4 pt-1">
          <h3 className="h-display text-2xl leading-none text-cream">{p.name}</h3>
          {p.description && <p className="mt-1.5 line-clamp-3 text-sm leading-snug text-muted">{p.description}</p>}
          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
            <span className="price text-2xl">{price}</span>
            {!off && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-b from-gold-2 to-gold px-3.5 py-2 text-sm font-bold text-coal shadow-glow">
                <Plus size={16} strokeWidth={2.75} /> Adicionar
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={off}
      onClick={() => onOpen(p)}
      className="panel group flex min-h-[112px] items-stretch gap-3 p-3 text-left transition hover:border-gold/60 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-display text-[19px] leading-tight tracking-[0.01em] text-cream">{p.name}</h3>
        {p.description && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{p.description}</p>}
        <div className="mt-auto pt-2">
          {off ? <span className="text-sm font-bold uppercase tracking-wide text-muted">Esgotado</span> : <span className="price text-xl">{price}</span>}
        </div>
      </div>
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-coal-3 sm:size-28">
        {img ? (
          <img src={img} alt={p.name} loading="lazy" className={`size-full object-cover ${off ? "grayscale" : ""}`} />
        ) : (
          <Placeholder cat={iconCat(p, cat)} className="size-full" size={26} />
        )}
        {!off && (
          <span className="absolute bottom-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-gradient-to-b from-gold-2 to-gold text-coal shadow-lg">
            <Plus size={18} strokeWidth={2.75} />
          </span>
        )}
      </div>
    </button>
  )
}
