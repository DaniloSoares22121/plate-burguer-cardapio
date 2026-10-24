/** Toque de novo pedido: sino sintetizado (WebAudio, sem arquivo), notificação do navegador
 *  e título piscando. O navegador só libera áudio depois de um clique na página — por isso
 *  o painel mostra "Ativar som de pedidos" e guarda a preferência. */

const PREF = "plate:som:v1"
const MUTE = "plate:mudo:v1"

let ctx: AudioContext | null = null

function store(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* sem storage */
  }
}
function read(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

export const soundPref = () => read(PREF) === "1"
export const isMuted = () => read(MUTE) === "1"
export const setMuted = (m: boolean) => store(MUTE, m ? "1" : null)
export const audioReady = () => !!ctx && ctx.state === "running"

/** Chamar dentro de um clique. Devolve true se o áudio ficou liberado. */
export async function unlockAudio(): Promise<boolean> {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return false
    if (!ctx) ctx = new AC()
    if (ctx.state !== "running") await ctx.resume()
    store(PREF, "1")
    return ctx.state === "running"
  } catch {
    return false
  }
}

/** "Ding-dong" alegre: duas notas com harmônico, ataque rápido e cauda longa. */
export function ding(): void {
  if (!ctx || ctx.state !== "running" || isMuted()) return
  const now = ctx.currentTime
  const notes: [number, number][] = [
    [1318.5, 0], // Mi6
    [987.8, 0.22], // Si5
    [1318.5, 0.62],
    [987.8, 0.84],
  ]
  const master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)
  for (const [f, t] of notes) {
    for (const [mult, vol] of [
      [1, 0.55],
      [2, 0.18],
      [3, 0.07],
    ] as [number, number][]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.frequency.value = f * mult
      g.gain.setValueAtTime(0.0001, now + t)
      g.gain.exponentialRampToValueAtTime(vol, now + t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 1.1)
      o.connect(g).connect(master)
      o.start(now + t)
      o.stop(now + t + 1.2)
    }
  }
}

export async function askNotifications(): Promise<void> {
  try {
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission()
  } catch {
    /* ignore */
  }
}

export function notify(title: string, body: string): void {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return
    const n = new Notification(title, { body, tag: "plate-pedido", requireInteraction: true, icon: "icon-192.png" })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* alguns celulares só aceitam via service worker */
  }
}

/** Liga/desliga o toque repetido + título piscando. */
let ringTimer: number | null = null
let titleTimer: number | null = null
let baseTitle = ""

export function startRinging(label: string): void {
  if (ringTimer === null) {
    ding()
    ringTimer = window.setInterval(ding, 3000)
  }
  if (titleTimer === null) {
    baseTitle = document.title
    let on = false
    titleTimer = window.setInterval(() => {
      on = !on
      document.title = on ? `🔔 ${label}` : baseTitle
    }, 900)
  }
}

export function stopRinging(): void {
  if (ringTimer !== null) window.clearInterval(ringTimer)
  if (titleTimer !== null) window.clearInterval(titleTimer)
  ringTimer = null
  if (titleTimer !== null && baseTitle) document.title = baseTitle
  titleTimer = null
}

export const isRinging = () => ringTimer !== null
