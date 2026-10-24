import { useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { api } from "../lib/api"
import { DEFAULT_SETTINGS, DEFAULT_WHATSAPP, stripId } from "../lib/catalog"
import { moneyInput, onlyDigits, parseMoney } from "../lib/format"
import type { Settings } from "../lib/types"
import { catalogDb, errMsg, useAdmin } from "./ctx"

/** Grava um pedaço das configurações (cria o registro se ainda não existir). */
export function useSaveSettings() {
  const { catalog, token } = useAdmin()
  const db = catalogDb(token)
  return async (patch: Partial<Settings>) => {
    const cur = catalog.settings
    const data = { ...DEFAULT_SETTINGS, ...stripId(cur), ...patch, type: "settings" }
    delete (data as Partial<Settings>).id
    if (cur.id) await db.update(cur.id, data)
    else await db.create(data)
  }
}

export default function SettingsTab() {
  const { catalog, reload, toast } = useAdmin()
  const save = useSaveSettings()
  const s = catalog.settings
  const [f, setF] = useState({
    whatsapp: s.whatsapp || DEFAULT_WHATSAPP,
    closedMessage: s.closedMessage,
    hoursText: s.hoursText,
    minOrder: s.minOrder ? moneyInput(s.minOrder) : "",
    deliveryTime: s.deliveryTime || "",
    instagram: s.instagram ?? "",
    receiptFooter: s.receiptFooter ?? "Obrigado pela preferência! Volte sempre.",
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const toggleOpen = async () => {
    setBusy(true)
    try {
      await save({ open: !s.open })
      await reload()
      toast(!s.open ? "Loja ABERTA — pedidos liberados." : "Loja FECHADA — o cardápio mostra o aviso e bloqueia o envio.")
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setBusy(false)
    }
  }

  const flip = async (patch: Partial<Settings>, msg: string) => {
    setBusy(true)
    try {
      await save(patch)
      await reload()
      toast(msg)
    } catch (e) {
      toast(errMsg(e), "err")
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    setErr("")
    const wa = onlyDigits(f.whatsapp)
    if (wa.length < 12 || wa.length > 13) return setErr("WhatsApp: use o formato 55 + DDD + número, ex.: 5562992513487.")
    const min = f.minOrder.trim() ? parseMoney(f.minOrder) : 0
    if (!Number.isFinite(min) || min < 0) return setErr("Pedido mínimo inválido.")
    setBusy(true)
    try {
      await save({
        whatsapp: wa,
        closedMessage: f.closedMessage.trim().slice(0, 200),
        hoursText: f.hoursText.trim().slice(0, 80),
        minOrder: min,
        deliveryTime: f.deliveryTime.trim().slice(0, 40),
        instagram: f.instagram.trim().replace(/^@/, "").slice(0, 40),
        receiptFooter: f.receiptFooter.trim().slice(0, 120),
      })
      await reload()
      toast("Configurações salvas.")
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="h-display text-2xl">Ajustes</h1>

      <section className={`panel flex flex-wrap items-center gap-4 p-5 ${s.open ? "!border-emerald-500/40" : "!border-ember/50"}`}>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">Situação da loja</p>
          <p className={`h-display text-3xl ${s.open ? "text-emerald-400" : "text-ember-3"}`}>{s.open ? "Aberta" : "Fechada"}</p>
          <p className="text-xs text-muted">{s.open ? "Clientes podem enviar pedidos." : "O cardápio aparece, mas o envio de pedidos fica bloqueado."}</p>
        </div>
        <button type="button" className={s.open ? "btn-ember" : "btn btn-wa"} onClick={toggleOpen} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : s.open ? "Fechar loja agora" : "Abrir loja agora"}
        </button>
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="h-display text-lg">Pedidos e impressão</h2>
        <Toggle
          on={!!s.alsoWhatsapp}
          disabled={busy}
          onChange={(v) => flip({ alsoWhatsapp: v }, v ? "O cliente também vai abrir o WhatsApp com o pedido." : "Pedidos só pelo painel.")}
          title="Também abrir o WhatsApp com o pedido"
          hint="Desligado: o pedido chega só aqui no painel (com toque). Ligado: depois de gravar, abre o WhatsApp do cliente com o pedido pronto pro número abaixo."
          testid="toggle-wa"
        />
        <Toggle
          on={!!s.autoPrint}
          disabled={busy}
          onChange={(v) => flip({ autoPrint: v }, v ? "Cada pedido novo vai pra impressora sozinho (com o painel aberto)." : "Impressão automática desligada.")}
          title="Imprimir automaticamente cada pedido novo"
          hint="Funciona com o painel aberto neste computador. Para imprimir sem a janela de confirmação, abra o Chrome com --kiosk-printing e deixe a térmica como impressora padrão."
          testid="toggle-autoprint"
        />
        <div>
          <span className="label">Papel da impressora térmica</span>
          <div className="flex gap-2">
            {([80, 58] as const).map((w) => (
              <button
                key={w}
                type="button"
                disabled={busy}
                onClick={() => flip({ paperWidth: w }, `Notinha em ${w} mm.`)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${((s.paperWidth ?? 80) === w) ? "border-gold bg-gold text-coal" : "border-line bg-coal-3 text-cream/85"}`}
              >
                {w} mm
              </button>
            ))}
          </div>
        </div>
        <F label="Rodapé da notinha">
          <input className="field" value={f.receiptFooter} onChange={(e) => setF({ ...f, receiptFooter: e.target.value })} maxLength={120} />
        </F>
      </section>

      <section className="panel space-y-4 p-5">
        <F label="WhatsApp da loja (rodapé do cardápio, notinha e envio opcional)" hint="55 + DDD + número, só dígitos.">
          <input className="field" inputMode="numeric" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
        </F>
        <F label="Instagram" hint="Sem o @.">
          <input className="field" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} maxLength={40} />
        </F>
        <F label="Horário de funcionamento (aparece no topo do cardápio)" hint="Ex.: Ter a Dom · 18h às 23h. Deixe vazio para não mostrar.">
          <input className="field" value={f.hoursText} onChange={(e) => setF({ ...f, hoursText: e.target.value })} maxLength={80} />
        </F>
        <F label="Tempo médio de entrega (opcional)" hint="Ex.: 40 a 60 min">
          <input className="field" value={f.deliveryTime} onChange={(e) => setF({ ...f, deliveryTime: e.target.value })} maxLength={40} />
        </F>
        <F label="Mensagem quando estiver fechado">
          <textarea className="field resize-none" rows={2} value={f.closedMessage} onChange={(e) => setF({ ...f, closedMessage: e.target.value })} maxLength={200} />
        </F>
        <F label="Pedido mínimo (R$, opcional)" hint="Sem contar o frete. Vazio = sem mínimo.">
          <input className="field" inputMode="decimal" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: e.target.value })} placeholder="0,00" />
        </F>
        {err && <p className="err">{err}</p>}
        <button type="button" className="btn-gold w-full sm:w-auto" onClick={submit} disabled={busy}>
          Salvar ajustes
        </button>
      </section>

      <PasswordBox />
    </div>
  )
}

function PasswordBox() {
  const { token, toast } = useAdmin()
  const [cur, setCur] = useState("")
  const [n1, setN1] = useState("")
  const [n2, setN2] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const submit = async () => {
    setErr("")
    if (n1.length < 8) return setErr("A nova senha precisa de pelo menos 8 caracteres.")
    if (n1 !== n2) return setErr("As duas senhas novas não conferem.")
    setBusy(true)
    try {
      const r = await api<{ token?: string }>("auth/change-password", { current_password: cur, new_password: n1 }, token)
      if (r.token) {
        try {
          const raw = JSON.parse(localStorage.getItem("plate:admin:v1") || "{}")
          localStorage.setItem("plate:admin:v1", JSON.stringify({ ...raw, token: r.token }))
        } catch {
          /* ignore */
        }
      }
      setCur("")
      setN1("")
      setN2("")
      toast("Senha alterada.")
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="panel space-y-3 p-5">
      <h2 className="h-display text-lg">Trocar senha do painel</h2>
      <input className="field" type="password" autoComplete="current-password" placeholder="Senha atual" value={cur} onChange={(e) => setCur(e.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="field" type="password" autoComplete="new-password" placeholder="Nova senha" value={n1} onChange={(e) => setN1(e.target.value)} />
        <input className="field" type="password" autoComplete="new-password" placeholder="Repita a nova senha" value={n2} onChange={(e) => setN2(e.target.value)} />
      </div>
      {err && <p className="err">{err}</p>}
      <button type="button" className="btn-ghost" onClick={submit} disabled={busy || !cur || !n1}>
        Trocar senha
      </button>
    </section>
  )
}

function F({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

function Toggle({ on, onChange, title, hint, disabled, testid }: { on: boolean; onChange: (v: boolean) => void; title: string; hint?: string; disabled?: boolean; testid?: string }) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={disabled}
        data-testid={testid}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-coal-4"}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
      <div>
        <p className="font-semibold text-cream">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  )
}
