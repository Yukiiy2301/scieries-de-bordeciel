import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { DEFAULT_PRODUCTS, DEFAULT_SAWMILLS, DEFAULT_RECIPES, PERSONNEL_ROLES, uid } from "./constants";
import { useAuth } from "@/hooks/use-auth";
import type {
  ClientEntry,
  DB,
  Debt,
  Invoice,
  Order,
  Product,
  Profile,
  Recipe,
  Sale,
  SaleLine,
  Sawmill,
  StockEntry,
  StockRequest,
  WeeklyTax,
} from "./types";

type RowOf<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
type InsertOf<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
type UpdateOf<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

export function getWeekStart(d: Date): string {
  const date = new Date(d);
  // Semaine fiscale : commence le dimanche 00h00, clôture le samedi à 23h59
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function getCurrentWeekStart(): string {
  return getWeekStart(new Date());
}

export function fmtSeptims(n: number): string {
  return `${n.toFixed(2)} septims`;
}

export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function num(v: unknown): number {
  return Number(v ?? 0);
}

export function stockOf(db: DB, memberId: string, sawmillId: string, productId: string): number {
  return (
    db.stocks.find(
      (s) => s.memberId === memberId && s.sawmillId === sawmillId && s.productId === productId
    )?.quantity ?? 0
  );
}

export function globalStockOf(db: DB, sawmillId: string, productId: string): number {
  return db.stocks
    .filter((s) => s.sawmillId === sawmillId && s.productId === productId)
    .reduce((sum, s) => sum + s.quantity, 0);
}

/**
 * Bénéfice hebdomadaire d'une scierie pour un membre rattaché aux deux scieries.
 * Tous ses rachats forment un crédit commun, consommé une seule fois par ses ventes
 * des deux scieries dans l'ordre chronologique. Le solde est reporté aux semaines suivantes.
 */
function computeSharedWeeklyProfit(
  db: DB,
  sawmillId: string,
  memberId: string,
  targetWeekStart: string
): number {
  const relevantWeeks = new Set<string>();
  for (const purchase of db.purchases) {
    if (purchase.memberId === memberId) relevantWeeks.add(getWeekStart(new Date(purchase.createdAt)));
  }
  for (const sale of db.sales) {
    if (sale.status === "validated" && sale.lines.some((line) => line.memberId === memberId)) {
      relevantWeeks.add(getWeekStart(new Date(sale.createdAt)));
    }
  }

  let sharedCredit = 0;
  let targetProfit = 0;
  const weeks = [...relevantWeeks].filter((week) => week <= targetWeekStart).sort();

  for (const week of weeks) {
    const start = new Date(week + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const startMs = start.getTime();
    const endMs = end.getTime();
    const inWeek = (iso: string) => {
      const time = new Date(iso).getTime();
      return time >= startMs && time < endMs;
    };

    // La totalité des rachats de la semaine alimente le crédit avant le calcul hebdomadaire.
    sharedCredit += db.purchases
      .filter((purchase) => purchase.memberId === memberId && inWeek(purchase.createdAt))
      .reduce((sum, purchase) => sum + purchase.total, 0);

    const sales = db.sales
      .filter(
        (sale) =>
          sale.status === "validated" &&
          inWeek(sale.createdAt) &&
          sale.lines.some((line) => line.memberId === memberId)
      )
      .map((sale) => ({
        id: sale.id,
        sawmillId: sale.sawmillId,
        createdAt: sale.createdAt,
        total: sale.lines
          .filter((line) => line.memberId === memberId)
          .reduce((sum, line) => sum + line.total, 0),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

    for (const sale of sales) {
      const deducted = Math.min(sharedCredit, sale.total);
      sharedCredit -= deducted;
      const taxableSale = sale.total - deducted;
      if (week === targetWeekStart && sale.sawmillId === sawmillId) targetProfit += taxableSale;
    }
  }

  // Le solde négatif est un indicateur commun affiché dans les deux scieries.
  // Il ne s'agit pas d'une double déduction : sharedCredit reste un seul crédit,
  // qui sera consommé une seule fois par les prochaines ventes chronologiques.
  return sharedCredit > 0 ? -sharedCredit : targetProfit;
}

export function computeWeeklyTax(
  db: DB,
  sawmillId: string,
  memberId: string,
  weekStart: string
): WeeklyTax {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const inWeek = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= startMs && t < endMs;
  };
  const sawmill = db.sawmills.find((s) => s.id === sawmillId) ?? {
    taxRate: 0,
    citizenshipSeptims: 0,
    citizenshipCharcoal: 0,
  };
  const member = db.profiles.find((p) => p.id === memberId);
  const exempt = Boolean(member?.taxExempt);
  const citizenshipSeptims = exempt ? 0 : sawmill.citizenshipSeptims;
  // Pour un membre des deux scieries, les rachats forment un crédit commun consommé
  // chronologiquement par les ventes des deux scieries, sans double déduction.
  const isBoth = member?.sawmillAccess === "both";
  if (isBoth) {
    const profit = computeSharedWeeklyProfit(db, sawmillId, memberId, weekStart);
    const taxAmount = Math.max(0, profit) * sawmill.taxRate;
    return {
      profit,
      taxRate: sawmill.taxRate,
      taxAmount,
      citizenshipSeptims,
      citizenshipCharcoal: sawmill.citizenshipCharcoal,
      totalDueSeptims: Math.round((taxAmount + citizenshipSeptims) * 100) / 100,
    };
  }

  const purchaseMatches = (p: (typeof db.purchases)[number]) =>
    p.memberId === memberId && p.sawmillId === sawmillId;

  const salesTotal = db.sales
    .filter(
      (s) => s.sawmillId === sawmillId && s.status === "validated" && inWeek(s.createdAt)
    )
    .reduce(
      (sum, s) => sum + s.lines.filter((l) => l.memberId === memberId).reduce((ls, l) => ls + l.total, 0),
      0
    );

  const purchasesTotal = db.purchases
    .filter((p) => purchaseMatches(p) && inWeek(p.createdAt))
    .reduce((sum, p) => sum + p.total, 0);

  // Report des pertes : si rachats > ventes, la perte est reportée sur les semaines suivantes
  // (elle réduit le bénéfice imposable jusqu'à être absorbée).
  const relWeeks = new Set<string>();
  for (const p of db.purchases) {
    if (purchaseMatches(p)) relWeeks.add(getWeekStart(new Date(p.createdAt)));
  }
  for (const s of db.sales) {
    if (
      s.sawmillId === sawmillId &&
      s.status === "validated" &&
      s.lines.some((l) => l.memberId === memberId)
    ) {
      relWeeks.add(getWeekStart(new Date(s.createdAt)));
    }
  }
  const weekTotals = (ws: string) => {
    const st = new Date(ws + "T00:00:00").getTime();
    const en = new Date(ws + "T00:00:00");
    en.setDate(en.getDate() + 7);
    const eMs = en.getTime();
    const salesW = db.sales
      .filter(
        (s) =>
          s.sawmillId === sawmillId &&
          s.status === "validated" &&
          new Date(s.createdAt).getTime() >= st &&
          new Date(s.createdAt).getTime() < eMs
      )
      .reduce(
        (sum, s) =>
          sum + s.lines.filter((l) => l.memberId === memberId).reduce((ls, l) => ls + l.total, 0),
        0
      );
    const purW = db.purchases
      .filter(
        (p) =>
          purchaseMatches(p) &&
          new Date(p.createdAt).getTime() >= st &&
          new Date(p.createdAt).getTime() < eMs
      )
      .reduce((sum, p) => sum + p.total, 0);
    return { salesW, purW };
  };

  let deficit = 0; // perte cumulée reportée
  let targetProfit = salesTotal - purchasesTotal;
  for (const ws of [...relWeeks].sort()) {
    const { salesW, purW } = weekTotals(ws);
    const weekProfit = salesW - purW;
    if (ws === weekStart) {
      targetProfit = weekProfit - deficit;
    }
    deficit = Math.max(0, deficit - weekProfit);
  }
  const profit = targetProfit;
  const taxAmount = Math.max(0, profit) * sawmill.taxRate;

  return {
    profit,
    taxRate: sawmill.taxRate,
    taxAmount,
    citizenshipSeptims,
    citizenshipCharcoal: sawmill.citizenshipCharcoal,
    totalDueSeptims: Math.round((taxAmount + citizenshipSeptims) * 100) / 100,
  };
}

export function openDebtsFor(db: DB, creditorId: string, sawmillId?: string): { debtorId: string; amount: number }[] {
  return db.debts
    .filter(
      (d) => d.creditorId === creditorId && d.status === "open" && (!sawmillId || d.sawmillId === sawmillId)
    )
    .map((d) => ({ debtorId: d.debtorId, amount: d.amount }));
}

/** Dettes ouvertes groupées par débiteur : un seul total par personne. */
export function openDebtsSummary(
  db: DB,
  creditorId: string,
  sawmillId?: string
): { debtorId: string; amount: number; count: number }[] {
  const map = new Map<string, { debtorId: string; amount: number; count: number }>();
  for (const d of db.debts) {
    if (d.creditorId === creditorId && d.status === "open" && (!sawmillId || d.sawmillId === sawmillId)) {
      const entry = map.get(d.debtorId) ?? { debtorId: d.debtorId, amount: 0, count: 0 };
      entry.amount += d.amount;
      entry.count += 1;
      map.set(d.debtorId, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export interface ClientRelance {
  id: string;
  name: string;
  lastActive: string | null;
  /** Date utilisée pour le décompte : dernière activité, ou création de la fiche/du compte si aucune. */
  referenceDate: string;
  /** Nombre de semaines pleines depuis la dernière activité ou, à défaut, depuis la création. */
  weeks: number;
}

/** Clients (fiches + comptes sans fiche) sans activité depuis au moins une semaine. */
export function clientRelance(db: DB): ClientRelance[] {
  const now = new Date();
  const out: ClientRelance[] = [];
  const WEEK = 7 * 24 * 3600 * 1000;

  const lastOf = (dates: string[]): string | null => {
    if (!dates.length) return null;
    return dates.reduce((a, b) => (a > b ? a : b));
  };
  const push = (id: string, name: string, createdAt: string, dates: string[]) => {
    const last = lastOf(dates);
    // Sans commande ni vente, le décompte commence à la création de la fiche/du compte.
    const referenceDate = last ?? createdAt;
    const weeks = Math.max(0, Math.floor((now.getTime() - new Date(referenceDate).getTime()) / WEEK));
    if (weeks >= 1) out.push({ id, name, lastActive: last, referenceDate, weeks });
  };

  for (const e of db.clientEntries) {
    const dates = [
      ...db.sales.filter((s) => s.status === "validated" && s.clientLabel === e.name).map((s) => s.createdAt),
      ...db.orders.filter((o) => o.clientEntryId === e.id).map((o) => o.createdAt),
    ];
    push(e.id, e.name, e.createdAt, dates);
  }
  // Comptes clients non liés à une fiche (sinon déjà couverts par leur fiche)
  const coveredNames = new Set(db.clientEntries.map((e) => e.name));
  for (const p of db.profiles.filter((x) => x.role === "client" && !x.clientEntryId)) {
    if (coveredNames.has(p.name)) continue;
    const dates = [
      ...db.sales.filter((s) => s.status === "validated" && s.clientLabel === p.name).map((s) => s.createdAt),
      ...db.orders.filter((o) => o.clientId === p.id).map((o) => o.createdAt),
    ];
    push(p.id, p.name, p.createdAt, dates);
  }
  return out.sort((a, b) => b.weeks - a.weeks || (a.lastActive ?? "").localeCompare(b.lastActive ?? ""));
}

export function memberWorksAt(access: string | undefined, sawmillId: string): boolean {
  return access === "both" || access === sawmillId;
}

const emptyDB: DB = {
  version: 1,
  profiles: [],
  clientEntries: [],
  sawmills: DEFAULT_SAWMILLS,
  products: DEFAULT_PRODUCTS,
  recipes: DEFAULT_RECIPES,
  stocks: [],
  stockRequests: [],
  purchases: [],
  sales: [],
  debts: [],
  orders: [],
  settlementPayments: [],
  invoices: [],
};

async function loadAll(): Promise<DB> {
  const [profilesR, entriesR, sawmillsR, productsR, recipesR, stocksR, reqsR, reqLinesR, purR, salesR, linesR, debtsR, ordersR, settleR, invR] =
    await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("client_entries").select("*"),
      supabase.from("sawmills").select("*"),
      supabase.from("products").select("*"),
      supabase.from("recipes").select("*"),
      supabase.from("member_stocks").select("*"),
      supabase.from("stock_requests").select("*"),
      supabase.from("stock_request_lines").select("*"),
      supabase.from("purchases").select("*"),
      supabase.from("sales").select("*"),
      supabase.from("sale_lines").select("*"),
      supabase.from("debts").select("*"),
      supabase.from("orders").select("*"),
      supabase.from("settlements").select("*"),
      supabase.from("invoices").select("*"),
    ]);

  const profiles: Profile[] = (profilesR.data ?? []).map((p: RowOf<"profiles">) => ({
    id: p.id,
    name: p.name ?? "",
    role: p.role ?? "visiteur",
    email: p.email ?? undefined,
    requestedRole: p.requested_role ?? "visiteur",
    sawmillAccess: p.sawmill_access ?? "both",
    clientEntryId: p.client_entry_id ?? null,
    pendingEntryId: p.pending_entry_id ?? null,
    taxExempt: p.tax_exempt ?? false,
    discountPercent: num(p.discount_percent),
    createdAt: p.created_at,
  }));

  const clientEntries: ClientEntry[] = (entriesR.data ?? []).map((e: RowOf<"client_entries">) => ({
    id: e.id,
    name: e.name,
    discountPercent: num(e.discount_percent),
    note: e.note ?? undefined,
    createdAt: e.created_at,
  }));

  const sawmills: Sawmill[] = (sawmillsR.data ?? []).map((s: RowOf<"sawmills">) => ({
    id: s.id,
    name: s.name,
    taxRate: num(s.tax_rate),
    citizenshipSeptims: num(s.citizenship_septims),
    citizenshipCharcoal: num(s.citizenship_charcoal),
  }));

  const products: Product[] = (productsR.data ?? []).map((p: RowOf<"products">) => ({
    id: p.id,
    name: p.name,
    salePrice: num(p.sale_price),
    buybackPrice: num(p.buyback_price),
    sellable: p.sellable,
    buyable: p.buyable,
    sortOrder: p.sort_order,
    criticalThreshold: num(p.critical_threshold),
    criticalEnabled: p.critical_enabled,
  }));

  const recipes: Recipe[] = (recipesR.data ?? []).map((r: RowOf<"recipes">) => ({
    id: r.id,
    name: r.name,
    ingredients: Array.isArray(r.ingredients)
      ? (r.ingredients as unknown as Recipe["ingredients"])
      : [],
    sortOrder: r.sort_order,
  }));

  const stocks: StockEntry[] = (stocksR.data ?? []).map((s: RowOf<"member_stocks">) => ({
    id: s.id,
    memberId: s.member_id,
    sawmillId: s.sawmill_id,
    productId: s.product_id,
    quantity: num(s.quantity),
  }));

  const rawReqLines = reqLinesR.data ?? [];
  const reqLinesByRequest = new Map<string, StockRequestLine[]>();
  for (const l of rawReqLines) {
    const line: StockRequestLine = {
      id: l.id,
      productId: l.product_id,
      quantity: num(l.quantity),
    };
    const arr = reqLinesByRequest.get(l.request_id) ?? [];
    arr.push(line);
    reqLinesByRequest.set(l.request_id, arr);
  }

  const stockRequests: StockRequest[] = (reqsR.data ?? []).map((r: RowOf<"stock_requests">) => ({
    id: r.id,
    sawmillId: r.sawmill_id,
    memberId: r.member_id,
    lines: reqLinesByRequest.get(r.id) ?? [],
    type: r.type,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    validatedBy: r.validated_by ?? undefined,
    validatedAt: r.validated_at ?? undefined,
    note: r.note ?? undefined,
    deliveredTo: r.delivered_to ?? undefined,
  }));

  const purchases = (purR.data ?? []).map((p: RowOf<"purchases">) => ({
    id: p.id,
    sawmillId: p.sawmill_id,
    memberId: p.member_id,
    productId: p.product_id,
    quantity: num(p.quantity),
    unitPrice: num(p.unit_price),
    total: num(p.total),
    createdBy: p.created_by,
    createdAt: p.created_at,
  }));

  const sales: Sale[] = (salesR.data ?? []).map((s: RowOf<"sales">) => ({
    id: s.id,
    sawmillId: s.sawmill_id,
    lines: [],
    total: num(s.total),
    soldBy: s.sold_by,
    clientLabel: s.client_label ?? undefined,
    discountPercent: s.discount_percent ? num(s.discount_percent) : undefined,
    orderId: s.order_id ?? undefined,
    status: s.status,
    validatedBy: s.validated_by ?? undefined,
    validatedAt: s.validated_at ?? undefined,
    createdAt: s.created_at,
    note: s.note ?? undefined,
    invoiceRequested: s.invoice_requested ?? false,
  }));

  const rawLines = linesR.data ?? [];
  const linesBySale = new Map<string, SaleLine[]>();
  for (const l of rawLines) {
    const line: SaleLine = {
      id: l.id,
      memberId: l.member_id,
      productId: l.product_id,
      quantity: num(l.quantity),
      unitPrice: num(l.unit_price),
      total: num(l.total),
      fromStock: l.from_stock,
    };
    const arr = linesBySale.get(l.sale_id) ?? [];
    arr.push(line);
    linesBySale.set(l.sale_id, arr);
  }
  for (const s of sales) s.lines = linesBySale.get(s.id) ?? [];

  const debts: Debt[] = (debtsR.data ?? []).map((d: RowOf<"debts">) => ({
    id: d.id,
    sawmillId: d.sawmill_id,
    debtorId: d.debtor_id,
    creditorId: d.creditor_id,
    amount: num(d.amount),
    saleId: d.sale_id,
    productId: d.product_id ?? undefined,
    quantity: d.quantity ? num(d.quantity) : undefined,
    status: d.status,
    createdAt: d.created_at,
    settledAt: d.settled_at ?? undefined,
    settledBy: d.settled_by ?? undefined,
  }));

  const orders: Order[] = (ordersR.data ?? []).map((o: RowOf<"orders">) => ({
    id: o.id,
    sawmillId: o.sawmill_id,
    clientId: o.client_id,
    clientEntryId: o.client_entry_id ?? undefined,
    items: Array.isArray(o.items) ? (o.items as unknown as Order["items"]) : [],
    discountPercent: num(o.discount_percent),
    total: num(o.total),
    pickupTime: o.pickup_time ?? "",
    deliveryNote: o.delivery_note ?? "",
    status: o.status,
    cancelledReason: o.cancelled_reason ?? undefined,
    cancelledAt: o.cancelled_at ?? undefined,
    cancelledBy: o.cancelled_by ?? undefined,
    invoiceRequested: o.invoice_requested ?? false,
    createdAt: o.created_at,
  }));

  const settlementPayments = (settleR.data ?? []).map((s: RowOf<"settlements">) => ({
    id: s.id,
    sawmillId: s.sawmill_id,
    memberId: s.member_id,
    weekStart: String(s.week_start),
    paid: s.paid,
    paidAt: s.paid_at ?? undefined,
    validatedBy: s.validated_by ?? undefined,
  }));

  const invoices: Invoice[] = (invR.data ?? []).map((i: RowOf<"invoices">) => ({
    id: i.id,
    invoiceNo: i.invoice_no,
    sawmillId: i.sawmill_id,
    kind: i.kind,
    sourceId: i.source_id,
    clientLabel: i.client_label,
    sellerLabel: i.seller_label ?? undefined,
    discountPercent: num(i.discount_percent),
    total: num(i.total),
    items: Array.isArray(i.items) ? (i.items as unknown as Invoice["items"]) : [],
    issuedBy: i.issued_by,
    issuedAt: i.issued_at,
  }));

  return {
    version: 1,
    profiles,
    clientEntries,
    sawmills: sawmills.length ? sawmills : DEFAULT_SAWMILLS,
    products: products.length ? products : DEFAULT_PRODUCTS,
    recipes: recipes.length ? recipes : DEFAULT_RECIPES,
    stocks,
    stockRequests,
    purchases,
    sales,
    debts,
    orders,
    settlementPayments,
    invoices,
  };
}

/** Enregistre la taxe de la semaine écoulée (clôture samedi 23h59) pour chaque membre actif, si ce n'est pas déjà fait. */
async function finalizeClosedWeek(db: DB): Promise<boolean> {
  const now = new Date();
  const closedStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 3600 * 1000));
  const end = new Date(closedStart + "T00:00:00");
  end.setDate(end.getDate() + 7);
  const startMs = new Date(closedStart + "T00:00:00").getTime();
  const endMs = end.getTime();
  const inClosed = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= startMs && t < endMs;
  };
  const already = new Set(
    db.settlementPayments
      .filter((s) => s.weekStart === closedStart)
      .map((s) => `${s.sawmillId}|${s.memberId}`)
  );
  const rows = [];
  for (const sawmill of db.sawmills) {
    for (const m of db.profiles.filter(
      (p) => PERSONNEL_ROLES.includes(p.role) && memberWorksAt(p.sawmillAccess, sawmill.id)
    )) {
      if (already.has(`${sawmill.id}|${m.id}`)) continue;
      const hasActivity =
        db.purchases.some(
          (p) =>
            p.memberId === m.id &&
            (p.sawmillId === sawmill.id || m.sawmillAccess === "both") &&
            inClosed(p.createdAt)
        ) ||
        db.sales.some(
          (s) =>
            s.sawmillId === sawmill.id &&
            s.status === "validated" &&
            s.lines.some((l) => l.memberId === m.id) &&
            inClosed(s.createdAt)
        );
      if (!hasActivity) continue;
      const t = computeWeeklyTax(db, sawmill.id, m.id, closedStart);
      rows.push({
        sawmill_id: sawmill.id,
        member_id: m.id,
        week_start: closedStart,
        tax_amount: t.taxAmount,
        citizenship_septims: t.citizenshipSeptims,
        citizenship_charcoal: t.citizenshipCharcoal,
        total_due: t.totalDueSeptims,
        paid: false,
      } as InsertOf<"settlements">);
    }
  }
  if (!rows.length) return false;
  await supabase.from("settlements").upsert(rows, { onConflict: "sawmill_id,member_id,week_start" });
  return true;
}

export interface StoreApi {
  db: DB;
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (
    id: string,
    patch: Partial<
      Pick<
        Profile,
        | "name"
        | "role"
        | "discountPercent"
        | "requestedRole"
        | "sawmillAccess"
        | "clientEntryId"
        | "pendingEntryId"
        | "taxExempt"
      >
    >
  ) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  addClientEntry: (name: string, discountPercent?: number, note?: string) => Promise<void>;
  updateClientEntry: (id: string, patch: Partial<ClientEntry>) => Promise<void>;
  deleteClientEntry: (id: string) => Promise<void>;
  addPurchase: (memberId: string, sawmillId: string, productId: string, quantity: number) => Promise<void>;
  createStockRequest: (
    createdBy: string,
    memberId: string,
    sawmillId: string,
    lines: { productId: string; quantity: number }[],
    type: "depot" | "retrait",
    note?: string,
    deliveredTo?: string
  ) => Promise<void>;
  resolveStockRequest: (id: string, action: "validated" | "rejected", byId: string) => Promise<void>;
  createSale: (input: {
    lines: { memberId: string; productId: string; quantity: number; fromStock: boolean; total?: number }[];
    sawmillId: string;
    soldBy: string;
    clientLabel?: string;
    discountPercent?: number;
    note?: string;
    /** Une facture a été demandée par le vendeur */
    invoiceRequested?: boolean;
  }) => Promise<string>;
  resolveSale: (id: string, action: "validated" | "rejected", byId: string) => Promise<void>;
  /** Corrige le nom du client d'une vente (oubli ou erreur), par ex. avant d'éditer une facture */
  updateSaleClientLabel: (id: string, clientLabel: string) => Promise<void>;
  settleDebt: (id: string, byId: string) => Promise<void>;
  createOrder: (order: Omit<Order, "id" | "createdAt" | "status">) => Promise<string>;
  updateOrderStatus: (id: string, status: Order["status"]) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  /** Prise en charge d'une commande client : répartit chaque produit entre un ou plusieurs membres
   *  (stock débité), enregistre la vente associée (dette auto au membre fournisseur, comptée dans les taxes). */
  fulfilOrder: (
    orderId: string,
    allocations: { productId: string; memberId: string; quantity: number }[],
    byId: string
  ) => Promise<void>;
  /** Annule une commande prise en charge (client absent…) : restitue les stocks débités, supprime la vente
   *  et les dettes associées, et enregistre le motif d'annulation sur la commande / la fiche du client. */
  cancelOrder: (orderId: string, reason: string, byId: string) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  updateSawmill: (id: string, patch: Partial<Sawmill>) => Promise<void>;
  updateRecipe: (id: string, ingredients: Recipe["ingredients"]) => Promise<void>;
  setSettlementPaid: (
    sawmillId: string,
    memberId: string,
    weekStart: string,
    paid: boolean,
    byId: string
  ) => Promise<void>;
  resetData: () => Promise<void>;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [db, setDb] = useState<DB>(emptyDB);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadAll();
    setDb(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    if (!userId) {
      setDb(emptyDB);
      setLoading(false);
      return;
    }
    void refresh();
  }, [userId, refresh]);

  // Synchronisation temps réel : dès qu'un changement arrive, on recharge
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("sawmill-realtime")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [userId, refresh]);

  // À la clôture de la semaine (samedi 23h59), on enregistre la taxe de la semaine écoulée (une fois)
  const [finalized, setFinalized] = useState(false);
  useEffect(() => {
    if (!userId || finalized || loading) return;
    setFinalized(true);
    void (async () => {
      try {
        const changed = await finalizeClosedWeek(db);
        if (changed) await refresh();
      } catch {
        // silencieux : l'enregistrement sera retenté à la prochaine ouverture
      }
    })();
  }, [userId, finalized, loading, db, refresh]);

  const api = useMemo<StoreApi>(() => {
    const now = () => new Date().toISOString();

    const findStockId = (memberId: string, sawmillId: string, productId: string) =>
      db.stocks.find(
        (s) => s.memberId === memberId && s.sawmillId === sawmillId && s.productId === productId
      )?.id;

    const upsertStockDb = async (memberId: string, sawmillId: string, productId: string, delta: number) => {
      const existingId = findStockId(memberId, sawmillId, productId);
      const current = existingId ? db.stocks.find((s) => s.id === existingId)?.quantity ?? 0 : 0;
      const next = Math.max(0, current + delta);
      if (existingId) {
        await supabase.from("member_stocks").update({ quantity: next } as UpdateOf<"member_stocks">).eq("id", existingId);
      } else {
        await supabase
          .from("member_stocks")
          .insert({
            id: uid(),
            member_id: memberId,
            sawmill_id: sawmillId,
            product_id: productId,
            quantity: next,
          } as InsertOf<"member_stocks">);
      }
    };

    return {
      db,
      loading,
      refresh,

      updateProfile: async (id, patch) => {
        const payload: UpdateOf<"profiles"> = {};
        if (patch.name !== undefined) payload.name = patch.name;
        if (patch.role !== undefined) payload.role = patch.role;
        if (patch.discountPercent !== undefined) payload.discount_percent = patch.discountPercent;
        if (patch.requestedRole !== undefined) payload.requested_role = patch.requestedRole;
        if (patch.sawmillAccess !== undefined) payload.sawmill_access = patch.sawmillAccess;
        if (patch.clientEntryId !== undefined) payload.client_entry_id = patch.clientEntryId;
        if (patch.pendingEntryId !== undefined) payload.pending_entry_id = patch.pendingEntryId;
        if (patch.taxExempt !== undefined) payload.tax_exempt = patch.taxExempt;
        await supabase.from("profiles").update(payload).eq("id", id);
        await refresh();
      },

      deleteProfile: async (id) => {
        await supabase.from("profiles").delete().eq("id", id);
        await refresh();
      },

      addClientEntry: async (name, discountPercent = 0, note) => {
        await supabase
          .from("client_entries")
          .insert({ name, discount_percent: discountPercent, note } as InsertOf<"client_entries">);
        await refresh();
      },

      updateClientEntry: async (id, patch) => {
        const current = db.clientEntries.find((entry) => entry.id === id);
        const nextName = patch.name?.trim();
        if (patch.name !== undefined && !nextName) throw new Error("Le nom du client ne peut pas être vide.");

        // Les ventes historiques sont liées aux fiches par leur libellé : lors d'une correction
        // du nom, on conserve leur rattachement à la fiche en mettant ce libellé à jour.
        if (current && nextName && nextName !== current.name) {
          const { error: salesError } = await supabase
            .from("sales")
            .update({ client_label: nextName } as UpdateOf<"sales">)
            .eq("client_label", current.name);
          if (salesError) throw salesError;
        }

        const payload: UpdateOf<"client_entries"> = {};
        if (nextName !== undefined) payload.name = nextName;
        if (patch.discountPercent !== undefined) payload.discount_percent = patch.discountPercent;
        if (patch.note !== undefined) payload.note = patch.note.trim() || null;
        const { error } = await supabase.from("client_entries").update(payload).eq("id", id);
        if (error) throw error;
        await refresh();
      },

      deleteClientEntry: async (id) => {
        await supabase.from("client_entries").delete().eq("id", id);
        await refresh();
      },

      addPurchase: async (memberId, sawmillId, productId, quantity) => {
        const product = db.products.find((p) => p.id === productId);
        if (!product) return;
        const total = Math.round(product.buybackPrice * quantity * 100) / 100;
        await supabase
          .from("purchases")
          .insert({
            sawmill_id: sawmillId,
            member_id: memberId,
            product_id: productId,
            quantity,
            unit_price: product.buybackPrice,
            total,
            created_by: memberId,
          } as InsertOf<"purchases">);
        // NOTE : le rachat est enregistré mais n'entre PAS en stock automatiquement.
        // La personne fait ensuite un dépôt si elle souhaite déposer ce qu'elle a acheté.
        await refresh();
      },

      createStockRequest: async (createdBy, memberId, sawmillId, lines, type, note, deliveredTo) => {
        // Vérification du stock pour les retraits
        if (type === "retrait") {
          const shortages: string[] = [];
          for (const l of lines) {
            const avail = stockOf(db, memberId, sawmillId, l.productId);
            if (avail < l.quantity) {
              const p = db.products.find((x) => x.id === l.productId);
              const m = db.profiles.find((x) => x.id === memberId);
              shortages.push(
                `${p?.name ?? l.productId} (stock de ${m?.name ?? "?"} : ${fmtQty(avail)} dispo, ${fmtQty(l.quantity)} demandé)`
              );
            }
          }
          if (shortages.length) {
            throw new Error(`Retrait refusé, stock insuffisant : ${shortages.join(" ; ")}.`);
          }
        }
        const creator = db.profiles.find((p) => p.id === createdBy);
        const auto = Boolean(creator && (creator.role === "admin" || creator.role === "gestionnaire"));
        const requestId = uid();
        const validatedAt = auto ? now() : null;
        await supabase
          .from("stock_requests")
          .insert({
            id: requestId,
            sawmill_id: sawmillId,
            member_id: memberId,
            type,
            status: auto ? "validated" : "pending",
            created_by: createdBy,
            validated_by: auto ? createdBy : null,
            validated_at: validatedAt,
            note,
            delivered_to: deliveredTo ?? null,
          } as InsertOf<"stock_requests">);
        await supabase
          .from("stock_request_lines")
          .insert(
            lines.map((l) => ({
              request_id: requestId,
              product_id: l.productId,
              quantity: l.quantity,
            })) as InsertOf<"stock_request_lines">[]
          );
        // Gestionnaires / chef : appliqué immédiatement, pas de validation requise
        if (auto) {
          const sign = type === "depot" ? 1 : -1;
          for (const line of lines) {
            await upsertStockDb(memberId, sawmillId, line.productId, sign * line.quantity);
          }
        }
        await refresh();
      },

      resolveStockRequest: async (id, action, byId) => {
        const req = db.stockRequests.find((r) => r.id === id);
        // Vérification du stock avant de valider un retrait
        if (req && action === "validated" && req.type === "retrait") {
          const shortages: string[] = [];
          for (const line of req.lines) {
            const avail = stockOf(db, req.memberId, req.sawmillId, line.productId);
            if (avail < line.quantity) {
              const p = db.products.find((x) => x.id === line.productId);
              shortages.push(
                `${p?.name ?? line.productId} (stock de ${db.profiles.find((x) => x.id === req.memberId)?.name ?? "?"} : ${fmtQty(avail)} dispo, ${fmtQty(line.quantity)} demandé)`
              );
            }
          }
          if (shortages.length) {
            throw new Error(`Retrait refusé, stock insuffisant : ${shortages.join(" ; ")}.`);
          }
        }
        await supabase
          .from("stock_requests")
          .update({ status: action, validated_by: byId, validated_at: now() } as UpdateOf<"stock_requests">)
          .eq("id", id);
        if (req && action === "validated") {
          const sign = req.type === "depot" ? 1 : -1;
          for (const line of req.lines) {
            await upsertStockDb(req.memberId, req.sawmillId, line.productId, sign * line.quantity);
          }
        }
        await refresh();
      },

      createSale: async ({ lines, sawmillId, soldBy, clientLabel, discountPercent, note, invoiceRequested }) => {
        // Vérification des stocks avant toute vente prélevée sur du stock
        const shortages: string[] = [];
        for (const l of lines) {
          if (!l.fromStock) continue;
          const avail = stockOf(db, l.memberId, sawmillId, l.productId);
          if (avail < l.quantity) {
            const p = db.products.find((x) => x.id === l.productId);
            const m = db.profiles.find((x) => x.id === l.memberId);
            shortages.push(
              `${p?.name ?? l.productId} (stock de ${m?.name ?? "?"} : ${fmtQty(avail)} dispo, ${fmtQty(l.quantity)} demandé)`
            );
          }
        }
        if (shortages.length) {
          throw new Error(`Vente refusée, stock insuffisant : ${shortages.join(" ; ")}.`);
        }
        const seller = db.profiles.find((p) => p.id === soldBy);
        const auto = Boolean(seller && (seller.role === "admin" || seller.role === "gestionnaire"));
        const saleId = uid();
        const factor = 1 - (discountPercent ?? 0) / 100;
        const saleLines = lines.map((l) => {
          const product = db.products.find((p) => p.id === l.productId);
          const computed = Math.round((product?.salePrice ?? 0) * l.quantity * factor * 100) / 100;
          return {
            id: uid(),
            sale_id: saleId,
            member_id: l.memberId,
            product_id: l.productId,
            quantity: l.quantity,
            unit_price: product?.salePrice ?? 0,
            total: l.total !== undefined ? Math.round(l.total * 100) / 100 : computed,
            from_stock: l.fromStock,
          } as InsertOf<"sale_lines">;
        });
        const total = Math.round(saleLines.reduce((sum, l) => sum + l.total, 0) * 100) / 100;
        const validatedAt = auto ? now() : null;
        await supabase
          .from("sales")
          .insert({
            id: saleId,
            sawmill_id: sawmillId,
            sold_by: soldBy,
            client_label: clientLabel,
            discount_percent: discountPercent ?? 0,
            status: auto ? "validated" : "pending",
            validated_by: auto ? soldBy : null,
            validated_at: validatedAt,
            total,
            note,
            invoice_requested: invoiceRequested ?? false,
          } as InsertOf<"sales">);
        await supabase.from("sale_lines").insert(saleLines);
        // Gestionnaires / chef : vente appliquée immédiatement, pas de validation requise
        if (auto) {
          for (const line of saleLines) {
            if (line.from_stock) {
              await upsertStockDb(line.member_id, sawmillId, line.product_id, -line.quantity);
            }
            if (line.member_id !== soldBy) {
              await supabase
                .from("debts")
                .insert({
                  sawmill_id: sawmillId,
                  debtor_id: soldBy,
                  creditor_id: line.member_id,
                  amount: line.total,
                  sale_id: saleId,
                  product_id: line.product_id,
                  quantity: line.quantity,
                  status: "open",
                } as InsertOf<"debts">);
            }
          }
        }
        await refresh();
        return saleId;
      },

      resolveSale: async (id, action, byId) => {
        const sale = db.sales.find((s) => s.id === id);
        // Vérification du stock avant de valider une vente prélevée sur du stock
        if (sale && action === "validated") {
          const shortages: string[] = [];
          for (const line of sale.lines) {
            if (!line.fromStock) continue;
            const avail = stockOf(db, line.memberId, sale.sawmillId, line.productId);
            if (avail < line.quantity) {
              const p = db.products.find((x) => x.id === line.productId);
              const m = db.profiles.find((x) => x.id === line.memberId);
              shortages.push(
                `${p?.name ?? line.productId} (stock de ${m?.name ?? "?"} : ${fmtQty(avail)} dispo, ${fmtQty(line.quantity)} demandé)`
              );
            }
          }
          if (shortages.length) {
            throw new Error(`Vente refusée, stock insuffisant : ${shortages.join(" ; ")}.`);
          }
        }
        await supabase
          .from("sales")
          .update({ status: action, validated_by: byId, validated_at: now() } as UpdateOf<"sales">)
          .eq("id", id);
        if (sale && action === "validated") {
          const seller = db.profiles.find((p) => p.id === sale.soldBy);
          const sellerIsManager = Boolean(seller && (seller.role === "admin" || seller.role === "gestionnaire"));
          for (const line of sale.lines) {
            if (line.fromStock) {
              await upsertStockDb(line.memberId, sale.sawmillId, line.productId, -line.quantity);
            }
            if (line.memberId !== sale.soldBy && sellerIsManager) {
              await supabase
                .from("debts")
                .insert({
                  sawmill_id: sale.sawmillId,
                  debtor_id: sale.soldBy,
                  creditor_id: line.memberId,
                  amount: line.total,
                  sale_id: sale.id,
                  product_id: line.productId,
                  quantity: line.quantity,
                  status: "open",
                } as InsertOf<"debts">);
            }
          }
        }
        await refresh();
      },

      updateSaleClientLabel: async (id, clientLabel) => {
        const name = clientLabel.trim();
        if (!name) throw new Error("Le nom du client ne peut pas être vide.");
        await supabase
          .from("sales")
          .update({ client_label: name } as UpdateOf<"sales">)
          .eq("id", id);
        await refresh();
      },

      settleDebt: async (id, byId) => {
        await supabase
          .from("debts")
          .update({ status: "settled", settled_at: now(), settled_by: byId } as UpdateOf<"debts">)
          .eq("id", id);
        await refresh();
      },

      createOrder: async (order) => {
        // Les commandes sont passées par les clients : elles arrivent directement « à préparer »
        const orderId = uid();
        await supabase
          .from("orders")
          .insert({
            id: orderId,
            sawmill_id: order.sawmillId,
            client_id: order.clientId,
            client_entry_id: order.clientEntryId,
            items: order.items as unknown as Json,
            discount_percent: order.discountPercent,
            total: order.total,
            pickup_time: order.pickupTime,
            delivery_note: order.deliveryNote,
            status: "new" as const,
            invoice_requested: order.invoiceRequested ?? false,
          } as InsertOf<"orders">);
        await refresh();
        return orderId;
      },

      updateOrderStatus: async (id, status) => {
        await supabase.from("orders").update({ status } as UpdateOf<"orders">).eq("id", id);
        await refresh();
      },

      deleteOrder: async (id) => {
        await supabase.from("orders").delete().eq("id", id);
        await refresh();
      },

      fulfilOrder: async (orderId, allocations, byId) => {
        const order = db.orders.find((o) => o.id === orderId);
        if (!order) throw new Error("Commande introuvable.");
        if (order.status !== "new") {
          throw new Error("Cette commande a déjà été prise en charge.");
        }
        // Fusion des répartitions identiques (même produit + même membre)
        const merged = new Map<string, { productId: string; memberId: string; quantity: number }>();
        for (const a of allocations) {
          const qty = Math.floor(a.quantity);
          if (qty < 1) continue;
          const key = `${a.productId}|${a.memberId}`;
          const prev = merged.get(key);
          if (prev) prev.quantity += qty;
          else merged.set(key, { productId: a.productId, memberId: a.memberId, quantity: qty });
        }
        const allocs = [...merged.values()];
        if (allocs.length === 0) {
          throw new Error("Aucune répartition valide : répartissez chaque produit de la commande.");
        }
        const factor = 1 - (order.discountPercent ?? 0) / 100;
        const shortages: string[] = [];
        const lines: {
          id: string;
          memberId: string;
          productId: string;
          quantity: number;
          unitPrice: number;
          total: number;
        }[] = [];
        for (const item of order.items) {
          const product = db.products.find((p) => p.id === item.productId);
          const label = product?.name ?? item.productId;
          const rows = allocs.filter((a) => a.productId === item.productId);
          const sum = rows.reduce((s, r) => s + r.quantity, 0);
          if (sum !== item.quantity) {
            throw new Error(
              `Produit « ${label} » : ${fmtQty(sum)} réparti(s) sur ${fmtQty(item.quantity)} demandé(s). Ajustez la répartition.`
            );
          }
          const productTotal = Math.round((product?.salePrice ?? 0) * item.quantity * factor * 100) / 100;
          let accounted = 0;
          rows.forEach((r, i) => {
            const avail = stockOf(db, r.memberId, order.sawmillId, r.productId);
            if (avail < r.quantity) {
              const m = db.profiles.find((x) => x.id === r.memberId);
              shortages.push(
                `${label} (stock de ${m?.name ?? "?"} : ${fmtQty(avail)} dispo, ${fmtQty(r.quantity)} demandé)`
              );
            }
            const isLast = i === rows.length - 1;
            const total = isLast
              ? Math.round((productTotal - accounted) * 100) / 100
              : Math.round(productTotal * (r.quantity / item.quantity) * 100) / 100;
            accounted += total;
            lines.push({
              id: uid(),
              memberId: r.memberId,
              productId: r.productId,
              quantity: r.quantity,
              unitPrice: product?.salePrice ?? 0,
              total,
            });
          });
        }
        if (shortages.length) {
          throw new Error(`Prise en charge refusée, stock insuffisant : ${shortages.join(" ; ")}.`);
        }
        const total = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
        const saleId = uid();
        const clientEntry = order.clientEntryId
          ? db.clientEntries.find((e) => e.id === order.clientEntryId)
          : null;
        const clientLabel = clientEntry?.name ?? db.profiles.find((p) => p.id === order.clientId)?.name;
        const noteParts = ["Commande prise en charge"];
        if (order.pickupTime) noteParts.push(`retrait : ${order.pickupTime}`);
        if (order.deliveryNote) noteParts.push(`livraison : ${order.deliveryNote}`);
        await supabase
          .from("sales")
          .insert({
            id: saleId,
            sawmill_id: order.sawmillId,
            sold_by: byId,
            client_label: clientLabel,
            discount_percent: order.discountPercent ?? 0,
            status: "validated",
            validated_by: byId,
            validated_at: now(),
            total,
            note: noteParts.join(" · "),
            order_id: order.id,
          } as InsertOf<"sales">);
        await supabase
          .from("sale_lines")
          .insert(
            lines.map((l) => ({
              id: l.id,
              sale_id: saleId,
              member_id: l.memberId,
              product_id: l.productId,
              quantity: l.quantity,
              unit_price: l.unitPrice,
              total: l.total,
              from_stock: true,
            })) as InsertOf<"sale_lines">[]
          );
        // Débit des stocks + dette au membre fournisseur (identique à une vente validée)
        for (const l of lines) {
          await upsertStockDb(l.memberId, order.sawmillId, l.productId, -l.quantity);
          if (l.memberId !== byId) {
            await supabase
              .from("debts")
              .insert({
                sawmill_id: order.sawmillId,
                debtor_id: byId,
                creditor_id: l.memberId,
                amount: l.total,
                sale_id: saleId,
                product_id: l.productId,
                quantity: l.quantity,
                status: "open",
              } as InsertOf<"debts">);
          }
        }
        await supabase.from("orders").update({ status: "taken" } as UpdateOf<"orders">).eq("id", orderId);
        await refresh();
      },

      cancelOrder: async (orderId, reason, byId) => {
        const order = db.orders.find((o) => o.id === orderId);
        if (!order) throw new Error("Commande introuvable.");
        if (order.status !== "taken") {
          throw new Error("Seule une commande « prise en charge » peut être annulée.");
        }
        const motif = (reason ?? "").trim();
        if (!motif) {
          throw new Error("Indiquez le motif de l'annulation (il sera enregistré sur la fiche client).");
        }
        const sale = db.sales.find((s) => s.orderId === orderId);
        if (sale) {
          // Restitution des stocks aux membres fournisseurs
          for (const line of sale.lines) {
            if (line.fromStock) {
              await upsertStockDb(line.memberId, sale.sawmillId, line.productId, line.quantity);
            }
          }
          await supabase.from("debts").delete().eq("sale_id", sale.id);
          await supabase.from("sale_lines").delete().eq("sale_id", sale.id);
          await supabase.from("sales").delete().eq("id", sale.id);
        }
        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            cancelled_reason: motif,
            cancelled_at: now(),
            cancelled_by: byId,
          } as UpdateOf<"orders">)
          .eq("id", orderId);
        await refresh();
      },

      updateProduct: async (id, patch) => {
        const payload: UpdateOf<"products"> = {};
        if (patch.salePrice !== undefined) payload.sale_price = patch.salePrice;
        if (patch.buybackPrice !== undefined) payload.buyback_price = patch.buybackPrice;
        if (patch.name !== undefined) payload.name = patch.name;
        if (patch.criticalThreshold !== undefined) payload.critical_threshold = patch.criticalThreshold;
        if (patch.criticalEnabled !== undefined) payload.critical_enabled = patch.criticalEnabled;
        await supabase.from("products").update(payload).eq("id", id);
        await refresh();
      },

      updateSawmill: async (id, patch) => {
        const payload: UpdateOf<"sawmills"> = {};
        if (patch.taxRate !== undefined) payload.tax_rate = patch.taxRate;
        if (patch.citizenshipSeptims !== undefined) payload.citizenship_septims = patch.citizenshipSeptims;
        if (patch.citizenshipCharcoal !== undefined) payload.citizenship_charcoal = patch.citizenshipCharcoal;
        await supabase.from("sawmills").update(payload).eq("id", id);
        await refresh();
      },

      updateRecipe: async (id, ingredients) => {
        await supabase
          .from("recipes")
          .update({ ingredients: ingredients as unknown as Json } as UpdateOf<"recipes">)
          .eq("id", id);
        await refresh();
      },

      setSettlementPaid: async (sawmillId, memberId, weekStart, paid, byId) => {
        const existing = db.settlementPayments.find(
          (s) => s.sawmillId === sawmillId && s.memberId === memberId && s.weekStart === weekStart
        );
        if (existing) {
          await supabase
            .from("settlements")
            .update({ paid, paid_at: paid ? now() : null, validated_by: paid ? byId : null } as UpdateOf<"settlements">)
            .eq("id", existing.id);
        } else {
          await supabase
            .from("settlements")
            .insert({
              sawmill_id: sawmillId,
              member_id: memberId,
              week_start: weekStart,
              tax_amount: 0,
              citizenship_septims: 0,
              citizenship_charcoal: 0,
              total_due: 0,
              paid,
              paid_at: paid ? now() : null,
              validated_by: paid ? byId : null,
            } as InsertOf<"settlements">);
        }
        await refresh();
      },

      resetData: async () => {
        await supabase.from("member_stocks").delete().neq("id", "");
        await supabase.from("stock_request_lines").delete().neq("id", "");
        await supabase.from("stock_requests").delete().neq("id", "");
        await supabase.from("purchases").delete().neq("id", "");
        await supabase.from("sale_lines").delete().neq("id", "");
        await supabase.from("sales").delete().neq("id", "");
        await supabase.from("debts").delete().neq("id", "");
        await supabase.from("orders").delete().neq("id", "");
        await supabase.from("settlements").delete().neq("id", "");
        await supabase.from("client_entries").delete().neq("id", "");
        await refresh();
      },
    };
  }, [db, loading, refresh]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore doit être utilisé dans StoreProvider");
  return ctx;
}
