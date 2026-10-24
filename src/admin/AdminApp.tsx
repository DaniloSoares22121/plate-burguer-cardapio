import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { ClipboardList, ExternalLink, LayoutGrid, Loader2, LogOut, MapPin, MessageCircle, Settings2, UtensilsCrossed } from "lucide-react"
import { api, ApiError, BASE } from "../lib/api"
import { fetchCatalogRecords, parseCatalog } from "../lib/catalog"
import { LOGO } from "../lib/images"
import type { Catalog } from "../lib/types"
import { AdminCtx, errMsg, type Admin } from "./ctx"
import Categories from "./Categories"
import Orders from "./Orders"
import Products from "./Products"
import Regions from "./Regions"
import SettingsTab from "./SettingsTab"
import WhatsApp from "./WhatsApp"

const TOKEN_KEY = "plate:admin:v1"
type Tab = "pedidos" | "produtos" | "categorias" | "frete" | "whatsapp" | "ajustes"
const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: "pedidos", label: "Pedidos", icon: ClipboardList },
  { id: "produtos", label: "Produtos", icon: UtensilsCrossed },
  { id: "categorias", label: "Categorias", icon: LayoutGrid },
  { id: "frete", label: "Frete", icon: MapPin },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "ajustes", label: "Ajustes", icon: Settings2 },
]

function readSession(): { token: string; email: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null")
    return v && typeof v.token === "string" ? v : null
  } catch {
    return null
  }
}

export default function AdminApp() {
  const [session, setSession] = useState(readSession)
  const [state, setState] = useState<"checking" | "ok" | "login">(session ? "checking" : "login")
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [tab, setTab] = useState<Tab>(() => {
    const h = window.location.hash.slice(1) as Tab
    return TABS.some((t) => t.id === h) ? h : "pedidos"
  })
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([])

  useEffect(() => {
    document.title = "Painel — Plate Burguer"
    const m = document.createElement("meta")
    m.name = "robots"
    m.content = "noindex, nofollow"
    document.head.appendChild(m)
    // painel instalável no celular (Adicionar à tela inicial abre como app, sem barra do navegador)
    const add = (tag: string, attrs: Record<string, string>) => {
      const el = document.createElement(tag)
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
      document.head.appendChild(el)
      return el
    }
    document.querySelector('link[rel="manifest"]')?.remove()
    const els = [
      add("link", { rel: "manifest", href: "/admin-manifest.json" }),
      add("meta", { name: "apple-mobile-web-app-capable", content: "yes" }),
      add("meta", { name: "mobile-web-app-capable", content: "yes" }),
      add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" }),
      add("meta", { name: "apple-mobile-web-app-title", content: "Plate Painel" }),
    ]
    return () => els.forEach((e) => e.remove())
  }, [])

  useEffect(() => {
    history.replaceState(null, "", `#${tab}`)
  }, [tab])

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 6000 : 2800)
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    setSession(null)
    setState("login")
  }, [])

  const reload = useCallback(async () => {
    try {
      setCatalog(parseCatalog(await fetchCatalogRecords()))
    } catch (e) {
      toast(errMsg(e), "err")
    }
  }, [toast])

  // confere se o token ainda vale E se a conta é administradora
  useEffect(() => {
    if (!session || state !== "checking") return
    ;(async () => {
      try {
        await api("db/list", { collection: "admins", limit: 1 }, session.token)
        setState("ok")
        reload()
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          logout()
          if (e.status === 403) toast("Esta conta não tem acesso ao painel.", "err")
        } else {
          // sem internet: deixa entrar e mostra o erro nas telas
          setState("ok")
          reload()
        }
      }
    })()
  }, [session, state, reload, logout, toast])

  const ctx: Admin | null = useMemo(
    () => (session && catalog ? { token: session.token, email: session.email, catalog, reload, toast, logout } : null),
    [session, catalog, reload, toast, logout],
  )

  if (state === "login" || !session)
    return (
      <Login
        onLogged={(token, email) => {
          const s = { token, email }
          try {
            localStorage.setItem(TOKEN_KEY, JSON.stringify(s))
          } catch {
            /* ignore */
          }
          setSession(s)
          setState("checking")
        }}
        toasts={toasts}
      />
    )

  const cur = TABS.find((t) => t.id === tab) ?? TABS[0]
  const go = (t: Tab) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-dvh bg-coal lg:pl-64">
      {/* ── COMPUTADOR: menu lateral fixo ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-coal-2 lg:flex">
        <div className="flex items-center gap-3 border-b border-line px-5 py-5">
          <img src={LOGO} alt="" className="h-11 w-auto" />
          <div className="min-w-0">
            <p className="h-display truncate text-lg leading-tight">Plate Burguer</p>
            <p className="text-xs text-muted">Painel do restaurante</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Seções do painel">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
                tab === t.id ? "bg-gold text-coal" : "text-cream/80 hover:bg-coal-3 hover:text-cream"
              }`}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <a href={BASE} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-cream/80 hover:bg-coal-3">
            <ExternalLink size={18} /> Ver cardápio
          </a>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm text-cream/80 hover:bg-coal-3">
            <LogOut size={18} /> Sair
          </button>
          <p className="truncate px-3.5 pt-2 text-xs text-muted" title={session.email}>{session.email}</p>
        </div>
      </aside>

      {/* ── CELULAR: barra de app no topo ── */}
      <header className="sticky top-0 z-30 border-b border-line bg-coal/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <img src={LOGO} alt="" className="h-8 w-auto" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="h-display truncate text-base">Plate Burguer</p>
            <p className="truncate text-[11px] text-muted">Painel · {cur.label}</p>
          </div>
          <a href={BASE} target="_blank" rel="noopener" className="grid size-10 place-items-center rounded-full text-cream/80 active:bg-coal-3" aria-label="Ver cardápio">
            <ExternalLink size={19} />
          </a>
          <button type="button" onClick={logout} className="grid size-10 place-items-center rounded-full text-cream/80 active:bg-coal-3" aria-label="Sair">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-4 lg:px-10 lg:pb-12 lg:pt-8">
        {!ctx ? (
          <div className="grid place-items-center py-24 text-muted">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <AdminCtx.Provider value={ctx}>
            <Orders visible={tab === "pedidos"} />
            {tab === "produtos" && <Products />}
            {tab === "categorias" && <Categories />}
            {tab === "frete" && <Regions />}
            {tab === "whatsapp" && <WhatsApp />}
            {tab === "ajustes" && <SettingsTab />}
          </AdminCtx.Provider>
        )}
      </main>

      {/* ── CELULAR: abas fixas embaixo, como app ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-coal-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Seções do painel"
      >
        <div className="grid grid-cols-6">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                aria-current={on ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95 ${on ? "text-gold" : "text-cream/55"}`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full transition ${on ? "bg-gold/15" : ""}`}>
                  <t.icon size={21} strokeWidth={on ? 2.4 : 2} />
                </span>
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
      <Toasts toasts={toasts} />
    </div>
  )
}

function Toasts({ toasts }: { toasts: { id: number; msg: string; kind: "ok" | "err" }[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-sheet pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-2xl ${
            t.kind === "err" ? "bg-ember-2 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}

function Login({ onLogged, toasts }: { onLogged: (token: string, email: string) => void; toasts: { id: number; msg: string; kind: "ok" | "err" }[] }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const r = await api<{ token: string; user: { email: string } }>("auth/login", { email, password })
      onLogged(r.token, r.user.email)
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="embers grid min-h-dvh place-items-center px-4 py-10">
      <form onSubmit={submit} className="panel w-full max-w-sm p-6">
        <img src={LOGO} alt="Plate Burguer" className="mx-auto w-40" />
        <h1 className="h-display mt-2 text-center text-xl">Painel do restaurante</h1>
        <p className="mb-5 text-center text-sm text-muted">Entre para receber os pedidos e editar o cardápio.</p>
        <label className="mb-3 block">
          <span className="label">E-mail</span>
          <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block">
          <span className="label">Senha</span>
          <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="err mt-3" role="alert">{error}</p>}
        <button className="btn-gold mt-5 w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : "Entrar"}
        </button>
        <a href={BASE} className="mt-4 block text-center text-sm text-muted hover:text-cream">
          ← Voltar ao cardápio
        </a>
      </form>
      <Toasts toasts={toasts} />
    </div>
  )
}
