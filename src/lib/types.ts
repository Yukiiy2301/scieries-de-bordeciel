export type Role = "admin" | "gestionnaire" | "employe" | "client" | "visiteur" | "pending";

export type RequestStatus = "pending" | "validated" | "rejected";

export interface ClientEntry {
  id: string;
  name: string;
  discountPercent: number;
  note?: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  role: Role;
  email?: string;
  /** Rôle demandé à l'inscription (en attente de validation) */
  requestedRole?: string;
  /** Scierie(s) auxquelles le compte a accès */
  sawmillAccess: "rivebois" | "penombris" | "both";
  /** Fiche client validée (liée par le chef) */
  clientEntryId?: string | null;
  /** Fiche client demandée (en attente de validation) */
  pendingEntryId?: string | null;
  /** Exonéré de la taxe de citoyenneté (géré par le chef) */
  taxExempt?: boolean;
  /** Réduction en % (pour les clients) */
  discountPercent: number;
  createdAt: string;
}

export interface Sawmill {
  id: string;
  name: string;
  /** Taux de taxe sur le bénéfice (ex: 0.30) */
  taxRate: number;
  citizenshipSeptims: number;
  citizenshipCharcoal: number;
}

export interface Product {
  id: string;
  name: string;
  salePrice: number;
  buybackPrice: number;
  sellable: boolean;
  buyable: boolean;
  sortOrder: number;
  /** Seuil critique (stock global sous lequel le stock est « critique ») */
  criticalThreshold?: number;
  /** Si le seuil critique est activé pour ce produit */
  criticalEnabled?: boolean;
}

export interface StockEntry {
  id: string;
  memberId: string;
  sawmillId: string;
  productId: string;
  quantity: number;
}

export interface StockRequestLine {
  id: string;
  productId: string;
  quantity: number;
}

export interface StockRequest {
  id: string;
  sawmillId: string;
  memberId: string;
  lines: StockRequestLine[];
  type: "depot" | "retrait";
  status: RequestStatus;
  createdBy: string;
  createdAt: string;
  validatedBy?: string;
  validatedAt?: string;
  note?: string;
  /** Où la marchandise a été remise/laissée physiquement (gestionnaire/chef, tonneau gauche ou droit) */
  deliveredTo?: string;
}

export interface Purchase {
  id: string;
  sawmillId: string;
  memberId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdBy: string;
  createdAt: string;
}

export interface SaleLine {
  id: string;
  memberId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  fromStock: boolean;
}

export interface Sale {
  id: string;
  sawmillId: string;
  lines: SaleLine[];
  total: number;
  soldBy: string;
  clientLabel?: string;
  discountPercent?: number;
  /** Commande client à l'origine de cette vente (si créée lors d'une prise en charge) */
  orderId?: string;
  status: RequestStatus;
  validatedBy?: string;
  validatedAt?: string;
  createdAt: string;
  note?: string;
  /** Le vendeur a demandé qu'une facture soit émise (le chef l'émet ensuite) */
  invoiceRequested?: boolean;
}

export interface Debt {
  id: string;
  sawmillId: string;
  debtorId: string;
  creditorId: string;
  amount: number;
  saleId: string;
  productId?: string;
  quantity?: number;
  status: "open" | "settled";
  createdAt: string;
  settledAt?: string;
  settledBy?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  sawmillId: string;
  clientId: string;
  clientEntryId?: string;
  items: OrderItem[];
  discountPercent: number;
  total: number;
  pickupTime: string;
  deliveryNote: string;
  status: "pending" | "new" | "taken" | "done" | "cancelled";
  /** Motif de l'annulation (renseigné si la commande a été annulée) */
  cancelledReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  /** Le client a demandé qu'une facture soit émise (le chef l'émet ensuite) */
  invoiceRequested?: boolean;
  createdAt: string;
}

export interface RecipeIngredient {
  key: string;
  label: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  sortOrder: number;
}

export interface SettlementPayment {
  id: string;
  sawmillId: string;
  memberId: string;
  weekStart: string;
  paid: boolean;
  paidAt?: string;
  validatedBy?: string;
}

export interface InvoiceLine {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Facture émise (par le chef) pour une vente ou une commande client. */
export interface Invoice {
  id: string;
  invoiceNo: string;
  sawmillId: string;
  kind: "sale" | "order";
  sourceId: string;
  clientLabel: string;
  sellerLabel?: string;
  discountPercent: number;
  total: number;
  items: InvoiceLine[];
  issuedBy: string;
  issuedAt: string;
}

export interface DB {
  version: number;
  profiles: Profile[];
  clientEntries: ClientEntry[];
  sawmills: Sawmill[];
  products: Product[];
  recipes: Recipe[];
  stocks: StockEntry[];
  stockRequests: StockRequest[];
  purchases: Purchase[];
  sales: Sale[];
  debts: Debt[];
  orders: Order[];
  settlementPayments: SettlementPayment[];
  invoices: Invoice[];
}

export interface WeeklyTax {
  profit: number;
  taxRate: number;
  taxAmount: number;
  citizenshipSeptims: number;
  citizenshipCharcoal: number;
  totalDueSeptims: number;
}
