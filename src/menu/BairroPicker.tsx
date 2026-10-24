import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, MapPin, Search, X } from "lucide-react"
import { brl, normalize } from "../lib/format"
import { fmtKm, type DeliveryOption } from "../lib/frete"

/** Lista pesquisável de bairros (cobre o painel da sacola inteiro). */
export default function BairroPicker({
  options,
  value,
  allowOther,
  onPick,
  onClose,
}: {
  options: DeliveryOption[]
  value: string
  allowOther: boolean
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState("")
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // foco sem rolar a página no iOS
    const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 60)
    return () => clearTimeout(t)
  }, [])

  // o campo responde na hora; a lista filtra logo depois (não trava a digitação)
  const dq = useDeferredValue(q)
  const list = useMemo(() => {
    const t = normalize(dq.trim())
    if (!t) return options
    const words = t.split(/\s+/)
    return options.filter((o) => words.every((w) => o.search.includes(w)))
  }, [dq, options])

  const other = allowOther && (
    <li>
      <button
        type="button"
        onClick={() => onPick("outra")}
        className={`flex w-full items-center gap-3 bg-ember/[.06] px-4 py-2.5 text-left transition hover:bg-coal-3 ${value === "outra" ? "!bg-gold/10" : ""}`}
      >
        <MapPin size={18} className="shrink-0 text-ember-3" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-cream">Não encontrei meu bairro</span>
          <span className="block text-xs text-muted">Você digita o bairro e combinamos o frete no WhatsApp</span>
        </span>
        <span className="shrink-0 text-sm text-muted">a combinar</span>
      </button>
    </li>
  )

  return (
    <div className="anim-fade absolute inset-0 z-20 flex flex-col bg-coal-2" role="dialog" aria-label="Escolha seu bairro">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button type="button" aria-label="Voltar" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-coal-3">
          <ArrowLeft size={20} />
        </button>
        <label className="relative block flex-1">
          <span className="sr-only">Buscar bairro</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite seu bairro ou setor…"
            className="field !rounded-full !py-2.5 pl-9 pr-9"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
          />
          {q && (
            <button type="button" aria-label="Limpar" onClick={() => setQ("")} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted">
              <X size={16} />
            </button>
          )}
        </label>
      </div>
      <p className="px-4 pb-1 pt-2 text-xs text-muted">
        {list.length} {list.length === 1 ? "bairro" : "bairros"}
        {q ? ` para “${q.trim()}”` : ""}
      </p>
      <ul className="flex-1 divide-y divide-line/50 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {other}
        {list.map((o) => {
          const on = o.id === value
          return (
            <li key={o.id}>
              <button type="button" onClick={() => onPick(o.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-coal-3 ${on ? "bg-gold/10" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className={`block leading-snug ${on ? "font-semibold text-gold-2" : "text-cream"}`}>{o.name}</span>
                  {o.km !== undefined && o.fee !== null && <span className="block text-xs text-muted">≈ {fmtKm(o.km)} km</span>}
                </span>
                <span className={`shrink-0 text-sm ${o.fee === null ? "text-muted" : "price"}`}>
                  {o.fee === null ? "a combinar" : o.fee === 0 ? "grátis" : brl(o.fee)}
                </span>
                {on && <Check size={16} className="shrink-0 text-gold" />}
              </button>
            </li>
          )
        })}
        {!list.length && <li className="px-4 py-8 text-center text-sm text-muted">Nenhum bairro com esse nome. Use “Não encontrei meu bairro” acima.</li>}
      </ul>
    </div>
  )
}
