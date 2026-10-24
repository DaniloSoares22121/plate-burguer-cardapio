import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ArrowLeft,
  Banknote,
  Bike,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Crosshair,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  QrCode,
  ShoppingBag,
  Store,
  Trash2,
  User,
} from "lucide-react"
import { api } from "../lib/api"
import { cart, useCart } from "../lib/cart"
import { clearCustomer, EMPTY_CHECKOUT, loadCustomer, saveCustomer } from "../lib/customer"
import { brl, maskPhone } from "../lib/format"
import { deliveryOptions, fmtKm, matchBairro } from "../lib/frete"
import { currentPosition, GeoError, reverseGeocode } from "../lib/geo"
import { CategoryIcon } from "../lib/icons"
import {
  buildOrder,
  cartSubtotal,
  choiceLabel,
  computeFrete,
  extraText,
  newOrderNumber,
  orderMessage,
  paymentLabel,
  validateCheckout,
  waLink,
  type Frete,
} from "../lib/order"
import type { Catalog, Checkout, PayMethod } from "../lib/types"
import { CloseButton, Sheet, Stepper } from "../ui"
import BairroPicker from "./BairroPicker"

type Step = "cart" | "checkout" | "done"
const CLOSED_MSG = "Estamos fechados no momento — o envio de pedidos abre no horário de atendimento."

export default function CartDrawer({ open, onClose, catalog }: { open: boolean; onClose: () => void; catalog: Catalog }) {
  const items = useCart()
  const [step, setStep] = useState<Step>("cart")
  const [initial] = useState(loadCustomer)
  const [f, setF] = useState<Checkout>(initial.data)
  const [saved, setSaved] = useState(initial.saved)
  const [editing, setEditing] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sentUrl, setSentUrl] = useState("")
  const [sentNumber, setSentNumber] = useState("")
  const [sentTotal, setSentTotal] = useState("")
  const [picker, setPicker] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoMsg, setGeoMsg] = useState("")
  const s = catalog.settings

  const modes = useMemo(() => {
    const m: ("entrega" | "retirada")[] = []
    if (s.delivery !== false) m.push("entrega")
    if (s.pickup !== false) m.push("retirada")
    return m.length ? m : (["entrega"] as ("entrega" | "retirada")[])
  }, [s.delivery, s.pickup])

  useEffect(() => {
    if (!modes.includes(f.mode)) setF((x) => ({ ...x, mode: modes[0] }))
  }, [modes, f.mode])

  const options = useMemo(() => deliveryOptions(catalog), [catalog])
  // bairro lembrado que não existe mais (ou "outra" desligada) → limpa
  useEffect(() => {
    const id = f.regionId
    if (!id || id === "geo") return
    if (id === "outra" ? !s.otherRegion : !options.some((o) => o.id === id)) setF((x) => ({ ...x, regionId: "" }))
  }, [options, s.otherRegion, f.regionId])

  useEffect(() => {
    if (open && step === "done") setStep("cart")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const subtotal = cartSubtotal(items)
  const frete = computeFrete(f, catalog)
  const total = subtotal + (frete.kind === "fee" ? frete.value : 0)

  const set = <K extends keyof Checkout>(k: K, v: Checkout[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setErrors((e) => (e[k as string] ? { ...e, [k as string]: "" } : e))
  }

  const goCheckout = () => {
    // cliente que já pediu: se os dados lembrados ainda fecham um pedido, mostra só o resumo
    const e = validateCheckout(f, catalog, subtotal)
    delete e.min
    setEditing(!(saved && Object.keys(e).length === 0))
    setErrors({})
    setStep("checkout")
  }

  const forget = () => {
    clearCustomer()
    setSaved(false)
    setF(EMPTY_CHECKOUT)
    setErrors({})
    setGeoMsg("")
    setEditing(true)
  }

  const useLocation = async () => {
    setGeoMsg("")
    setGeoBusy(true)
    try {
      const pt = await currentPosition()
      setF((x) => ({ ...x, geo: pt, regionId: "geo" }))
      setErrors((e) => ({ ...e, regionId: "" }))
      setGeoBusy(false)
      const r = await reverseGeocode(pt.lat, pt.lon)
      if (r) {
        setF((x) => {
          if (x.regionId !== "geo") return x // o cliente mudou de ideia enquanto isso
          const next = { ...x }
          if (!x.address.trim() && r.road) next.address = r.number ? `${r.road}, ${r.number}` : `${r.road}, `
          if (r.suburb) next.district = matchBairro(r.suburb) || r.suburb
          return next
        })
      }
    } catch (e) {
      setGeoMsg(e instanceof GeoError ? e.message : "Não conseguimos pegar sua localização. Escolha o bairro na lista.")
    } finally {
      setGeoBusy(false)
    }
  }

  const [sending, setSending] = useState(false)
  const sendLock = useRef(false)
  const send = async () => {
    if (sendLock.current || !items.length) return
    if (!s.open) {
      setErrors({ closed: CLOSED_MSG })
      return
    }
    const e = validateCheckout(f, catalog, subtotal)
    setErrors(e)
    if (Object.keys(e).length) {
      if (Object.keys(e).some((k) => k !== "min")) setEditing(true)
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>(`[data-field="${Object.keys(e)[0]}"]`)
        first?.scrollIntoView({ behavior: "smooth", block: "center" })
      })
      return
    }
    const number = newOrderNumber()
    const order = buildOrder(items, f, catalog, number)
    const url = waLink(s.whatsapp, orderMessage(order))
    // aba aberta ANTES do await: depois dele o navegador já não conta como clique e bloqueia
    const w = s.alsoWhatsapp ? window.open("", "_blank") : null
    sendLock.current = true
    setSending(true)
    try {
      // o pedido vai pro painel do restaurante — é o canal principal
      await api("db/create", { collection: "orders", data: order }, null, { timeoutMs: 25000 })
    } catch (err) {
      w?.close()
      setErrors({ send: err instanceof Error ? err.message : "Não foi possível enviar o pedido. Tente de novo." })
      sendLock.current = false
      setSending(false)
      return
    }
    sendLock.current = false
    setSending(false)
    saveCustomer(f)
    setSaved(true)
    setSentUrl(s.alsoWhatsapp ? url : "")
    setSentNumber(number)
    setSentTotal(order.fee === null && order.mode === "entrega" ? `${brl(order.total)} + frete` : brl(order.total))
    setStep("done")
    cart.clear()
    if (s.alsoWhatsapp) {
      if (w) {
        try {
          w.opener = null
          w.location.href = url
        } catch {
          /* ignore */
        }
      }
    }
  }

  const close = () => {
    onClose()
    if (step === "done") setStep("cart")
  }

  const picked = f.regionId && f.regionId !== "geo" && f.regionId !== "outra" ? options.find((o) => o.id === f.regionId) : undefined
  const hasErrors = Object.entries(errors).some(([k, v]) => v && k !== "min" && k !== "closed" && k !== "send")

  return (
    <Sheet open={open} onClose={close} side="right" label="Sua sacola">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {step === "checkout" ? (
          <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-coal-3" onClick={() => setStep("cart")} aria-label="Voltar para a sacola">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span className="grid size-10 place-items-center text-gold">
            <ShoppingBag size={20} />
          </span>
        )}
        <h2 className="h-display flex-1 text-xl">{step === "cart" ? "Sua sacola" : step === "checkout" ? "Finalizar pedido" : "Pedido enviado"}</h2>
        <CloseButton onClick={close} className="!bg-coal-3" />
      </div>

      {step === "cart" && (
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {!items.length && (
              <div className="py-16 text-center text-muted">
                <ShoppingBag className="mx-auto mb-3 text-line" size={40} />
                Sua sacola está vazia.
              </div>
            )}
            <ul className="divide-y divide-line/70">
              {items.map((i) => {
                const c = catalog.categories.find((x) => x.id === catalog.products.find((p) => p.id === i.productId)?.categoryId)
                return (
                  <li key={i.key} className="flex gap-3 py-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-gold-2 to-gold text-coal">
                      <CategoryIcon c={c} size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold leading-snug">
                          {i.name}
                          {i.size && <span className="text-gold-2"> ({i.size})</span>}
                        </p>
                        <button type="button" aria-label={`Remover ${i.name}`} className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:text-ember-3" onClick={() => cart.remove(i.key)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {i.choice && (
                        <p className="text-[13px] text-muted">
                          {choiceLabel(i.choice.title)}: <span className="text-cream/90">{i.choice.name}</span>
                        </p>
                      )}
                      {(i.extras || []).map((e) => (
                        <p key={e.name} className="text-[13px] text-muted">+ <span className="text-cream/90">{extraText(e)}</span></p>
                      ))}
                      {i.note && <p className="text-[13px] italic text-muted">“{i.note}”</p>}
                      <div className="mt-2 flex items-center justify-between">
                        <Stepper size="sm" value={i.qty} min={0} onChange={(v) => cart.setQty(i.key, v)} />
                        <span className="price">{brl(i.unitPrice * i.qty)}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="price text-xl">{brl(subtotal)}</span>
            </div>
            {s.minOrder > 0 && subtotal < s.minOrder && items.length > 0 && (
              <p className="mb-2 text-[13px] text-ember-3">
                Pedido mínimo: {brl(s.minOrder)}. Faltam {brl(s.minOrder - subtotal)}.
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={close}>
                Continuar comprando
              </button>
              <button type="button" className="btn-gold flex-1" disabled={!items.length} onClick={goCheckout}>
                Finalizar
              </button>
            </div>
          </div>
        </>
      )}

      {step === "checkout" && (
        <>
          <form
            className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            noValidate
          >
            {!editing ? (
              <Summary f={f} pickedName={picked?.name} onEdit={() => setEditing(true)} onForget={forget} />
            ) : (
              <>
                {saved && (
                  <div className="flex items-center justify-between rounded-xl bg-coal-3/60 px-3 py-2 text-sm">
                    <span className="text-muted">Dados lembrados deste aparelho</span>
                    <button type="button" className="text-gold-2 underline-offset-2 hover:underline" onClick={forget}>
                      Não sou eu / limpar dados
                    </button>
                  </div>
                )}
                <Group title="Seus dados">
                  <Field label="Nome" error={errors.name} name="name">
                    <input className={`field ${errors.name ? "field-err" : ""}`} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" placeholder="Como podemos te chamar?" maxLength={60} />
                  </Field>
                  <Field label="WhatsApp / telefone" error={errors.phone} name="phone">
                    <input className={`field ${errors.phone ? "field-err" : ""}`} value={f.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} inputMode="tel" autoComplete="off" placeholder="(62) 99999-9999" />
                  </Field>
                </Group>

                {modes.length > 1 && (
                  <Group title="Como quer receber?">
                    <div className="grid grid-cols-2 gap-2">
                      <Choice on={f.mode === "entrega"} onClick={() => set("mode", "entrega")} icon={<Bike size={18} />} label="Entrega" />
                      <Choice on={f.mode === "retirada"} onClick={() => set("mode", "retirada")} icon={<Store size={18} />} label="Retirada" />
                    </div>
                  </Group>
                )}

                {f.mode === "entrega" && (
                  <Group title="Onde entregar?">
                    <div data-field="regionId" className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={useLocation}
                          disabled={geoBusy}
                          className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-2 text-sm font-medium transition ${
                            f.regionId === "geo" ? "border-gold bg-gold/10 text-gold-2 shadow-glow" : "border-line bg-coal-3/60 text-cream/90 hover:border-gold/40"
                          }`}
                        >
                          {geoBusy ? <Loader2 size={17} className="animate-spin" /> : <Crosshair size={17} />}
                          {geoBusy ? "Localizando…" : "Usar minha localização"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPicker(true)}
                          className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-2 text-sm font-medium transition ${
                            f.regionId && f.regionId !== "geo" ? "border-gold bg-gold/10 text-gold-2 shadow-glow" : "border-line bg-coal-3/60 text-cream/90 hover:border-gold/40"
                          }`}
                        >
                          <MapPin size={17} /> Escolher bairro
                        </button>
                      </div>
                      {geoMsg && <p className="rounded-lg bg-ember/10 px-3 py-2 text-[13px] text-ember-3">{geoMsg}</p>}
                      {errors.regionId && <p className="err">{errors.regionId}</p>}

                      {f.regionId === "geo" && f.geo && (
                        <div className="rounded-xl border border-gold/40 bg-gold/[.06] p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-medium text-cream">
                              <Crosshair size={15} className="text-gold" /> Localização capturada
                            </span>
                            <FreteTag frete={frete} />
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {f.geo.acc ? `Precisão de ~${f.geo.acc} m · ` : ""}o link do mapa vai junto no pedido
                          </p>
                          <input
                            className="field mt-2 !py-2 text-sm"
                            value={f.district}
                            onChange={(e) => set("district", e.target.value)}
                            placeholder="Bairro (opcional)"
                            maxLength={60}
                            aria-label="Bairro"
                          />
                        </div>
                      )}
                      {picked && (
                        <button type="button" onClick={() => setPicker(true)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/[.06] p-3 text-left text-sm">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-cream">{picked.name}</span>
                            {picked.km !== undefined && picked.fee !== null && <span className="block text-xs text-muted">≈ {fmtKm(picked.km)} km do restaurante</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <FreteTag frete={frete} />
                            <ChevronRight size={16} className="text-muted" />
                          </span>
                        </button>
                      )}
                    </div>
                    {f.regionId === "outra" && (
                      <Field label="Qual é o seu bairro?" error={errors.district} name="district">
                        <input className={`field ${errors.district ? "field-err" : ""}`} value={f.district} onChange={(e) => set("district", e.target.value)} placeholder="Bairro / setor" maxLength={60} />
                      </Field>
                    )}
                    <Field label="Rua e número" error={errors.address} name="address">
                      <input
                        className={`field ${errors.address ? "field-err" : ""}`}
                        value={f.address}
                        onChange={(e) => set("address", e.target.value)}
                        autoComplete="off"
                        placeholder="Ex.: Rua 10, 123"
                        maxLength={120}
                      />
                    </Field>
                    <Field label="Complemento / referência (opcional)" name="extra">
                      <input className="field" value={f.extra} onChange={(e) => set("extra", e.target.value)} placeholder="Quadra, lote, apto, perto de…" maxLength={120} />
                    </Field>
                  </Group>
                )}
                {f.mode === "retirada" && (
                  <p className="rounded-xl border border-line bg-coal-3/60 p-3 text-sm text-muted">Você retira o pedido no restaurante. Avisamos quando estiver pronto.</p>
                )}

                <Group title="Pagamento">
                  <div data-field="payment" className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["pix", "Pix", <QrCode key="p" size={18} />],
                        ["cartao", f.mode === "entrega" ? "Cartão na entrega" : "Cartão", <CreditCard key="c" size={18} />],
                        ["dinheiro", "Dinheiro", <Banknote key="d" size={18} />],
                      ] as [PayMethod, string, ReactNode][]
                    ).map(([k, label, icon]) => (
                      <Choice key={k} on={f.payment === k} onClick={() => set("payment", k)} icon={icon} label={label} small />
                    ))}
                  </div>
                  {errors.payment && <p className="err">{errors.payment}</p>}
                  {f.payment === "dinheiro" && (
                    <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                      <Field label="Troco para quanto?" error={errors.changeFor} name="changeFor">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">R$</span>
                          <input
                            className={`field pl-10 ${errors.changeFor ? "field-err" : ""}`}
                            value={f.changeFor}
                            disabled={f.noChange}
                            onChange={(e) => set("changeFor", e.target.value.replace(/[^\d,.]/g, ""))}
                            inputMode="decimal"
                            placeholder="Ex.: 100"
                          />
                        </div>
                      </Field>
                      <label className="flex min-h-[50px] items-center gap-2 text-sm text-cream/90">
                        <input
                          type="checkbox"
                          className="size-4 accent-[#ffb81c]"
                          checked={f.noChange}
                          onChange={(e) => {
                            set("noChange", e.target.checked)
                            setErrors((x) => ({ ...x, changeFor: "" }))
                          }}
                        />
                        Sem troco
                      </label>
                    </div>
                  )}
                </Group>
              </>
            )}

            <div className="panel space-y-1.5 p-4 text-[15px]">
              <Row label="Subtotal" value={brl(subtotal)} />
              {f.mode === "entrega" && (
                <Row
                  label="Frete"
                  value={
                    frete.kind === "fee"
                      ? `${frete.value === 0 ? "Grátis" : brl(frete.value)}${frete.km !== undefined ? ` (≈ ${fmtKm(frete.km)} km)` : ""}`
                      : frete.kind === "combinar"
                        ? "A combinar"
                        : "Informe o local"
                  }
                  muted={frete.kind !== "fee"}
                />
              )}
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="font-semibold">Total</span>
                <span className="price text-2xl">
                  {brl(total)}
                  {frete.kind === "combinar" && <span className="ml-1 text-sm text-muted">+ frete</span>}
                </span>
              </div>
            </div>
            <button type="submit" className="hidden" />
          </form>
          <div className="border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
            {errors.min && <p className="err mb-2">{errors.min}</p>}
            {(errors.closed || !s.open) && <p className="err mb-2">{errors.closed || CLOSED_MSG}</p>}
            {hasErrors && <p className="err mb-2">Confira os campos destacados.</p>}
            {errors.send && <p className="err mb-2" role="alert">{errors.send}</p>}
            <button type="button" className="btn-gold w-full text-base" onClick={send} disabled={!s.open || !items.length || sending}>
              {sending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} {sending ? "Enviando pedido…" : "Fazer pedido"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-10 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-emerald-500/15">
            <CheckCircle2 size={52} className="text-emerald-400" />
          </span>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">Pedido recebido!</p>
          <h3 className="font-display text-5xl leading-none text-gold-2" data-testid="order-number">nº {sentNumber}</h3>
          {sentTotal && <p className="text-cream/90">Total: <strong>{sentTotal}</strong></p>}
          <p className="max-w-xs text-[15px] text-cream/80">
            Seu pedido já chegou na nossa cozinha. Guarde o número — se precisar falar com a gente, é só informar o <strong className="text-cream">nº {sentNumber}</strong>.
          </p>
          {sentUrl && (
            <a href={sentUrl} target="_blank" rel="noopener" className="btn-wa mt-1">
              <WaIcon /> Enviar também no WhatsApp
            </a>
          )}
          <button type="button" className="btn-ghost mt-1" onClick={close}>
            Voltar ao cardápio
          </button>
        </div>
      )}
      {picker && (
        <BairroPicker
          options={options}
          value={f.regionId}
          allowOther={s.otherRegion}
          onClose={() => setPicker(false)}
          onPick={(id) => {
            // bairro escolhido na mão: o ponto do GPS (se havia) não vale mais pra entrega
            setF((x) => ({ ...x, regionId: id, geo: null, district: id === "outra" ? x.district : "" }))
            setErrors((e) => ({ ...e, regionId: "", district: "" }))
            setGeoMsg("")
            setPicker(false)
          }}
        />
      )}
    </Sheet>
  )
}

/** Resumo do cliente que volta: confere e envia, sem preencher nada. */
function Summary({ f, pickedName, onEdit, onForget }: { f: Checkout; pickedName?: string; onEdit: () => void; onForget: () => void }) {
  const where =
    f.mode === "retirada"
      ? "Retirada no restaurante"
      : [f.address.trim(), f.regionId === "geo" ? f.district || "localização do aparelho" : pickedName || f.district].filter(Boolean).join(" — ")
  const Icon = f.mode === "retirada" ? Store : f.regionId === "geo" ? Crosshair : MapPin
  return (
    <section className="rounded-2xl border border-gold/40 bg-gradient-to-b from-gold/[.08] to-transparent p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold-2">
          <User size={18} />
        </span>
        <p className="min-w-0 flex-1 truncate font-semibold text-cream">
          {f.mode === "entrega" ? "Entregar para" : "Retirar —"} {f.name.trim().split(/\s+/)[0]}
        </p>
        <button type="button" onClick={onEdit} className="btn-ghost !min-h-[36px] shrink-0 !px-3 text-sm">
          <Pencil size={14} /> Alterar
        </button>
      </div>
      <ul className="mt-3 space-y-1.5 text-[15px]">
        <li className="flex items-start gap-2 text-cream/90">
          <Icon size={16} className="mt-0.5 shrink-0 text-gold" />
          <span>
            {where}
            {f.mode === "entrega" && f.extra.trim() && <span className="block text-sm text-muted">{f.extra.trim()}</span>}
          </span>
        </li>
        <li className="flex items-start gap-2 text-cream/90">
          <Phone size={16} className="mt-0.5 shrink-0 text-gold" />
          <span>{f.phone}</span>
        </li>
        <li className="flex items-start gap-2 text-cream/90">
          <Banknote size={16} className="mt-0.5 shrink-0 text-gold" />
          <span>{paymentLabel(f)}</span>
        </li>
      </ul>
      <button type="button" onClick={onForget} className="mt-3 text-xs text-muted underline-offset-2 hover:text-cream hover:underline">
        Não sou eu / limpar dados
      </button>
    </section>
  )
}

function FreteTag({ frete }: { frete: Frete }) {
  if (frete.kind === "fee")
    return (
      <span className="font-semibold text-gold-2">
        {frete.value === 0 ? "grátis" : brl(frete.value)}
        {frete.km !== undefined && <span className="ml-1 text-xs font-normal text-muted">≈ {fmtKm(frete.km)} km</span>}
      </span>
    )
  if (frete.kind === "combinar") return <span className="text-muted">a combinar</span>
  return null
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="h-display text-sm text-gold">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, error, name, children }: { label: string; error?: string; name: string; children: ReactNode }) {
  return (
    <label className="block" data-field={name}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="err block">{error}</span>}
    </label>
  )
}

function Choice({ on, onClick, icon, label, small = false }: { on: boolean; onClick: () => void; icon: ReactNode; label: string; small?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-2 py-2 text-center font-medium leading-tight transition ${small ? "flex-col text-[13px]" : ""} ${
        on ? "border-gold bg-gold/10 text-gold-2 shadow-glow" : "border-line bg-coal-3/60 text-cream/90 hover:border-gold/40"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={muted ? "text-muted" : "text-cream"}>{value}</span>
    </div>
  )
}

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.43-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.3 11.3 0 0 0 12.04.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.7l6.1-1.6a11.33 11.33 0 0 0 5.37 1.37h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03" />
    </svg>
  )
}
