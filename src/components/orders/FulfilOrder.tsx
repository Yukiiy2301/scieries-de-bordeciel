import { useState } from "react";
import { toast } from "sonner";
import { Check, PackageCheck, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, nativeSelectClass } from "@/components/shared";
import { PERSONNEL_ROLES } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useStore, fmtQty, fmtSeptims, memberWorksAt, stockOf } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

interface Row {
  memberId: string;
  quantity: string;
}

interface Props {
  order: Order;
  onDone: () => void;
}

export default function FulfilOrder({ order, onDone }: Props) {
  const { db, fulfilOrder } = useStore();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const personnel = db.profiles
    .filter((p) => PERSONNEL_ROLES.includes(p.role) && memberWorksAt(p.sawmillAccess, order.sawmillId))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [rows, setRows] = useState<Record<string, Row[]>>(() => {
    const init: Record<string, Row[]> = {};
    for (const item of order.items) {
      const firstWithStock = personnel.find(
        (m) => stockOf(db, m.id, order.sawmillId, item.productId) >= item.quantity
      );
      init[item.productId] = [
        {
          memberId: firstWithStock?.id ?? personnel[0]?.id ?? "",
          quantity: String(item.quantity),
        },
      ];
    }
    return init;
  });

  const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? "?";
  const memberName = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? "?";
  const factor = 1 - (order.discountPercent ?? 0) / 100;
  const lineValue = (productId: string, quantity: number) =>
    Math.round(
      (db.products.find((p) => p.id === productId)?.salePrice ?? 0) * quantity * factor * 100
    ) / 100;

  const qtyOf = (r: Row) => Math.max(0, parseInt(r.quantity, 10) || 0);
  const remainingOf = (productId: string) => {
    const item = order.items.find((i) => i.productId === productId);
    if (!item) return 0;
    const sum = (rows[productId] ?? []).reduce((s, r) => s + qtyOf(r), 0);
    return item.quantity - sum;
  };

  const issues: string[] = [];
  for (const item of order.items) {
    const label = productName(item.productId);
    const productRows = rows[item.productId] ?? [];
    const used: string[] = [];
    for (const r of productRows) {
      if (!r.memberId) {
        issues.push(`${label} : choisissez un membre.`);
        continue;
      }
      if (used.includes(r.memberId)) {
        issues.push(`${label} : ${memberName(r.memberId)} est sélectionné plusieurs fois.`);
      }
      used.push(r.memberId);
      const q = qtyOf(r);
      if (q > 0) {
        const avail = stockOf(db, r.memberId, order.sawmillId, item.productId);
        if (avail < q) {
          issues.push(`${label} : ${memberName(r.memberId)} n'a que ${fmtQty(avail)} en stock (${fmtQty(q)} demandé).`);
        }
      }
    }
    const rem = remainingOf(item.productId);
    if (rem !== 0) {
      issues.push(
        rem > 0
          ? `${label} : encore ${fmtQty(rem)} à répartir.`
          : `${label} : ${fmtQty(-rem)} en trop par rapport à la commande.`
      );
    }
  }
  if (personnel.length === 0) issues.push("Aucun membre de cette scierie ne peut fournir du stock.");

  const setRow = (productId: string, index: number, patch: Partial<Row>) => {
    setRows((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? []).map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  };

  const addSplit = (productId: string) => {
    const productRows = rows[productId] ?? [];
    const usedMembers = productRows.map((r) => r.memberId);
    const free = personnel.find((m) => !usedMembers.includes(m.id));
    if (!free) return;
    const rem = remainingOf(productId);
    setRows((prev) => ({
      ...prev,
      [productId]: [
        ...(prev[productId] ?? []),
        { memberId: free.id, quantity: rem > 0 ? String(rem) : "" },
      ],
    }));
  };

  const removeSplit = (productId: string, index: number) => {
    setRows((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? []).filter((_, i) => i !== index),
    }));
  };

  const submit = async () => {
    if (busy || !user) return;
    const allocations: { productId: string; memberId: string; quantity: number }[] = [];
    for (const item of order.items) {
      for (const r of rows[item.productId] ?? []) {
        const q = qtyOf(r);
        if (q > 0 && r.memberId) allocations.push({ productId: item.productId, memberId: r.memberId, quantity: q });
      }
    }
    setBusy(true);
    try {
      await fulfilOrder(order.id, allocations, user.id);
      toast.success("Commande prise en charge", {
        description: "Stocks débités et vente enregistrée (dette auto au membre fournisseur).",
      });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = issues.length === 0 && !busy;

  return (
    <div className="rounded-lg border border-primary/40 bg-secondary/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <PackageCheck className="h-4 w-4 text-primary" />
          Répartir le prélèvement de la commande
        </p>
        <span className="text-xs text-muted-foreground">
          Total : <span className="font-semibold text-primary">{fmtSeptims(order.total)}</span>
          {order.discountPercent > 0 && <span className="ml-1">(−{order.discountPercent} %)</span>}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Pour chaque produit, choisissez qui fournit le stock. Vous pouvez partager un produit entre plusieurs
        membres : la dette revient automatiquement à chaque fournisseur, comme dans une vente.
      </p>

      <div className="space-y-3">
        {order.items.map((item) => {
          const label = productName(item.productId);
          const productRows = rows[item.productId] ?? [];
          const rem = remainingOf(item.productId);
          return (
            <div key={item.productId} className="space-y-2 rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {label} <span className="text-muted-foreground">× {fmtQty(item.quantity)}</span>
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    rem === 0 ? "text-emerald-400" : "text-amber-400"
                  )}
                >
                  {rem === 0 ? "Réparti" : rem > 0 ? `Reste ${fmtQty(rem)} à répartir` : `${fmtQty(-rem)} en trop`}
                </span>
              </div>

              {productRows.map((r, i) => {
                const q = qtyOf(r);
                const usedMembers = productRows.map((x) => x.memberId);
                return (
                  <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,7rem)_auto]">
                    <Field label="Fourni par">
                      <select
                        className={nativeSelectClass}
                        value={r.memberId}
                        onChange={(e) => setRow(item.productId, i, { memberId: e.target.value })}
                      >
                        {personnel.map((m) => {
                          const avail = stockOf(db, m.id, order.sawmillId, item.productId);
                          const alreadyUsed = usedMembers.includes(m.id) && m.id !== r.memberId;
                          return (
                            <option key={m.id} value={m.id} disabled={alreadyUsed}>
                              {m.name} — {fmtQty(avail)} dispo
                            </option>
                          );
                        })}
                      </select>
                    </Field>
                    <Field label="Quantité">
                      <Input
                        type="number"
                        min={0}
                        value={r.quantity}
                        onChange={(e) => setRow(item.productId, i, { quantity: e.target.value })}
                      />
                    </Field>
                    <div className="flex items-end gap-2 pb-1">
                      {r.memberId && q > 0 && (
                        <span
                          className={cn(
                            "text-xs",
                            stockOf(db, r.memberId, order.sawmillId, item.productId) >= q
                              ? "text-emerald-400"
                              : "text-destructive"
                          )}
                        >
                          {memberName(r.memberId)} : {fmtQty(q)} → dette {fmtSeptims(lineValue(item.productId, q))}
                        </span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={productRows.length <= 1}
                        onClick={() => removeSplit(item.productId, i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button variant="outline" size="sm" onClick={() => addSplit(item.productId)} disabled={productRows.length >= personnel.length}>
                <Plus className="h-4 w-4" /> Partager sur un autre membre
              </Button>
            </div>
          );
        })}
      </div>

      {issues.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          <X className="h-4 w-4" /> Annuler
        </Button>
        <Button onClick={() => void submit()} disabled={!canSubmit}>
          <Check className="h-4 w-4" /> Confirmer la prise en charge
        </Button>
      </div>
    </div>
  );
}
