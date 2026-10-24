import { Beef, CupSoda, Drumstick, Popcorn, Salad, Sandwich, Soup, Utensils, type LucideIcon } from "lucide-react"
import { normalize } from "./format"
import type { Category } from "./types"

export const CATEGORY_ICONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "burger", label: "Hambúrguer", icon: Sandwich },
  { id: "mac", label: "Massa / Mac", icon: Soup },
  { id: "batata", label: "Batata / porção", icon: Popcorn },
  { id: "frango", label: "Frango", icon: Drumstick },
  { id: "carne", label: "Carne", icon: Beef },
  { id: "salada", label: "Salada / picles", icon: Salad },
  { id: "bebida", label: "Bebida", icon: CupSoda },
  { id: "outro", label: "Outro", icon: Utensils },
]

/** Ícone gravado na categoria; sem ele, adivinha pelo nome. */
export function categoryIconId(c: Pick<Category, "icon" | "name"> | undefined): string {
  if (!c) return "outro"
  if (c.icon && CATEGORY_ICONS.some((i) => i.id === c.icon)) return c.icon
  const n = normalize(c.name)
  if (/burg|hamb|lanche/.test(n)) return "burger"
  if (/mac|massa/.test(n)) return "mac"
  if (/batata|acompanh|porc/.test(n)) return "batata"
  if (/frango|chicken/.test(n)) return "frango"
  if (/bebida|refri|suco/.test(n)) return "bebida"
  return "outro"
}

export function CategoryIcon({ c, size = 20, className = "" }: { c: Pick<Category, "icon" | "name"> | undefined; size?: number; className?: string }) {
  const id = categoryIconId(c)
  const I = (CATEGORY_ICONS.find((x) => x.id === id) ?? CATEGORY_ICONS[CATEGORY_ICONS.length - 1]).icon
  return <I size={size} className={className} aria-hidden="true" />
}
