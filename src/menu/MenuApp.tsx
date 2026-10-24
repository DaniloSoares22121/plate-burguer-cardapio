import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bike, Clock, Instagram, MessageCircle, Search, ShoppingBag, X } from "lucide-react"
import { fetchCatalogRecords, parseCatalog, readCache, writeCache } from "../lib/catalog"
import { useCart } from "../lib/cart"
import { brl, normalize, onlyDigits } from "../lib/format"
import { LOGO } from "../lib/images"
import { cartCount, cartSubtotal } from "../lib/order"
import type { Catalog, Product } from "../lib/types"
import { CategoryIcon } from "../lib/icons"
import CartDrawer from "./CartDrawer"
import ProductCard from "./ProductCard"
import ProductSheet from "./ProductSheet"

function useCatalog() {
  const [cat, setCat] = useState<Catalog | null>(() => readCache())
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const c = parseCatalog(await fetchCatalogRecords())
      setCat(c)
      writeCache(c)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o cardápio.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
    // volta pra aba depois de um tempo → atualiza preços/esgotados
    const onVis = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])
  return { cat, error, loading, reload: load }
}

export default function MenuApp() {
  const { cat, error, loading, reload } = useCatalog()
  const items = useCart()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<number | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  const sections = useMemo(() => {
    if (!cat) return []
    return cat.categories
      .map((c) => ({ cat: c, products: cat.products.filter((p) => p.categoryId === c.id) }))
      .filter((s) => s.products.length)
  }, [cat])

  const results = useMemo(() => {
    const q = normalize(query.trim())
    if (!q || !cat) return null
    return cat.products.filter((p) => normalize(`${p.name} ${p.description}`).includes(q))
  }, [query, cat])

  useEffect(() => {
    if (active === null && sections[0]) setActive(sections[0].cat.id)
  }, [sections, active])

  // scroll-spy das abas
  useEffect(() => {
    if (results || !sections.length) return
    const els = sections.map((s) => document.getElementById(`cat-${s.cat.id}`)).filter(Boolean) as HTMLElement[]
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(Number(vis[0].target.getAttribute("data-cat")))
      },
      { rootMargin: "-120px 0px -60% 0px" },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [sections, results])

  useEffect(() => {
    if (active === null) return
    const tab = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`)
    tab?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
  }, [active])

  const goTo = (id: number) => {
    setQuery("")
    requestAnimationFrame(() => {
      document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      setActive(id)
    })
  }

  const s = cat?.settings
  const count = cartCount(items)
  const subtotal = cartSubtotal(items)
  const wa = onlyDigits(s?.whatsapp || "") || "5562992513487"

  return (
    <div className="min-h-dvh pb-28">
      {/* ── Topo ── */}
      <header className="hero relative overflow-hidden border-b-4 border-gold/80 text-cream">
        <div className="wrap relative flex items-center gap-4 pb-6 pt-5 md:gap-8 md:pb-10 md:pt-8">
          <img src={LOGO} alt="Plate Burguer — Qualidade artesanal" width={512} height={512} className="size-28 shrink-0 rounded-full drop-shadow-[0_10px_24px_rgba(0,0,0,.7)] sm:size-36 md:size-48" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-gold-2 md:text-xs">Hamburgueria artesanal</p>
            <h1 className="mt-1 font-display text-[34px] uppercase leading-[0.9] text-cream sm:text-5xl md:text-6xl">
              Plate <span className="text-gold">Burguer</span>
            </h1>
            <p className="mt-1.5 text-sm font-medium text-cream/75 md:text-base">
              Pão brioche, blend 110g e molho do chef.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${s.open ? "bg-black/50 text-cream ring-1 ring-white/10" : "bg-ember-2 text-white"}`}>
                  <span className={`size-2 rounded-full ${s.open ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" : "bg-white/70"}`} />
                  {s.open ? "Aberto agora" : "Fechado agora"}
                </span>
              )}
              {s?.hoursText && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-cream ring-1 ring-white/10">
                  <Clock size={13} /> {s.hoursText}
                </span>
              )}
              {s?.deliveryTime && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-cream ring-1 ring-white/10">
                  <Bike size={13} /> {s.deliveryTime}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {s && !s.open && (
        <div className="border-b border-ember/40 bg-gradient-to-r from-ember-2/35 via-ember-2/20 to-transparent">
          <div className="wrap flex items-start gap-3 py-3 text-sm">
            <Clock size={18} className="mt-0.5 shrink-0 text-ember-3" />
            <p>
              <strong className="text-cream">Estamos fechados no momento.</strong>{" "}
              <span className="text-cream/80">{s.closedMessage && s.closedMessage !== "Estamos fechados no momento. Volte mais tarde!" ? s.closedMessage : "Você pode ver o cardápio, mas os pedidos só serão aceitos quando abrirmos."}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Busca + abas (fixas) ── */}
      <div className="sticky top-0 z-30 border-b border-line/70 bg-coal/90 backdrop-blur-md">
        <div className="wrap pt-3">
          <label className="relative block">
            <span className="sr-only">Buscar no cardápio</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar: bacon, cheddar, batata…"
              className="field !rounded-full !py-2.5 pl-10 pr-10"
              type="text"
              inputMode="search"
              enterKeyHint="search"
            />
            {query && (
              <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-cream">
                <X size={16} />
              </button>
            )}
          </label>
        </div>
        <nav ref={tabsRef} className="no-scrollbar wrap flex gap-1.5 overflow-x-auto py-2.5" aria-label="Categorias">
          {sections.map(({ cat: c }) => {
            const on = active === c.id && !results
            return (
              <button
                key={c.id}
                data-tab={c.id}
                type="button"
                onClick={() => goTo(c.id)}
                className={`h-display inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] transition ${
                  on ? "bg-gradient-to-b from-gold-2 to-gold text-coal shadow-glow" : "text-cream/85 hover:bg-coal-3 hover:text-cream"
                }`}
              >
                <CategoryIcon c={c} size={16} />
                {c.name}
              </button>
            )
          })}
        </nav>
      </div>

      <main className="wrap mt-5">
        {!cat && loading && <SkeletonList />}
        {!cat && !loading && error && (
          <div className="panel mt-6 p-6 text-center">
            <p className="text-cream">Não conseguimos carregar o cardápio agora.</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
            <button className="btn-gold mt-4" onClick={reload}>
              Tentar de novo
            </button>
          </div>
        )}

        {results && (
          <section aria-live="polite">
            <p className="mb-3 text-sm text-muted">
              {results.length ? `${results.length} resultado${results.length > 1 ? "s" : ""} para “${query.trim()}”` : `Nada encontrado para “${query.trim()}”.`}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {results.map((p) => (
                <ProductCard key={p.id} p={p} cat={cat?.categories.find((c) => c.id === p.categoryId)} onOpen={setProduct} />
              ))}
            </div>
          </section>
        )}

        {!results &&
          sections.map(({ cat: c, products }) => (
            <section key={c.id} id={`cat-${c.id}`} data-cat={c.id} className="scroll-mt-[128px] pb-8">
              <h2 className="mb-4 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-b from-gold-2 to-gold text-coal shadow-glow">
                  <CategoryIcon c={c} size={24} />
                </span>
                <span className="h-display text-[28px] leading-none text-cream md:text-4xl">{c.name}</span>
                <span className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-gold/60 to-transparent" />
              </h2>
              {c.extras && c.extras.length > 0 && (
                <p className="-mt-2 mb-3 text-sm text-muted">Monte do seu jeito: adicionais a partir de {brl(Math.min(...c.extras.map((x) => x.price)))} dentro de cada item.</p>
              )}
              <div className={`grid gap-3 md:grid-cols-2 ${c.highlight ? "lg:grid-cols-3 gap-4" : "lg:grid-cols-3"}`}>
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} cat={c} big={!!c.highlight} onOpen={setProduct} />
                ))}
              </div>
            </section>
          ))}
      </main>

      <footer className="wrap mt-6 border-t border-line/60 pt-8 text-center">
        <img src={LOGO} alt="" aria-hidden="true" className="mx-auto w-28" loading="lazy" />
        <p className="h-display mt-2 text-xl text-gold-2">Plate Burguer</p>
        <p className="mt-1 text-sm text-cream/80">Hamburgueria artesanal{s?.storeAddress ? ` · ${s.storeAddress}` : ""}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold">
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-[#5ee08f] hover:underline">
            <MessageCircle size={16} /> {formatWa(wa)}
          </a>
          {s?.instagram && (
            <a href={`https://instagram.com/${s.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-gold-2 hover:underline">
              <Instagram size={16} /> @{s.instagram.replace(/^@/, "")}
            </a>
          )}
        </div>
        <p className="mt-6 pb-4 text-xs text-muted/80">Sujeito à disponibilidade · Agradecemos a preferência!</p>
      </footer>

      {/* ── Barra da sacola ── */}
      {count > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="anim-sheet mx-auto flex w-full max-w-xl items-center gap-3 rounded-2xl bg-gradient-to-b from-gold-2 to-gold px-4 py-3 text-coal shadow-[0_18px_40px_-12px_rgba(0,0,0,.9)] ring-1 ring-gold-2/50"
          >
            <span key={count} className="anim-pop relative grid size-10 place-items-center rounded-xl bg-coal text-gold-2">
              <ShoppingBag size={20} />
              <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-ember px-1 text-[11px] font-bold text-white">{count}</span>
            </span>
            <span className="flex-1 text-left font-display text-lg font-semibold uppercase tracking-wide">Ver sacola</span>
            <span className="font-display text-lg font-bold">{brl(subtotal)}</span>
          </button>
        </div>
      )}

      {cat && <ProductSheet product={product} catalog={cat} onClose={() => setProduct(null)} />}
      {cat && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} catalog={cat} />}
    </div>
  )
}

function formatWa(d: string): string {
  const n = d.startsWith("55") ? d.slice(2) : d
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return d
}

function SkeletonList() {
  return (
    <div className="grid gap-3" aria-label="Carregando cardápio">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="panel flex animate-pulse gap-3 p-3">
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-1/2 rounded bg-coal-4" />
            <div className="h-3 w-5/6 rounded bg-coal-3" />
            <div className="h-4 w-20 rounded bg-coal-4" />
          </div>
          <div className="size-12 rounded-2xl bg-coal-3" />
        </div>
      ))}
    </div>
  )
}
