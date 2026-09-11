import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Field, PageHeader, nativeSelectClass } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import { useStore, fmtQty, fmtSeptims } from "@/lib/store";

interface Row {
  key: number;
  productId: string;
  quantity: string;
}

export default function Rachats() {
  const { db, addPurchase } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([
    { key: 0, productId: db.products[0]?.id ?? "", quantity: "1" },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [busy, setBusy] = useState(false);

  const products = [...db.products].filter((p) => p.buyable).sort((a, b) => a.sortOrder - b.sortOrder);

  const total = rows.reduce((sum, r) => {
    const p = db.products.find((x) => x.id === r.productId);
    const q = Math.max(1, parseInt(r.quantity, 10) || 0);
    return sum + (p ? p.buybackPrice * q : 0);
  }, 0);

  const purchases = db.purchases
    .filter((p) => {
      const owner = db.profiles.find((x) => x.id === p.memberId);
      return p.sawmillId === sawmillId || owner?.sawmillAccess === "both";
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { key: nextKey, productId: products[0]?.id ?? "", quantity: "1" }]);
    setNextKey((k) => k + 1);
  };

  const removeRow = (key: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const submit = async () => {
    const lines = rows
      .map((r) => ({ productId: r.productId, quantity: Math.max(1, parseInt(r.quantity, 10) || 1) }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0 || busy) return;
    setBusy(true);
    for (const l of lines) {
      await addPurchase(user!.id, sawmillId, l.productId, l.quantity);
    }
    setBusy(false);
    toast.success("Rachat enregistré", { description: "Faites un dépôt pour l'ajouter à votre stock." });
    navigate("/");
    setRows([{ key: nextKey, productId: products[0]?.id ?? "", quantity: "1" }]);
    setNextKey((k) => k + 1);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Rachats"
        subtitle="La scierie rachète charbon et bois aux joueurs. Le rachat est enregistré (et compté dans vos taxes), mais il n'entre pas en stock : faites ensuite un dépôt si vous souhaitez le déposer dans la scierie. Un rachat ne crée jamais de dette."
      />

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <ShoppingCart className="h-4 w-4 text-primary" /> Nouveau rachat ({user!.name})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {rows.map((r) => {
              const q = Math.max(1, parseInt(r.quantity, 10) || 0);
              const p = db.products.find((x) => x.id === r.productId);
              return (
                <div
                  key={r.key}
                  className="grid gap-2 rounded-md border border-border bg-secondary/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <Field label="Produit">
                    <select
                      className={nativeSelectClass}
                      value={r.productId}
                      onChange={(e) => updateRow(r.key, { productId: e.target.value })}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {fmtSeptims(p.buybackPrice)}/unité
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Quantité">
                    <Input
                      type="number"
                      min={1}
                      value={r.quantity}
                      onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                    />
                  </Field>
                  <div className="flex items-end justify-end gap-2 pb-1">
                    <span className="text-sm text-muted-foreground">
                      {fmtSeptims(p ? p.buybackPrice * q : 0)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={rows.length <= 1}
                      onClick={() => removeRow(r.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" /> Ajouter un produit
          </Button>

          <Button onClick={submit} disabled={busy || rows.length === 0} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Enregistrer le rachat — {fmtSeptims(total)}
          </Button>
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Historique des rachats</h2>
      {purchases.length === 0 ? (
        <EmptyState message="Aucun rachat enregistré pour le moment." />
      ) : (
        <div className="space-y-2">
          {purchases.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{db.products.find((x) => x.id === p.productId)?.name}</span>
                {" × "}{fmtQty(p.quantity)} · par{" "}
                <span className="font-medium">{db.profiles.find((x) => x.id === p.memberId)?.name}</span>
                {p.sawmillId !== sawmillId && (
                  <span className="ml-1.5 text-xs font-medium text-primary">
                    · rachat partagé (les deux scieries)
                  </span>
                )}
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(p.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
              <span className="shrink-0 font-semibold text-primary">{fmtSeptims(p.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
