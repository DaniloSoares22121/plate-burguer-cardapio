import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bell,
  BellRing,
  Bike,
  CheckCheck,
  ChefHat,
  ChevronDown,
  Copy,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  Printer,
  RefreshCw,
  Store,
  Trash2,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react"
import { api, type DbRecord } from "../lib/api"
import { brl, dateTime, onlyDigits } from "../lib/format"
import { mapsLink, orderMessage } from "../lib/order"
import type { Order, OrderStatus } from "../lib/types"
import { askNotifications, audioReady, isMuted, notify, setMuted, soundPref, startRinging, stopRinging, unlockAudio } from "./alert"
import { atende, atendenteConectado, atualizarAtendente } from "./atende"
import { errMsg, useAdmin } from "./ctx"
import { IconBtn } from "./Products"
import { printOrder } from "./receipt"

type St = Exclude<OrderStatus, "confirmado">
const STATUS: { id: St; label: string; cls: string; dot: string }[] = [
  { id: "novo", label: "Novo", cls: "bg-ember text-white", dot: "bg-ember" },
  { id: "preparo", label: "Em preparo", cls: "bg-gold text-coal", dot: "bg-gold" },
  { id: "saiu", label: "Saiu pra entrega", cls: "bg-sky-500 text-white", dot: "bg-sky-400" },
  { id: "pronto", label: "Pronto pra retirar", cls: "bg-violet-500 text-white", dot: "bg-violet-400" },
  { id: "concluido", label: "Concluído", cls: "bg-emerald-600 text-white", dot: "bg-emerald-500" },
  { id: "cancelado", label: "Cancelado", cls: "bg-coal-4 text-cream/80", dot: "bg-coal-4" },
]
const statusOf = (o: Order): St => (o.status === "confirmado" ? "preparo" : ((o.status as St) || "novo"))
const stInfo = (id: St) => STATUS.find((s) => s.id === id) ?? STATUS[0]
const OPEN: St[] = ["novo", "preparo", "saiu", "pronto"]

/** Próximo passo com um toque: Novo → Em preparo → Saiu/Pronto (pelo tipo) → Concluído. */
function nextStep(o: Order): { to: St; label: string; icon: typeof ChefHat } | null {
  const s = statusOf(o)
  if (s === "novo") return { to: "preparo", label: "Aceitar e preparar", icon: ChefHat }
  if (s === "preparo") return o.mode === "entrega" ? { to: "saiu", label: "Saiu pra entrega", icon: Bike } : { to: "pronto", label: "Pronto pra retirar", icon: PackageCheck }
  if (s === "saiu" || s === "pronto") return { to: "concluido", label: "Concluir", icon: CheckCheck }
  return null
}

/** Aviso pro cliente no WhatsApp a cada passo do pedido (abre a conversa com o texto pronto). */
function statusMsg(o: Order, st: St): string | null {
  const nome = (o.customer?.name || "").trim().split(/\s+/)[0] || ""
  const oi = `Olá${nome ? ", " + nome : ""}! Aqui é do *Plate Burguer* 🍔

`
  const n = `nº ${o.number}`
  if (st === "preparo") return `${oi}Seu pedido ${n} foi aceito e já está *em preparo*! 👨‍🍳`
  if (st === "saiu") return `${oi}Seu pedido ${n} *saiu pra entrega*! 🛵 Já já chega aí.`
  if (st === "pronto") return `${oi}Seu pedido ${n} está *pronto pra retirar*! ✅`
  if (st === "concluido") return `${oi}Pedido ${n} entregue. Obrigado pela preferência! ❤️`
  if (st === "cancelado") return `${oi}Infelizmente seu pedido ${n} foi *cancelado*. Qualquer dúvida, fale com a gente por aqui.`
  return null
}
function waCliente(o: Order, text: string): string | null {
  let p = onlyDigits(o.customer?.phone || "")
  if (!p) return null
  if (!/^55\d{10,11}$/.test(p)) p = "55" + p
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`
}

const ACK_KEY = "plate:ack:v1"
function readAck(): Set<number> {
  try {
    const v = JSON.parse(localStorage.getItem(ACK_KEY) || "[]")
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "number") : [])
  } catch {
    return new Set()
  }
}
function writeAck(s: Set<number>) {
  try {
    localStorage.setItem(ACK_KEY, JSON.stringify([...s].slice(-500)))
  } catch {
    /* ignore */
  }
}

function ago(ms: number, now: number): string {
  const m = Math.max(0, Math.floor((now - ms) / 60000))
  if (m < 1) return "agora"
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `há ${h}h${String(m % 60).padStart(2, "0")}` : dateTime(ms)
}

const POLL_MS = 5000

/** Fica montado em todas as abas do painel (visible=false esconde o quadro), pra o toque
 *  de pedido novo funcionar mesmo com o dono editando produto. */
export default function Orders({ visible = true }: { visible?: boolean }) {
  const { token, toast, catalog } = useAdmin()
  // atendente de WhatsApp conectado? então os avisos de status saem sozinhos por ele
  useEffect(() => {
    atualizarAtendente(token)
    const t = setInterval(() => atualizarAtendente(token), 60000)
    return () => clearInterval(t)
  }, [token])
  const settings = catalog.settings
  const [rows, setRows] = useState<DbRecord<Order>[] | null>(null)
  // conta pro atendente quem acabou de pedir pelo cardápio (assim ele não manda follow-up pra quem já pediu)
  const informados = useRef(0)
  useEffect(() => {
    if (!rows?.length || !atendenteConectado() || Date.now() - informados.current < 120000) return
    const tels = rows.filter((r) => Date.now() - (r.data.createdAt || 0) < 86400000 && r.data.customer?.phone).map((r) => r.data.customer.phone)
    if (!tels.length) return
    informados.current = Date.now()
    atende("pediram", token, { telefones: tels }).catch(() => {})
  }, [rows, token])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<"quadro" | "historico">("quadro")
  const [open, setOpen] = useState<number | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [ack, setAck] = useState<Set<number>>(readAck)
  const [soundOn, setSoundOn] = useState(audioReady())
  const [muted, setMutedS] = useState(isMuted())
  const [now, setNow] = useState(Date.now())
  const [offline, setOffline] = useState(false)
  const seen = useRef<Set<number> | null>(null)
  const printQueue = useRef<Promise<void>>(Promise.resolve())
  const autoPrint = useRef(!!settings.autoPrint)
  autoPrint.current = !!settings.autoPrint
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const queuePrint = useCallback((r: DbRecord<Order>) => {
    printQueue.current = printQueue.current
      .then(() => printOrder(r.data, settingsRef.current, r.id))
      .then(() => new Promise<void>((res) => setTimeout(res, 1500)))
  }, [])

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        const j = await api<{ records: DbRecord<Order>[] }>("db/list", { collection: "orders", limit: 300, order: "desc" }, token)
        const recs = j.records || []
        setOffline(false)
        // pedido que não existia na última leitura = novo (a 1ª leitura só marca o que já havia)
        if (seen.current) {
          const fresh = recs.filter((r) => !seen.current!.has(r.id) && statusOf(r.data) === "novo")
          if (fresh.length) {
            const o = fresh[0].data
            notify(
              fresh.length > 1 ? `${fresh.length} novos pedidos — Plate Burguer` : `Novo pedido nº ${o.number} — Plate Burguer`,
              `${o.customer?.name || ""} · ${o.mode === "entrega" ? `Entrega${o.address?.district ? ` · ${o.address.district}` : ""}` : "Retirada"} · ${brl(o.total)}`,
            )
            if (autoPrint.current) for (const r of fresh.slice().reverse()) queuePrint(r)
          }
        }
        seen.current = new Set(recs.map((r) => r.id))
        setRows(recs)
      } catch (e) {
        if (!quiet) toast(errMsg(e), "err")
        else setOffline(true)
      } finally {
        setLoading(false)
      }
    },
    [token, toast, queuePrint],
  )

  useEffect(() => {
    load()
    const t = setInterval(() => load(true), POLL_MS)
    const c = setInterval(() => setNow(Date.now()), 30000)
    return () => {
      clearInterval(t)
      clearInterval(c)
    }
  }, [load])

  // quem ativou o som numa visita anterior: o 1º toque em qualquer lugar do painel já libera
  useEffect(() => {
    if (soundOn || !soundPref()) return
    const h = () => {
      unlockAudio().then(setSoundOn)
    }
    window.addEventListener("pointerdown", h, { once: true })
    window.addEventListener("keydown", h, { once: true })
    return () => {
      window.removeEventListener("pointerdown", h)
      window.removeEventListener("keydown", h)
    }
  }, [soundOn])

  const pending = useMemo(() => (rows || []).filter((r) => statusOf(r.data) === "novo" && !ack.has(r.id)), [rows, ack])

  // toca enquanto houver pedido novo que ninguém marcou como visto
  useEffect(() => {
    if (pending.length) startRinging(pending.length > 1 ? `${pending.length} NOVOS PEDIDOS` : `NOVO PEDIDO nº ${pending[0].data.number}`)
    else stopRinging()
  }, [pending])
  useEffect(() => () => stopRinging(), [])

  const acknowledge = (ids: number[]) => {
    setAck((a) => {
      const n = new Set(a)
      ids.forEach((i) => n.add(i))
      writeAck(n)
      return n
    })
  }

  const enableSound = async () => {
    const ok = await unlockAudio()
    setSoundOn(ok)
    await askNotifications()
    if (ok) {
      setMuted(false)
      setMutedS(false)
      toast("Som de pedidos ativado.")
    } else toast("O navegador não liberou o som. Tente de novo.", "err")
  }

  const toggleMute = () => {
    const m = !muted
    setMuted(m)
    setMutedS(m)
    toast(m ? "Toque de pedidos silenciado." : "Toque de pedidos ligado.")
  }

  const setStatus = async (r: DbRecord<Order>, status: St) => {
    // abre ANTES do await: o navegador só deixa abrir aba no mesmo toque do clique
    const msg = statusOf(r.data) !== status ? statusMsg(r.data, status) : null
    const peloAtendente = !!msg && !!r.data.customer?.phone && atendenteConectado()
    const link = msg && !peloAtendente ? waCliente(r.data, msg) : null
    if (link) window.open(link, "_blank", "noopener")
    if (peloAtendente && msg)
      atende("status", token, { telefone: r.data.customer.phone, nome: r.data.customer.name, numero: r.data.number, texto: msg })
        .then(() => toast("Cliente avisado no WhatsApp pelo atendente."))
        .catch(() => { const l = waCliente(r.data, msg); toast("Não deu pra avisar pelo atendente: abra o WhatsApp pra avisar.", "err"); if (l) window.open(l, "_blank", "noopener") })
    setBusy(r.id)
    try {
      await api("db/update", { collection: "orders", id: r.id, data: { ...r.data, status } }, token)
      acknowledge([r.id])
      setRows((rs) => (rs || []).map((x) => (x.id === r.id ? { ...x, data: { ...x.data, status } } : x)))
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setBusy(null)
    }
  }

  const remove = async (r: DbRecord<Order>) => {
    if (!confirm(`Excluir o pedido nº ${r.data.number}?`)) return
    setBusy(r.id)
    try {
      await api("db/delete", { collection: "orders", id: r.id }, token)
      setRows((rs) => (rs || []).filter((x) => x.id !== r.id))
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setBusy(null)
    }
  }

  const cleanup = async () => {
    const limit = Date.now() - 30 * 86400000
    const old = (rows || []).filter((r) => (r.data.createdAt || r.created_at * 1000) < limit)
    if (!old.length) return toast("Nenhum pedido com mais de 30 dias.")
    if (!confirm(`Apagar ${old.length} pedido(s) com mais de 30 dias?`)) return
    setLoading(true)
    try {
      for (const r of old) await api("db/delete", { collection: "orders", id: r.id }, token)
      toast(`${old.length} pedido(s) antigos apagados.`)
      await load(true)
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setLoading(false)
    }
  }

  const copy = (o: Order) =>
    navigator.clipboard?.writeText(orderMessage(o, "PLATE BURGUER").replace(/\*/g, "")).then(
      () => toast("Resumo copiado."),
      () => toast("Não consegui copiar.", "err"),
    )

  const all = rows || []
  const groups = OPEN.map((id) => ({ st: stInfo(id), list: all.filter((r) => statusOf(r.data) === id) })).filter((g) => g.st.id === "novo" || g.list.length)
  const history = all.filter((r) => !OPEN.includes(statusOf(r.data)))
  const today = new Date().toDateString()
  const doneToday = history.filter((r) => statusOf(r.data) === "concluido" && new Date(r.data.createdAt || r.created_at * 1000).toDateString() === today)

  const card = (r: DbRecord<Order>, isNew: boolean) => (
    <OrderCard
      key={r.id}
      r={r}
      now={now}
      isNew={isNew}
      open={open === r.id}
      busy={busy === r.id}
      onToggle={() => setOpen(open === r.id ? null : r.id)}
      onStatus={(s) => setStatus(r, s)}
      onPrint={() => queuePrint(r)}
      onRemove={() => remove(r)}
      onCopy={() => copy(r.data)}
    />
  )

  return (
    <>
      {/* ── alerta de pedido novo (aparece em qualquer aba do painel) ── */}
      {pending.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-50 px-3 lg:bottom-6 lg:left-64 lg:px-8" role="alert">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl bg-ember px-4 py-3 text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,.9)] ring-2 ring-white/30">
            <BellRing className="shrink-0 animate-bounce" size={26} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl leading-tight">{pending.length > 1 ? `${pending.length} pedidos novos!` : `Novo pedido nº ${pending[0].data.number}!`}</p>
              <p className="truncate text-sm text-white/85">
                {pending[0].data.customer?.name} · {brl(pending[0].data.total)}
                {!soundOn && " · ative o som para ouvir o toque"}
              </p>
            </div>
            <button type="button" className="btn shrink-0 bg-white text-ember-2 hover:brightness-95" onClick={() => acknowledge(pending.map((r) => r.id))} data-testid="ack">
              Ciente
            </button>
          </div>
        </div>
      )}

      {visible && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="h-display text-3xl">Pedidos</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <span className={`size-2 rounded-full ${offline ? "bg-ember" : "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400"}`} />
                {offline ? "Sem conexão — tentando de novo…" : "Ao vivo · atualiza sozinho a cada 5 s"}
                {doneToday.length > 0 && ` · ${doneToday.length} concluído${doneToday.length > 1 ? "s" : ""} hoje`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {soundOn && (
                <button type="button" className="btn-ghost !min-h-[40px] text-sm" onClick={toggleMute} aria-pressed={muted} data-testid="mute">
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />} {muted ? "Som mudo" : "Som ligado"}
                </button>
              )}
              <button type="button" className="btn-ghost !min-h-[40px] text-sm" onClick={() => load()} disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Atualizar
              </button>
            </div>
          </div>

          {!soundOn && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-gold/60 bg-gold/10 p-4">
              <Bell className="shrink-0 text-gold-2" size={28} />
              <div className="min-w-[180px] flex-1">
                <p className="font-semibold text-cream">Ative o toque de novo pedido</p>
                <p className="text-sm text-muted">O navegador só libera som depois de um clique. Deixe esta aba aberta e com volume.</p>
              </div>
              <button type="button" className="btn-gold" onClick={enableSound} data-testid="enable-sound">
                <BellRing size={18} /> Ativar som de pedidos
              </button>
            </div>
          )}

          <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
            {(
              [
                ["quadro", "Em aberto", all.length - history.length],
                ["historico", "Concluídos e cancelados", history.length],
              ] as ["quadro" | "historico", string, number][]
            ).map(([id, label, n]) => (
              <button key={id} type="button" onClick={() => setView(id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${view === id ? "bg-cream text-coal" : "bg-coal-3 text-cream/80"}`}>
                {label} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>

          {rows === null && (
            <div className="grid place-items-center py-16 text-muted">
              <Loader2 className="animate-spin" />
            </div>
          )}

          {rows && view === "quadro" && (
            <div className="grid gap-5 lg:grid-cols-2">
              {groups.map(({ st, list }) => (
                <section key={st.id} aria-label={st.label} data-status={st.id}>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-cream/80">
                    <span className={`size-2.5 rounded-full ${st.dot}`} /> {st.label} <span className="text-muted">{list.length}</span>
                  </h2>
                  {!list.length && <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">Nenhum pedido novo. Quando chegar, toca aqui.</p>}
                  <ul className="space-y-2">{list.map((r) => card(r, st.id === "novo" && !ack.has(r.id)))}</ul>
                </section>
              ))}
            </div>
          )}

          {rows && view === "historico" && (
            <>
              {!history.length && <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">Nenhum pedido concluído ainda.</p>}
              <ul className="space-y-2">{history.map((r) => card(r, false))}</ul>
              {history.length > 0 && (
                <div className="mt-8 text-center">
                  <button type="button" className="text-sm text-muted underline-offset-2 hover:text-cream hover:underline" onClick={cleanup} disabled={loading}>
                    Apagar pedidos com mais de 30 dias
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

function OrderCard({
  r,
  now,
  isNew,
  open,
  busy,
  onToggle,
  onStatus,
  onPrint,
  onRemove,
  onCopy,
}: {
  r: DbRecord<Order>
  now: number
  isNew: boolean
  open: boolean
  busy: boolean
  onToggle: () => void
  onStatus: (s: St) => void
  onPrint: () => void
  onRemove: () => void
  onCopy: () => void
}) {
  const o = r.data
  const st = stInfo(statusOf(o))
  const next = nextStep(o)
  const phone = onlyDigits(o.customer?.phone || "")
  const created = o.createdAt || r.created_at * 1000
  const nItems = (o.items || []).reduce((s, i) => s + i.qty, 0)
  return (
    <li className={`panel overflow-hidden ${isNew ? "!border-ember ring-2 ring-ember/60" : ""}`} data-order={o.number}>
      <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={onToggle} aria-expanded={open}>
        <span className="grid min-w-[64px] place-items-center rounded-xl bg-coal-3 px-2 py-1.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">nº</span>
          <span className="font-display text-2xl leading-none text-gold-2">{o.number}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${st.cls}`}>{st.label}</span>
            <span className="truncate font-semibold">{o.customer?.name}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            {o.mode === "entrega" ? <Bike size={13} className="shrink-0" /> : <Store size={13} className="shrink-0" />}
            <span className="truncate">
              {o.mode === "entrega" ? o.address?.district || "Entrega" : "Retirada"} · {nItems} {nItems === 1 ? "item" : "itens"} · {ago(created, now)}
            </span>
          </span>
        </span>
        <span className="price shrink-0 text-right text-lg">
          {brl(o.total)}
          {o.mode === "entrega" && o.fee === null && <span className="block text-[10px] font-normal text-muted">+ frete</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      <div className="flex gap-2 px-3 pb-3">
        {next && (
          <button
            type="button"
            className={`btn !min-h-[42px] flex-1 text-sm ${statusOf(o) === "novo" ? "bg-ember text-white" : "bg-gold text-coal"}`}
            disabled={busy}
            onClick={() => onStatus(next.to)}
            data-testid="next-status"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <next.icon size={16} />} {next.label}
          </button>
        )}
        <button type="button" className={`btn-ghost !min-h-[42px] !px-3 text-sm ${next ? "" : "flex-1"}`} onClick={onPrint} data-testid="print">
          <Printer size={16} /> Imprimir
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-coal/40 p-3 text-sm">
          <ul className="mb-3 space-y-1.5">
            {(o.items || []).map((it, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  <strong>{it.qty}x</strong> {it.name}
                  {it.size ? <span className="text-gold-2"> ({it.size})</span> : ""}
                  {it.choice && <span className="block text-xs text-muted">{it.choice}</span>}
                  {(it.extras || []).map((e) => (
                    <span key={e} className="block text-xs text-muted">
                      + {e}
                    </span>
                  ))}
                  {it.note && <span className="block text-xs font-semibold text-gold-2">Obs.: {it.note}</span>}
                </span>
                <span className="shrink-0">{brl(it.unitPrice * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mb-3 space-y-0.5 border-t border-line pt-2 text-muted">
            <p>Subtotal: {brl(o.subtotal)}</p>
            {o.mode === "entrega" && <p>Frete: {o.fee === null ? "a combinar" : brl(o.fee)}</p>}
            <p className="font-semibold text-cream">
              Total: {brl(o.total)}
              {o.mode === "entrega" && o.fee === null ? " + frete" : ""}
            </p>
          </div>
          <div className="mb-3 grid gap-1 text-cream/90">
            <p>
              <span className="text-muted">Cliente:</span> {o.customer?.name} · {o.customer?.phone}
            </p>
            {o.mode === "entrega" && o.address && (
              <p>
                <span className="text-muted">Endereço:</span> {o.address.number ? `${o.address.street}, ${o.address.number}` : o.address.street}
                {o.address.district ? ` — ${o.address.district}` : ""}
                {o.address.complement ? ` · ${o.address.complement}` : ""}
                {o.address.region ? ` · ${o.address.region}` : ""}
                {typeof o.address.lat === "number" && typeof o.address.lon === "number" && (
                  <>
                    {" · "}
                    <a className="inline-flex items-center gap-1 text-gold-2 underline" href={mapsLink(o.address.lat, o.address.lon)} target="_blank" rel="noopener">
                      <MapPin size={13} /> ver no mapa
                    </a>
                  </>
                )}
              </p>
            )}
            <p>
              <span className="text-muted">Pagamento:</span> {o.payment}
            </p>
            <p className="text-xs text-muted">Feito em {dateTime(created)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field !w-auto !py-2 text-sm" value={statusOf(o)} disabled={busy} onChange={(e) => onStatus(e.target.value as St)} aria-label="Status do pedido">
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {phone && (
              <a className="btn-wa !min-h-[40px] text-sm" href={`https://wa.me/55${phone.replace(/^55(?=\d{10,11}$)/, "")}`} target="_blank" rel="noopener">
                <MessageCircle size={16} /> Cliente
              </a>
            )}
            <button type="button" className="btn-ghost !min-h-[40px] text-sm" onClick={onCopy}>
              <Copy size={16} /> Copiar
            </button>
            {statusOf(o) !== "cancelado" && statusOf(o) !== "concluido" && (
              <button type="button" className="btn-ghost !min-h-[40px] text-sm" onClick={() => confirm(`Cancelar o pedido nº ${o.number}?`) && onStatus("cancelado")}>
                <XCircle size={16} /> Cancelar
              </button>
            )}
            <span className="flex-1" />
            <IconBtn label="Excluir pedido" danger onClick={onRemove} disabled={busy}>
              <Trash2 size={16} />
            </IconBtn>
          </div>
        </div>
      )}
    </li>
  )
}
