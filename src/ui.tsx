import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

/** Painel sobreposto: sobe de baixo no celular, centralizado (ou lateral) no desktop. */
export function Sheet({
  open,
  onClose,
  children,
  side = "center",
  label,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  side?: "center" | "right"
  label: string
  wide?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  // onClose num ref: quem usa o Sheet costuma passar uma arrow nova a cada render. Com ela
  // nas dependências do efeito, CADA tecla digitada num input do sheet rodava o efeito de
  // novo — e o `panel.focus()` abaixo roubava o foco do campo (1 letra por toque).
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current()
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // foco no painel só na ABERTURA, e só se nada lá dentro já tem o foco
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  const pos =
    side === "right"
      ? "items-end md:items-stretch md:justify-end"
      : "items-end md:items-center md:justify-center"
  const shape =
    side === "right"
      ? "max-h-[94dvh] w-full rounded-t-3xl md:h-full md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-3xl"
      : `max-h-[94dvh] w-full rounded-t-3xl md:rounded-3xl ${wide ? "md:max-w-2xl" : "md:max-w-lg"}`
  return (
    <div className={`fixed inset-0 z-50 flex ${pos}`} role="dialog" aria-modal="true" aria-label={label}>
      <div className="anim-fade absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={`anim-sheet relative flex flex-col overflow-hidden border border-line bg-coal-2 shadow-2xl outline-none ${shape}`}
      >
        {children}
      </div>
    </div>
  )
}

export function CloseButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Fechar"
      className={`grid size-10 place-items-center rounded-full bg-black/55 text-cream backdrop-blur transition hover:bg-black/75 ${className}`}
    >
      <X size={20} />
    </button>
  )
}

export function Stepper({
  value,
  onChange,
  min = 1,
  size = "md",
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  size?: "sm" | "md"
}) {
  const b = size === "sm" ? "size-8 text-lg" : "size-11 text-xl"
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-coal-3">
      <button type="button" aria-label="Diminuir" className={`${b} grid place-items-center text-gold-2 disabled:opacity-40`} onClick={() => onChange(value - 1)} disabled={value <= min}>
        −
      </button>
      <span className={`min-w-8 text-center font-semibold tabular-nums ${size === "sm" ? "text-sm" : ""}`} aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="Aumentar" className={`${b} grid place-items-center text-gold-2 disabled:opacity-40`} onClick={() => onChange(value + 1)} disabled={value >= 99}>
        +
      </button>
    </div>
  )
}

export function Crown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 18h18l-1.5-10-4.5 4-3-6-3 6-4.5-4L3 18Zm0 2h18v1.5H3V20Z" />
    </svg>
  )
}
