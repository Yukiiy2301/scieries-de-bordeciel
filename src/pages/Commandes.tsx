import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, ClipboardList, Clock, MapPin, PackageCheck, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FactureButton } from "@/components/invoice/Facture";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, Field, PageHeader, nativeSelectClass } from "@/components/shared";
import FulfilOrder from "@/components/orders/FulfilOrder";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import { useStore, fmtQty, fmtSeptims } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

const ORDER_LABELS: Record<Order["status"], string> = {
  pending: "En attente de validation",
  new: "À préparer",
  taken: "Prise en charge",
  done: "Terminée",
  cancelled: "Annulée",
};

const ORDER_BADGE: Record<Order["status"], string> = {
  pending: "bg-amber-500/15 text-amber-400 ring-amber-500/40",
  new: "text-primary ring-primary/40",
  taken: "text-sky-400 ring-sky-500/40",
  done: "text-muted-foreground ring-border",
  cancelled: "text-destructive ring-destructive/40",
};

export default function Commandes() {
  const { db, createOrder, updateOrderStatus, deleteOrder, updateProfile, cancelOrder } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();
  const navigate = useNavigate();
  const location = useLocation();

  const isClient = user!.role === "client";
  const canOrder = isClient;
  const isAdmin = user!.role === "admin";
  const canManage = isAdmin || user!.role === "gestionnaire";

  const products = [...db.products].sort((a, b) => a.sortOrder - b.sortOrder);
  const [qtys, setQtys] = useState<Record<string, string>>(() => {
    const pre = (location.state as { calcOrder?: { productId: string; quantity: number }[] | undefined })
      ?.calcOrder;
    const q: Record<string, string> = {};
    if (pre) {
      for (const it of pre) {
        if (products.some((p) => p.id === it.productId) && it.quantity > 0) {
          q[it.productId] = String(it.quantity);
        }
      }
    }
    return q;
  });
  const [pickupTime, setPickupTime] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [requestEntryId, setRequestEntryId] = useState("");
  const [wantInvoice, setWantInvoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  // Verrou anti double-clic : une seule action par commande à la fois
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runCancel = async (id: string) => {
    if (busyAction) return;
    setBusyAction(id);
    try {
      await cancelOrder(id, cancelReason, user!.id);
      toast.success("Commande annulée", {
        description: "Stocks restitués, vente supprimée et motif enregistré sur la fiche client.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusyAction(null);
      setCancellingId(null);
      setCancelReason("");
    }
  };

  const runStatus = async (id: string, status: Order["status"]) => {
    if (busyAction) return;
    setBusyAction(id);
    try {
      await updateOrderStatus(id, status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusyAction(null);
    }
  };

  const runDelete = async (id: string) => {
    if (busyAction) return;
    setBusyAction(id);
    try {
      await deleteOrder(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusyAction(null);
    }
  };

  const openCancel = (id: string) => {
    setCancelReason("");
    setCancellingId(id);
  };

  const cancelTarget = cancellingId ? db.orders.find((o) => o.id === cancellingId) ?? null : null;

  const clientEntries = [...db.clientEntries].sort((a, b) => a.name.localeCompare(b.name));
  const me = db.profiles.find((p) => p.id === user!.id);
  const linkedEntry = me?.clientEntryId ? db.clientEntries.find((e) => e.id === me.clientEntryId) : null;
  const pendingEntry = me?.pendingEntryId ? db.clientEntries.find((e) => e.id === me.pendingEntryId) : null;
  const discount = isClient ? (linkedEntry?.discountPercent ?? me?.discountPercent ?? 0) : 0;

  const requestFiche = async () => {
    if (!requestEntryId || !user) return;
    await updateProfile(user.id, { pendingEntryId: requestEntryId });
    toast.success("Demande de fiche envoyée", { description: "Le chef doit la valider." });
    setRequestEntryId("");
  };

  const subtotal = products.reduce((sum, p) => {
    const q = parseInt(qtys[p.id] || "0", 10) || 0;
    return sum + p.salePrice * q;
  }, 0);
  const total = Math.round(subtotal * (1 - discount / 100) * 100) / 100;

  const hasItems = products.some((p) => (parseInt(qtys[p.id] || "0", 10) || 0) > 0);

  const submit = async () => {
    if (!hasItems || busy) return;
    setBusy(true);
    try {
      const orderId = await createOrder({
        sawmillId,
        clientId: user!.id,
        clientEntryId: isClient ? linkedEntry?.id || undefined : undefined,
        items: products
          .filter((p) => (parseInt(qtys[p.id] || "0", 10) || 0) > 0)
          .map((p) => ({ productId: p.id, quantity: parseInt(qtys[p.id] || "0", 10) || 0 })),
        discountPercent: discount,
        total,
        pickupTime,
        deliveryNote,
        invoiceRequested: wantInvoice,
      });
      void orderId;
      toast.success(
        wantInvoice ? "Commande envoyée — facture demandée" : "Commande envoyée",
        {
          description: wantInvoice
            ? "Le chef pourra éditer votre facture parchemin une fois la commande préparée."
            : "Le gestionnaire va la préparer.",
        }
      );
      if (!canOrder) navigate("/");
      setQtys({});
      setPickupTime("");
      setDeliveryNote("");
      setRequestEntryId("");
      setWantInvoice(false);
    } finally {
      setBusy(false);
    }
  };

  const myOrders = canOrder
    ? db.orders.filter((o) => o.clientId === user!.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : db.orders.filter((o) => o.sawmillId === sawmillId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={canOrder ? "Passer une commande" : "Commandes"}
        subtitle={
          canOrder
            ? "Indiquez ce que vous souhaitez : votre fiche client validée applique automatiquement la réduction."
            : "À la prise en charge, répartissez chaque produit entre les membres qui fournissent le stock (dette auto) ; suivez ensuite jusqu'à « terminée »."
        }
      />

      {canOrder && (
        <Card className="card-glow mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <ClipboardList className="h-4 w-4 text-primary" /> Ma commande
              {discount > 0 && (
                <Badge className="ml-2 bg-primary/15 text-primary ring-1 ring-primary/40">
                  Réduction {discount} %
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtSeptims(p.salePrice)} / unité</div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 w-20 text-right"
                    value={qtys[p.id] || ""}
                    onChange={(e) => setQtys((q) => ({ ...q, [p.id]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            {isClient && !linkedEntry && (
              <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
                {pendingEntry ? (
                  <p className="text-muted-foreground">
                    Demande de fiche envoyée pour{" "}
                    <span className="font-medium text-foreground">{pendingEntry.name}</span> — en attente
                    de validation par le chef.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Demander une fiche client
                      </p>
                      <select
                        className={nativeSelectClass}
                        value={requestEntryId}
                        onChange={(e) => setRequestEntryId(e.target.value)}
                      >
                        <option value="">— Choisir une fiche —</option>
                        {clientEntries.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button size="sm" onClick={requestFiche} disabled={!requestEntryId}>
                      Demander la fiche
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Heure de retrait">
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    placeholder="Ex : 20h, après le souper…"
                  />
                </div>
              </Field>
              <Field label="Lieu / note de livraison">
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="Ex : livraison au village, taverne…"
                  />
                </div>
              </Field>
            </div>

            {canOrder && (
              <label className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-4 py-3 text-sm">
                <Switch checked={wantInvoice} onCheckedChange={setWantInvoice} />
                Demander une facture
                <span className="text-xs text-muted-foreground">
                  (le chef éditera une facture parchemin signée une fois la commande préparée)
                </span>
              </label>
            )}

            <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Sous-total : {fmtSeptims(subtotal)}
                {discount > 0 && (
                  <span className="ml-2 text-emerald-400">
                    − {discount} % {linkedEntry ? `(fiche ${linkedEntry.name})` : "(compte enregistré)"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-xl font-bold text-primary">{fmtSeptims(total)}</span>
                <Button onClick={submit} disabled={busy || !hasItems}>
                  Envoyer la commande
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <h2 className="mb-3 font-display text-lg font-semibold">
        {canOrder ? "Mes commandes" : "Commandes reçues"}
      </h2>
      {myOrders.length === 0 ? (
        <EmptyState message={canOrder ? "Vous n'avez pas encore passé de commande." : "Aucune commande reçue."} />
      ) : (
        <div className="space-y-3">
          {myOrders.map((o) => (
            <Card key={o.id} className="card-glow">
              <CardContent className="flex flex-col gap-3 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!canOrder && (
                        <span className="font-medium">{db.profiles.find((p) => p.id === o.clientId)?.name}</span>
                      )}
                      <Badge variant="outline" className={cn("ring-1", ORDER_BADGE[o.status])}>
                        {ORDER_LABELS[o.status]}
                      </Badge>
                      {!canOrder && o.invoiceRequested && (
                        <Badge className="bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/40">
                          facture demandée
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm">
                      {o.items.map((it) => {
                        const p = db.products.find((x) => x.id === it.productId);
                        return (
                          <span key={it.productId} className="mr-2 text-muted-foreground">
                            <span className="font-medium text-foreground">{p?.name}</span> × {fmtQty(it.quantity)}
                          </span>
                        );
                      })}
                    </div>
                    {(o.pickupTime || o.deliveryNote) && (
                      <div className="text-xs text-muted-foreground">
                        {o.pickupTime && <span className="mr-3">Retrait : {o.pickupTime}</span>}
                        {o.deliveryNote && <span>Livraison : {o.deliveryNote}</span>}
                      </div>
                    )}
                    {o.status === "cancelled" && o.cancelledReason && (
                      <div className="text-xs font-medium text-destructive/90">
                        Motif : {o.cancelledReason}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("fr-FR")}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold text-primary">{fmtSeptims(o.total)}</span>
                    {canManage && o.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500"
                          disabled={busyAction !== null}
                          onClick={() => void runStatus(o.id, "new")}
                        >
                          <Check className="h-4 w-4" /> Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyAction !== null}
                          onClick={() => void runDelete(o.id)}
                        >
                          <X className="h-4 w-4" /> Refuser
                        </Button>
                      </>
                    )}
                    {canManage && o.status === "new" && (
                      <Button
                        size="sm"
                        variant={expandedOrderId === o.id ? "default" : "outline"}
                        onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}
                      >
                        {expandedOrderId === o.id ? (
                          <>
                            <X className="h-4 w-4" /> Fermer
                          </>
                        ) : (
                          <>
                            <PackageCheck className="h-4 w-4" /> Prendre en charge
                          </>
                        )}
                      </Button>
                    )}
                    {canManage && o.status === "taken" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyAction !== null}
                          onClick={() => void runStatus(o.id, "done")}
                        >
                          <Check className="h-4 w-4" /> Marquer terminée
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={busyAction !== null}
                          onClick={() => openCancel(o.id)}
                        >
                          <X className="h-4 w-4" /> Commande annulée
                        </Button>
                      </>
                    )}
                    {isAdmin &&
                      (o.status === "taken" || o.status === "done") &&
                      (() => {
                        const inv = db.invoices.find((i) => i.kind === "order" && i.sourceId === o.id);
                        return (
                          <span className="flex items-center gap-1.5">
                            {inv && (
                              <span className="text-[10px] font-medium text-emerald-400">N° {inv.invoiceNo}</span>
                            )}
                            <FactureButton kind="order" id={o.id} issued={!!inv} />
                          </span>
                        );
                      })()}
                  </div>
                </div>
                {expandedOrderId === o.id && canManage && o.status === "new" && (
                  <FulfilOrder order={o} onDone={() => setExpandedOrderId(null)} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={cancellingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingId(null);
            setCancelReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  Commande de{" "}
                  <span className="font-medium text-foreground">
                    {db.profiles.find((p) => p.id === cancelTarget.clientId)?.name}
                  </span>{" "}
                  · {fmtSeptims(cancelTarget.total)}
                  {cancelTarget.discountPercent > 0 && <span> (−{cancelTarget.discountPercent} %)</span>}.
                  <br />
                </>
              )}
              Les stocks débités seront <span className="text-foreground">restitués</span> aux membres, la
              vente associée sera supprimée et le motif restera enregistré sur la fiche du client. Cette
              action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field label="Motif de l'annulation (obligatoire)">
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex : client absent, annulé à sa demande…"
              autoFocus
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction !== null}>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!cancelReason.trim() || busyAction !== null}
              onClick={(e) => {
                e.preventDefault();
                if (cancellingId) void runCancel(cancellingId);
              }}
            >
              {busyAction === cancellingId ? "Annulation…" : "Confirmer l'annulation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
