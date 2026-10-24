export type Size = { label: string; desc?: string; price: number }
export type ChoiceOpt = { name: string; extra?: number }
export type Choice = { title: string; required: boolean; options: ChoiceOpt[] }

export type Category = {
  id: number
  type: "category"
  name: string
  order: number
  highlight?: boolean
  /** aparece como "Adicionais" na ficha de outros produtos; undefined = padrão pelo nome */
  addon?: boolean
  /** ícone da categoria (pizza, doce, sanduiche, marmitex, acai, suco, creme, refri) */
  icon?: string
  /** adicionais pagos que valem pra todos os produtos da categoria (ex.: sanduíches) */
  extras?: Extra[]
}

export type Extra = { name: string; price: number }

export type Product = {
  id: number
  type: "product"
  categoryId: number
  name: string
  description: string
  /** preço único; ignorado quando há tamanhos */
  price: number | null
  sizes: Size[]
  choice: Choice | null
  image: string
  /** fotos extras (mesmo formato de image) */
  gallery?: string[]
  available: boolean
  order: number
}

export type Region = {
  id: number
  type: "region"
  name: string
  /** null = frete a combinar */
  fee: number | null
  order: number
}

export type Settings = {
  id: number
  type: "settings"
  whatsapp: string
  open: boolean
  closedMessage: string
  hoursText: string
  minOrder: number
  otherRegion: boolean
  delivery: boolean
  pickup: boolean
  deliveryTime: string
  /** endereço/instagram mostrados no rodapé e na notinha */
  instagram?: string
  /** também abre o WhatsApp com o pedido depois de gravar no painel */
  alsoWhatsapp?: boolean
  /** largura do papel da impressora térmica */
  paperWidth?: 58 | 80
  /** imprime sozinho cada pedido novo que chega no painel */
  autoPrint?: boolean
  /** rodapé da notinha */
  receiptFooter?: string
  /** frete por distância — sem localização da loja o cálculo fica desligado */
  storeLat?: number | null
  storeLon?: number | null
  storeAddress?: string
  perKm?: number
  /** Frete por FAIXA de distância (tem prioridade sobre perKm). `ateKm` inclusivo; null = daí em diante. */
  faixas?: { ateKm: number | null; preco: number }[]
  routeFactor?: number
  minFee?: number
  /** 0/ausente = sem limite */
  maxKm?: number
}

export type Catalog = {
  categories: Category[]
  products: Product[]
  regions: Region[]
  settings: Settings
}

export type CartItem = {
  key: string
  productId: number
  name: string
  size?: string
  choice?: { title: string; name: string; extra: number }
  /** adicionais escolhidos (preço já somado no unitPrice) */
  extras?: { name: string; qty: number; price: number }[]
  unitPrice: number
  qty: number
  note: string
  image: string
}

export type OrderMode = "entrega" | "retirada"
export type PayMethod = "pix" | "cartao" | "dinheiro"

export type GeoPoint = { lat: number; lon: number; acc?: number }

export type Checkout = {
  name: string
  phone: string
  mode: OrderMode
  /** rua e número num campo só */
  address: string
  /** complemento / referência (opcional) */
  extra: string
  /** "b:<bairro>" | "r:<região manual>" | "geo" (localização do aparelho) | "outra" | "" */
  regionId: string
  /** bairro digitado ("outra") ou detectado pela localização */
  district: string
  geo: GeoPoint | null
  payment: PayMethod | ""
  changeFor: string
  noChange: boolean
}

export type OrderStatus = "novo" | "preparo" | "saiu" | "pronto" | "concluido" | "cancelado" | "confirmado"

export type Order = {
  number: string
  createdAt: number
  status: OrderStatus
  customer: { name: string; phone: string }
  mode: OrderMode
  address?: {
    street: string
    number: string
    district: string
    complement: string
    reference: string
    region: string
    lat?: number
    lon?: number
  }
  fee: number | null
  km?: number
  items: { name: string; size?: string; choice?: string; extras?: string[]; qty: number; unitPrice: number; note?: string }[]
  subtotal: number
  total: number
  payment: string
  notes: string
}
