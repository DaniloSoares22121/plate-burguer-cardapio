/** Notinha pra impressora térmica (80 mm ou 58 mm). Monta um HTML próprio num iframe
 *  escondido e chama o print() dele — o painel não aparece no papel e o CSS da notinha
 *  não briga com o do painel. Preto no branco, fonte grande no que o motoboy lê. */
import qrcode from "../lib/qrcode.js"
import { brl, dateTime } from "../lib/format"
import { LOGO } from "../lib/images"
import { fmtKm } from "../lib/frete"
import { mapsLink, round } from "../lib/order"
import type { Order, Settings } from "../lib/types"

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export function qrSvg(text: string, px = 132): string {
  const q = qrcode(0, "M")
  q.addData(text)
  q.make()
  const n = q.getModuleCount()
  const m = 2 // margem em módulos
  let d = ""
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`
  const size = n + m * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}

type RSettings = Pick<Settings, "paperWidth" | "receiptFooter" | "whatsapp" | "storeAddress" | "instagram">

export function receiptHtml(o: Order, s: RSettings, recordId?: number): string {
  const w = s.paperWidth === 58 ? 58 : 80
  const inner = w === 58 ? 48 : 72 // área útil do papel
  const k = w === 58 ? 0.86 : 1
  const logo = new URL(LOGO, window.location.href).href
  const items = (o.items || [])
    .map((it) => {
      const sub: string[] = []
      if (it.size) sub.push(`Tamanho: ${esc(it.size)}`)
      if (it.choice) sub.push(esc(it.choice))
      for (const e of it.extras || []) sub.push(`+ ${esc(e)}`)
      if (it.qty > 1) sub.push(`${brl(it.unitPrice)} cada`)
      return `<div class="it">
        <div class="row"><span class="q">${it.qty}x</span><span class="n">${esc(it.name)}</span><span class="v">${brl(round(it.unitPrice * it.qty))}</span></div>
        ${sub.map((x) => `<div class="sub">${x}</div>`).join("")}
        ${it.note ? `<div class="obs">OBS: ${esc(it.note)}</div>` : ""}
      </div>`
    })
    .join("")
  const a = o.address
  const hasGeo = !!a && typeof a.lat === "number" && typeof a.lon === "number"
  const freteTxt =
    o.mode !== "entrega" ? "" : o.fee === null ? "a combinar" : o.fee === 0 ? "grátis" : `${brl(o.fee)}${o.km !== undefined ? ` (~${fmtKm(o.km)} km)` : ""}`
  const totalTxt = o.mode === "entrega" && o.fee === null ? `${brl(o.total)} + frete` : brl(o.total)
  const wa = (s.whatsapp || "").replace(/^55/, "")
  const waFmt = wa.length === 11 ? `(${wa.slice(0, 2)}) ${wa.slice(2, 7)}-${wa.slice(7)}` : wa
  const addr =
    o.mode === "entrega" && a
      ? `<hr class="hr"><div class="lbl">ENDEREÇO DE ENTREGA</div>
<div class="big">${esc(a.number ? `${a.street}, ${a.number}` : a.street)}</div>
${a.district ? `<div>Bairro: <b>${esc(a.district)}</b>${a.region ? ` (${esc(a.region.toLowerCase())})` : ""}</div>` : ""}
${a.complement ? `<div>Compl./ref.: ${esc(a.complement)}</div>` : ""}
${a.reference ? `<div>Ref.: ${esc(a.reference)}</div>` : ""}
${hasGeo ? `<div class="qr">${qrSvg(mapsLink(a.lat as number, a.lon as number))}<div class="small"><b>Localização do cliente</b><br>Aponte a câmera do celular para abrir no mapa.</div></div>` : ""}`
      : ""
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido ${esc(o.number)}</title>
<style>
@page { size: ${w}mm auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: ${w}mm; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: ${12 * k}px; line-height: 1.3;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.r { width: ${inner}mm; margin: 0 auto; padding: 3mm 0 6mm; }
.c { text-align: center; }
.logo { width: ${w === 58 ? 22 : 28}mm; height: auto; filter: grayscale(1) contrast(1.35); display: block; margin: 0 auto 1mm; }
.name { font-weight: 900; font-size: ${16 * k}px; letter-spacing: .03em; }
.small { font-size: ${10.5 * k}px; }
.hr { border: 0; border-top: 1.5px dashed #000; margin: 2.2mm 0; }
.hr2 { border: 0; border-top: 3px solid #000; margin: 2.2mm 0; }
.num { font-size: ${40 * k}px; font-weight: 900; line-height: 1; margin: 1mm 0; letter-spacing: .02em; }
.tag { display: inline-block; border: 2.5px solid #000; padding: .6mm 2.4mm; font-weight: 900; font-size: ${15 * k}px; margin-top: 1.5mm; }
.tag.inv { background: #000; color: #fff; }
.lbl { font-weight: 900; font-size: ${11 * k}px; letter-spacing: .08em; }
.big { font-size: ${14 * k}px; font-weight: 700; }
.row { display: flex; gap: 1.5mm; align-items: baseline; }
.q { font-weight: 900; min-width: 7mm; font-size: ${13.5 * k}px; }
.n { flex: 1; font-weight: 700; font-size: ${13.5 * k}px; }
.v { font-weight: 700; white-space: nowrap; }
.it { margin: 0 0 1.6mm; }
.sub { padding-left: 8.5mm; font-size: ${11.5 * k}px; }
.obs { margin: .8mm 0 0 8.5mm; border-left: 2px solid #000; padding-left: 1.5mm; font-weight: 700; font-size: ${12 * k}px; }
.tot { display: flex; justify-content: space-between; }
.total { font-size: ${19 * k}px; font-weight: 900; margin-top: .5mm; }
.qr { display: flex; gap: 2mm; align-items: center; margin-top: 1.5mm; }
.qr svg { flex: none; width: ${w === 58 ? 22 : 26}mm; height: auto; }
</style></head><body><div class="r">
<div class="c">
  <img class="logo" src="${esc(logo)}" alt="">
  <div class="name">PLATE BURGUER</div>
  <div class="small">Hamburgueria artesanal</div>
  ${s.storeAddress ? `<div class="small">${esc(s.storeAddress)}</div>` : ""}
  ${waFmt ? `<div class="small">WhatsApp ${esc(waFmt)}</div>` : ""}
</div>
<hr class="hr2">
<div class="c">
  <div class="lbl">PEDIDO</div>
  <div class="num">Nº ${esc(o.number)}</div>
  <div class="small">${esc(dateTime(o.createdAt))}${recordId ? ` · #${recordId}` : ""}</div>
  <div class="tag ${o.mode === "entrega" ? "inv" : ""}">${o.mode === "entrega" ? "ENTREGA" : "RETIRADA NO LOCAL"}</div>
</div>
<hr class="hr">
<div class="lbl">CLIENTE</div>
<div class="big">${esc(o.customer?.name)}</div>
<div>${esc(o.customer?.phone)}</div>
${addr}
<hr class="hr">
<div class="lbl">ITENS</div>
<div style="margin-top:1.2mm">${items}</div>
<hr class="hr">
<div class="tot"><span>Subtotal</span><span>${brl(o.subtotal)}</span></div>
${o.mode === "entrega" ? `<div class="tot"><span>Frete</span><span>${esc(freteTxt)}</span></div>` : ""}
<div class="tot total"><span>TOTAL</span><span>${esc(totalTxt)}</span></div>
<hr class="hr">
<div class="lbl">PAGAMENTO</div>
<div class="big">${esc(o.payment)}</div>
${o.notes ? `<hr class="hr"><div class="lbl">OBSERVAÇÕES</div><div class="big">${esc(o.notes)}</div>` : ""}
<hr class="hr2">
<div class="c small">${esc(s.receiptFooter || "Obrigado pela preferência! Volte sempre.")}</div>
${s.instagram ? `<div class="c small">Instagram @${esc(s.instagram.replace(/^@/, ""))}</div>` : ""}
</div></body></html>`
}

/** Imprime num iframe escondido (a "tela de impressão" da notinha). */
export function printOrder(o: Order, s: RSettings, recordId?: number): Promise<void> {
  return new Promise((resolve) => {
    document.getElementById("plate-print")?.remove()
    const f = document.createElement("iframe")
    f.id = "plate-print"
    f.title = `Notinha do pedido ${o.number}`
    f.setAttribute("aria-hidden", "true")
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
    document.body.appendChild(f)
    const doc = f.contentDocument!
    doc.open()
    doc.write(receiptHtml(o, s, recordId))
    doc.close()
    let done = false
    const go = () => {
      if (done) return
      done = true
      try {
        f.contentWindow?.focus()
        f.contentWindow?.print()
      } catch {
        /* ignore */
      }
      resolve()
    }
    const img = doc.querySelector("img")
    if (img && !img.complete) {
      img.onload = img.onerror = () => setTimeout(go, 50)
      setTimeout(go, 2500) // logo não carregou: imprime assim mesmo
    } else setTimeout(go, 50)
  })
}
