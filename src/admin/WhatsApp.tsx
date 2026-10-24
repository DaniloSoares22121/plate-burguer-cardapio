import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowLeft, Bot, Hand, Loader2, MessageCircle, Pause, Play, RefreshCw, RotateCcw, Search, Send, Smartphone, Sparkles, Unplug } from "lucide-react"
import { errMsg, useAdmin } from "./ctx"
import { ATENDE, BOT_ID, atende } from "./atende"

type Estado = {
  nome: string
  ativo: boolean
  wa: { situacao: "desligado" | "iniciando" | "qr" | "conectado"; qr: string | null; numero: string | null; erro: string | null }
  aprender: boolean
  aprendizado: { estado?: string; mensagens?: number; conversas?: number; erro?: string }
}
type Resumo = { dias: number; conversas: number; novos: number; pedidos: number; conversao: number; total: number; ticket: number; top: { nome: string; qtd: number }[]; voce_atendeu: number; respostas_robo: number }
type Conversa = { chat: string; nome: string; fone: string; humano: number; ultima_msg_em: string; ultima: string; ultima_de: string }
type Msg = { id: number; de: string; texto: string; midia: boolean; tipo_midia: string; criado_em: string }

const fone = (s: string) => {
  const d = (s || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : ""
}
const hora = (s: string) => (s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "")
const quando = (s: string) => {
  if (!s) return ""
  const d = new Date(s), hoje = new Date()
  return d.toDateString() === hoje.toDateString() ? hora(s) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function WhatsApp() {
  const [aba, setAba] = useState<"painel" | "conversas">(() => (window.location.hash === "#whatsapp-conversas" ? "conversas" : "painel"))
  const ir = (a: "painel" | "conversas") => {
    setAba(a)
    history.replaceState(null, "", a === "conversas" ? "#whatsapp-conversas" : "#whatsapp")
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="h-display text-2xl">WhatsApp</h1>
          <p className="text-sm text-muted">Atendente com inteligência artificial: responde, manda foto dos lanches, ouve áudio e manda o pedido direto pra cá.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-coal-2 p-1">
          {(["painel", "conversas"] as const).map((a) => (
            <button key={a} onClick={() => ir(a)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${aba === a ? "bg-gold text-coal" : "text-cream/75 hover:text-cream"}`}>
              {a === "painel" ? "Painel" : "Conversas"}
            </button>
          ))}
        </div>
      </div>
      {aba === "painel" ? <Painel irConversas={() => ir("conversas")} /> : <Conversas />}
    </div>
  )
}

// ─────────────────────────────────────────── painel
function Painel({ irConversas }: { irConversas: () => void }) {
  const { token, toast } = useAdmin()
  const [e, setE] = useState<Estado | null>(null)
  const [erro, setErro] = useState("")
  const [ocupado, setOcupado] = useState("")
  const [dias, setDias] = useState(1)
  const [r, setR] = useState<Resumo | null>(null)

  const carregar = useCallback(async () => {
    try {
      setE(await atende<Estado>("estado", token))
      setErro("")
    } catch (x) {
      setErro(errMsg(x))
    }
  }, [token])
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 3000)
    return () => clearInterval(t)
  }, [carregar])
  useEffect(() => {
    let vivo = true
    const f = () => atende<Resumo>("resumo", token, { dias }).then((x) => vivo && setR(x)).catch(() => {})
    f()
    const t = setInterval(f, 30000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [token, dias])

  const acao = async (a: string, ok?: string) => {
    setOcupado(a)
    try {
      const res = await atende<{ itens?: number }>("acao", token, { acao: a })
      if (ok) toast(a === "sincronizar" && res.itens != null ? `${ok}: ${res.itens} itens` : ok, "ok")
      await carregar()
    } catch (x) {
      toast(errMsg(x), "err")
    } finally {
      setOcupado("")
    }
  }

  if (!e) return <div className="grid place-items-center py-24 text-muted">{erro ? <p className="err">{erro}</p> : <Loader2 className="animate-spin" />}</div>

  const ap = e.aprendizado || {}
  const apTxt =
    ap.estado === "recebendo"
      ? `Lendo suas conversas do WhatsApp: ${ap.mensagens ?? 0} mensagens de ${ap.conversas ?? 0} clientes…`
      : ap.estado === "analisando"
        ? "Estudando como você atende seus clientes…"
        : ap.estado === "analisado"
          ? `Pronto! O atendente aprendeu seu jeito de atender com ${ap.conversas ?? 0} conversas.`
          : ap.estado === "pouco"
            ? "Chegaram poucas conversas antigas pra aprender. O atendente usa o jeito padrão por enquanto."
            : ap.estado === "erro"
              ? "Não deu pra aprender com as conversas agora."
              : "Quando você conectar, o atendente lê as conversas recentes e aprende o seu jeito de atender (depois apaga as mensagens e guarda só o aprendizado)."

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="panel p-5">
          {e.wa.situacao === "conectado" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-[#1faa53]/20 text-[#3ddc84]"><Smartphone size={22} /></span>
                <div className="flex-1">
                  <p className="font-semibold">WhatsApp conectado</p>
                  <p className="text-sm text-muted">{e.wa.numero ? fone(e.wa.numero) : ""}</p>
                </div>
                <button className="btn-ghost" onClick={irConversas}><MessageCircle size={16} /> Ver conversas</button>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-line p-3">
                <Bot className={e.ativo ? "text-gold" : "text-muted"} size={22} />
                <div className="flex-1">
                  <p className="font-medium">{e.ativo ? "Atendente ligado" : "Atendente pausado"}</p>
                  <p className="text-xs text-muted">{e.ativo ? "Respondendo os clientes sozinho." : "Ninguém recebe resposta automática."}</p>
                </div>
                {e.ativo ? (
                  <button className="btn-ghost" disabled={!!ocupado} onClick={() => acao("pausar_robo", "Atendente pausado")}><Pause size={16} /> Pausar</button>
                ) : (
                  <button className="btn-gold" disabled={!!ocupado} onClick={() => acao("ligar_robo", "Atendente ligado")}><Play size={16} /> Ligar</button>
                )}
              </div>
              <button className="btn-ghost w-full" disabled={!!ocupado} onClick={() => confirm("Desconectar este WhatsApp do atendente?") && acao("sair", "WhatsApp desconectado")}>
                <Unplug size={16} /> Desconectar WhatsApp
              </button>
            </div>
          ) : e.wa.situacao === "qr" && e.wa.qr ? (
            <div className="grid justify-items-center gap-3 text-center">
              <img src={e.wa.qr} alt="QR code do WhatsApp" className="size-64 rounded-xl bg-white p-2" />
              <p className="font-semibold">Abra o WhatsApp no celular da loja</p>
              <p className="text-sm text-muted">Toque em ⋮ (ou Configurações) → Aparelhos conectados → Conectar aparelho, e aponte pra este código.</p>
              <button className="btn-ghost" onClick={() => acao("desconectar")}>Cancelar</button>
            </div>
          ) : e.wa.situacao === "iniciando" ? (
            <div className="grid justify-items-center gap-3 py-10 text-center text-muted"><Loader2 className="animate-spin" /><p>Conectando…</p></div>
          ) : (
            <div className="grid justify-items-center gap-3 py-6 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold"><MessageCircle size={28} /></span>
              <p className="font-semibold">Conecte o WhatsApp da loja</p>
              <p className="max-w-sm text-sm text-muted">Vai aparecer um QR code. É igual ao WhatsApp Web: o celular continua funcionando normalmente.</p>
              {e.wa.erro && <p className="err">{e.wa.erro}</p>}
              <button className="btn-gold" disabled={!!ocupado} onClick={() => acao("conectar")}>
                {ocupado === "conectar" ? <Loader2 className="animate-spin" size={18} /> : <Smartphone size={18} />} Conectar WhatsApp
              </button>
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="panel p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 shrink-0 text-gold" size={20} />
              <div className="flex-1">
                <p className="font-semibold">Aprender com as suas conversas</p>
                <p className="mt-1 text-sm text-muted">{apTxt}</p>
                {(ap.estado === "recebendo" || ap.estado === "pouco") && (
                  <button className="btn-ghost mt-3" disabled={!!ocupado} onClick={() => acao("aprender", "Aprendendo… leva uns minutos")}>Aprender agora</button>
                )}
              </div>
            </div>
          </div>
          <div className="panel p-5">
            <div className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 shrink-0 text-gold" size={20} />
              <div className="flex-1">
                <p className="font-semibold">Cardápio do atendente</p>
                <p className="mt-1 text-sm text-muted">O atendente usa os produtos, preços, adicionais, horário e frete deste painel. Ele atualiza sozinho a cada 30 minutos; mudou algo agora, sincronize.</p>
                <button className="btn-gold mt-3" disabled={!!ocupado} onClick={() => acao("sincronizar", "Cardápio sincronizado")}>
                  {ocupado === "sincronizar" ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={16} />} Sincronizar cardápio
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="flex-1 font-semibold">Resumo do WhatsApp</p>
          <div className="flex gap-1 rounded-xl border border-line p-1">
            {[[1, "Hoje"], [7, "7 dias"], [30, "30 dias"]].map(([d, t]) => (
              <button key={d} onClick={() => setDias(d as number)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${dias === d ? "bg-gold text-coal" : "text-cream/75"}`}>{t}</button>
            ))}
          </div>
        </div>
        {!r ? (
          <div className="grid place-items-center py-8 text-muted"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                [r.conversas, "clientes chamaram"],
                [r.pedidos, "pedidos fechados"],
                [`${String(r.conversao).replace(".", ",")}%`, "viraram pedido"],
                [brl(r.total), "vendido pelo WhatsApp"],
                [brl(r.ticket), "ticket médio"],
                [r.novos, "clientes novos"],
              ].map(([v, t], i) => (
                <div key={i} className="rounded-xl border border-line p-3">
                  <p className="text-xl font-bold">{v}</p>
                  <p className="text-xs text-muted">{t}</p>
                </div>
              ))}
              <p className="col-span-full text-xs text-muted">O atendente mandou {r.respostas_robo} mensagens{r.voce_atendeu ? ` · você assumiu ${r.voce_atendeu} conversa${r.voce_atendeu > 1 ? "s" : ""}` : ""}.</p>
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="mb-2 text-sm font-semibold">Mais pedidos pelo WhatsApp</p>
              {r.top.length ? (
                <ol className="space-y-1.5">
                  {r.top.map((x, i) => (
                    <li key={x.nome} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-muted">{i + 1}.</span>
                      <span className="flex-1 truncate">{x.nome}</span>
                      <b>{x.qtd}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Nenhum pedido no período ainda.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────── conversas (acompanhar e responder)
function Midia({ m }: { m: Msg }) {
  const { token } = useAdmin()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    fetch(`${ATENDE}/ext/${BOT_ID}/arquivo`, { method: "POST", headers: { "content-type": "application/json", "x-app-token": token }, body: JSON.stringify({ id: m.id }) })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (b) { u = URL.createObjectURL(b); setUrl(u) } })
      .catch(() => {})
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [m.id, token])
  if (!url) return <div className="mb-1 h-24 w-40 animate-pulse rounded-lg bg-coal-3" />
  if (m.tipo_midia.startsWith("image/")) return <img src={url} alt="" className="mb-1 max-h-60 max-w-[240px] rounded-lg" />
  if (m.tipo_midia.startsWith("audio/")) return <audio src={url} controls className="mb-1 w-56" />
  if (m.tipo_midia.startsWith("video/")) return <video src={url} controls className="mb-1 max-w-[240px] rounded-lg" />
  return <a href={url} target="_blank" rel="noopener" className="mb-1 block underline">abrir arquivo</a>
}

function Conversas() {
  const { token, toast } = useAdmin()
  const [lista, setLista] = useState<Conversa[] | null>(null)
  const [busca, setBusca] = useState("")
  const [sel, setSel] = useState<string | null>(null)
  const [conv, setConv] = useState<{ contato: { chat: string; nome: string; fone: string; humano: number }; mensagens: Msg[] } | null>(null)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const ultimoId = useRef(0)

  const carregarLista = useCallback(async () => {
    try { setLista(await atende<Conversa[]>("conversas", token, { busca })) } catch { /* tenta de novo */ }
  }, [token, busca])
  useEffect(() => {
    carregarLista()
    const t = setInterval(carregarLista, 6000)
    return () => clearInterval(t)
  }, [carregarLista])

  const carregarConv = useCallback(async () => {
    if (!sel) return
    try {
      const c = await atende<NonNullable<typeof conv>>("conversa", token, { chat: sel })
      setConv(c)
      const ult = c.mensagens[c.mensagens.length - 1]?.id || 0
      if (ult !== ultimoId.current) {
        const el = caixa.current
        const perto = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120 || ultimoId.current === 0
        ultimoId.current = ult
        if (perto) requestAnimationFrame(() => { if (caixa.current) caixa.current.scrollTop = caixa.current.scrollHeight })
      }
    } catch (x) {
      toast(errMsg(x), "err")
    }
  }, [sel, token, toast])
  useEffect(() => {
    ultimoId.current = 0
    setConv(null)
    carregarConv()
    const t = setInterval(carregarConv, 4000)
    return () => clearInterval(t)
  }, [carregarConv])

  const acao = async (a: string, ok: string) => {
    try {
      await atende("acao", token, { acao: a, chat: sel })
      toast(ok, "ok")
      carregarConv()
      carregarLista()
    } catch (x) {
      toast(errMsg(x), "err")
    }
  }
  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    const t = texto.trim()
    if (!t || !sel) return
    setEnviando(true)
    try {
      await atende("enviar", token, { chat: sel, texto: t })
      setTexto("")
      ultimoId.current = -1
      await carregarConv()
    } catch (x) {
      toast(errMsg(x), "err")
    } finally {
      setEnviando(false)
    }
  }

  const c = conv?.contato
  return (
    <div className="panel grid h-[calc(100dvh-220px)] min-h-[480px] overflow-hidden lg:grid-cols-[320px_1fr]">
      {/* lista */}
      <div className={`flex min-h-0 flex-col border-line lg:border-r ${sel ? "hidden lg:flex" : "flex"}`}>
        <div className="border-b border-line p-3">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-coal px-3">
            <Search size={16} className="text-muted" />
            <input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Buscar nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!lista ? (
            <div className="grid place-items-center py-16 text-muted"><Loader2 className="animate-spin" /></div>
          ) : !lista.length ? (
            <p className="p-6 text-center text-sm text-muted">Nenhuma conversa ainda.</p>
          ) : (
            lista.map((k) => (
              <button key={k.chat} onClick={() => setSel(k.chat)} className={`block w-full border-b border-line/60 px-4 py-3 text-left transition hover:bg-coal-3 ${sel === k.chat ? "bg-coal-3" : ""}`}>
                <div className="flex items-center gap-2">
                  <p className="flex-1 truncate font-medium">{k.nome || fone(k.fone) || "Cliente"}</p>
                  <span className="text-[11px] text-muted">{quando(k.ultima_msg_em)}</span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {k.humano ? <span className="mr-1 rounded bg-gold/20 px-1.5 text-[10px] font-bold text-gold">VOCÊ</span> : null}
                  {k.ultima_de === "bot" ? "Atendente: " : k.ultima_de === "humano" ? "Você: " : ""}
                  {k.ultima}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* conversa */}
      <div className={`min-h-0 flex-col ${sel ? "flex" : "hidden lg:flex"}`}>
        {!sel ? (
          <div className="grid flex-1 place-items-center p-6 text-center text-muted">
            <div><MessageCircle className="mx-auto mb-2" /><p>Escolha uma conversa pra acompanhar.</p></div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <button className="grid size-9 place-items-center rounded-full hover:bg-coal-3 lg:hidden" onClick={() => setSel(null)} aria-label="Voltar"><ArrowLeft size={18} /></button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c?.nome || fone(c?.fone || "") || "Cliente"}</p>
                <p className="text-xs text-muted">{c ? fone(c.fone) : ""} · {c?.humano ? "você está atendendo" : "atendente respondendo"}</p>
              </div>
              {c?.humano ? (
                <button className="btn-gold !px-3 !py-2 text-sm" onClick={() => acao("devolver", "O atendente voltou a responder")}><Bot size={16} /> Devolver ao atendente</button>
              ) : (
                <button className="btn-ghost !px-3 !py-2 text-sm" onClick={() => acao("assumir", "Você assumiu a conversa")}><Hand size={16} /> Assumir</button>
              )}
              <button className="btn-ghost !px-3 !py-2 text-sm" onClick={() => confirm("Reiniciar a conversa? O atendente esquece tudo o que foi falado e começa do zero na próxima mensagem.") && acao("recomecar", "Conversa reiniciada: mande uma mensagem pra começar do zero")}>
                <RotateCcw size={16} /> Reiniciar conversa
              </button>
            </div>
            <div ref={caixa} className="flex-1 space-y-2 overflow-y-auto bg-[#0b0806] px-4 py-4">
              {!conv ? (
                <div className="grid place-items-center py-16 text-muted"><Loader2 className="animate-spin" /></div>
              ) : (
                conv.mensagens.map((m) =>
                  m.de === "sistema" ? (
                    <p key={m.id} className="mx-auto w-fit max-w-[85%] rounded-lg bg-coal-3 px-3 py-1 text-center text-xs text-muted">{m.texto}</p>
                  ) : (
                    <div key={m.id} className={`flex ${m.de === "cliente" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.de === "cliente" ? "rounded-tl-sm bg-coal-3" : m.de === "humano" ? "rounded-tr-sm bg-[#1faa53]/25" : "rounded-tr-sm bg-gold/15"}`}>
                        {m.midia && <Midia m={m} />}
                        {m.texto && !/^\[(imagem|video|audio|documento)/.test(m.texto) && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                        <p className="mt-1 text-right text-[10px] text-muted">{m.de === "bot" ? "atendente · " : m.de === "humano" ? "você · " : m.de === "auto" ? "automática · " : ""}{hora(m.criado_em)}</p>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
            <form onSubmit={enviar} className="flex gap-2 border-t border-line p-3">
              <input className="field flex-1 !py-2.5" placeholder="Responder (o atendente para nesta conversa)" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <button className="btn-gold !px-4" disabled={enviando || !texto.trim()}>{enviando ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
