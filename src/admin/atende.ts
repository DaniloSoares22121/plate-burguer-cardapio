/** Ponte com o atendente de WhatsApp (AtendeAI, da Brixly). Sem chave no site: vai o token do login deste painel,
 *  e o AtendeAI confere com este app (auth/me + admins) antes de qualquer coisa. */
export const ATENDE = "https://atendeai.brixly.com.br"
export const BOT_ID = 3

export async function atende<T>(rota: string, token: string, corpo: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${ATENDE}/ext/${BOT_ID}/${rota}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-app-token": token },
    body: JSON.stringify(corpo),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j as { error?: string }).error || `Erro ${r.status}`)
  return j as T
}

/** O WhatsApp do atendente está conectado? (os avisos de status saem sozinhos por ele; senão, abre o WhatsApp como antes) */
let conectado = false
export const atendenteConectado = () => conectado
export async function atualizarAtendente(token: string): Promise<void> {
  try {
    conectado = (await atende<{ conectado: boolean }>("ping", token)).conectado
  } catch {
    conectado = false
  }
}
