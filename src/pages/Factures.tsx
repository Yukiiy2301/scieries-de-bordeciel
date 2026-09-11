import { FileText, HandCoins, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared";
import { FactureButton } from "@/components/invoice/Facture";
import { useSawmill } from "@/hooks/use-sawmill";
import { fmtQty, fmtSeptims, useStore } from "@/lib/store";

export default function Factures() {
  const { db } = useStore();
  const { sawmillId } = useSawmill();

  const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? "?";
  const profileName = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? "?";

  // Ventes validées dont une facture a été demandée et pas encore émise
  const sales = db.sales
    .filter(
      (s) =>
        s.sawmillId === sawmillId &&
        s.status === "validated" &&
        s.invoiceRequested &&
        !s.orderId &&
        !db.invoices.some((i) => i.kind === "sale" && i.sourceId === s.id)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Commandes prises en charge / terminées dont une facture a été demandée et pas encore émise
  const orders = db.orders
    .filter(
      (o) =>
        o.sawmillId === sawmillId &&
        (o.status === "taken" || o.status === "done") &&
        o.invoiceRequested &&
        !db.invoices.some((i) => i.kind === "order" && i.sourceId === o.id)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = sales.length + orders.length;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Factures à signer"
        subtitle="Ventes et commandes pour lesquelles une facture parchemin a été demandée. Éditez et signez chaque facture (D'jack Borgne, propriétaire de la scierie)."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="card-glow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-sm">
              <HandCoins className="h-4 w-4 text-primary" /> Ventes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente à facturer.</p>
            ) : (
              <div className="space-y-2">
                {sales.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {s.clientLabel} · {fmtSeptims(s.total)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.lines.map((l) => `${productName(l.productId)} × ${fmtQty(l.quantity)}`).join(", ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString("fr-FR")} · vendue par {profileName(s.soldBy)}
                      </div>
                    </div>
                    <FactureButton kind="sale" id={s.id} className="shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-sm">
              <ShoppingCart className="h-4 w-4 text-primary" /> Commandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune commande à facturer.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {profileName(o.clientId)} · {fmtSeptims(o.total)}
                        {o.discountPercent > 0 ? ` (−${o.discountPercent} %)` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.items.map((it) => `${productName(it.productId)} × ${fmtQty(it.quantity)}`).join(", ")}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("fr-FR")}</div>
                    </div>
                    <FactureButton kind="order" id={o.id} className="shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {total === 0 && <EmptyState message="Aucune facture en attente de signature. Les demandes apparaîtront ici." />}
    </div>
  );
}
