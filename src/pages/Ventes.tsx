import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, HandCoins, PackageX, Plus, Trash2, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Field, PageHeader, StatusBadge, nativeSelectClass } from "@/components/shared";
import { FactureButton, FactureDialogControlled } from "@/components/invoice/Facture";
import { ClientNameEdit } from "@/components/invoice/ClientNameEdit";
import { PERSONNEL_ROLES, VALIDATOR_ROLES } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import { fmtQty, fmtSeptims, memberWorksAt, useStore } from "@/lib/store";

interface Row {
  key: number;
  productId: string;
  quantity: string;
  amount: string;
  mode: "qty" | "amount";
  memberId: string;
  fromStock: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function Ventes() {
  const { db, createSale, resolveSale } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();
  const navigate = useNavigate();
  const location = useLocation();

  const [initRows] = useState<Row[]>(() => {
    const pre = (location.state as { calcSale?: { productId: string; quantity: number }[] | undefined })
      ?.calcSale;
    if (pre?.length) {
      return pre
        .filter((it) => it.quantity > 0)
        .map((it, idx) => ({
          key: idx,
          productId: it.productId,
          quantity: String(it.quantity),
          amount: "",
          mode: "qty" as const,
          memberId: user!.id,
          fromStock: true,
        }));
    }
    return [
      { key: 0, productId: db.products[0]?.id ?? "", quantity: "1", amount: "", mode: "qty" as const, memberId: user!.id, fromStock: true },
    ];
  });
  const [rows, setRows] = useState<Row[]>(initRows);
  const [nextKey, setNextKey] = useState(initRows.length);
  const [tab, setTab] = useState<"pending" | "new" | "history">(
    initRows.length > 1 || initRows[0]?.quantity !== "1"
      ? "new"
      : "pending"
  );
  const [note, setNote] = useState("");
  const [clientChoice, setClientChoice] = useState("");
  const [clientCustom, setClientCustom] = useState("");
  const [wantInvoice, setWantInvoice] = useState(false);
  const [proposed, setProposed] = useState<{ id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const canChooseOwner = VALIDATOR_ROLES.includes(user!.role);
  const canValidate = canChooseOwner;
  const isAdmin = user!.role === "admin";

  const products = [...db.products].filter((p) => p.sellable).sort((a, b) => a.sortOrder - b.sortOrder);
  const personnel = db.profiles.filter(
    (p) => PERSONNEL_ROLES.includes(p.role) && memberWorksAt(p.sawmillAccess, sawmillId)
  );
  const clientOptions = [
    ...db.clientEntries.map((e) => ({ id: `entry:${e.id}`, name: e.name, discount: e.discountPercent })),
    ...db.profiles
      .filter((p) => p.role === "client")
      .map((p) => ({ id: `account:${p.id}`, name: `${p.name} (compte)`, discount: p.discountPercent })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const isCustomClient = clientChoice === "__custom__";
  const selectedClient = clientOptions.find((c) => c.id === clientChoice) ?? null;
  const discount = selectedClient?.discount ?? 0;
  const clientLabel = isCustomClient ? clientCustom.trim() : selectedClient?.name ?? "";

  const sales = db.sales.filter((s) => s.sawmillId === sawmillId);
  const pending = sales
    .filter((s) => s.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const history = sales
    .filter((s) => s.status !== "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const factor = 1 - discount / 100;
  const lineValue = (r: Row) => {
    const p = db.products.find((x) => x.id === r.productId);
    const price = p?.salePrice ?? 0;
    const unit = price * factor;
    if (r.mode === "amount") {
      const amt = parseFloat(r.amount) || 0;
      const qty = unit > 0 && amt > 0 ? Math.max(1, Math.round(amt / unit)) : 0;
      return { qty, total: round2(amt), unit };
    }
    const qty = Math.max(0, parseInt(r.quantity, 10) || 0);
    return { qty, total: round2(qty * unit), unit };
  };
  const total = rows.reduce((sum, r) => sum + lineValue(r).total, 0);

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { key: nextKey, productId: products[0]?.id ?? "", quantity: "1", amount: "", mode: "qty", memberId: user!.id, fromStock: true },
    ]);
    setNextKey((k) => k + 1);
  };

  const removeRow = (key: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const submit = async () => {
    if (rows.length === 0 || busy) return;
    if (!clientLabel) {
      toast.error("Client obligatoire", {
        description: "Indiquez le nom du client (fiche, compte ou saisie libre) pour enregistrer la vente.",
      });
      return;
    }
    setBusy(true);
    try {
      const saleId = await createSale({
        lines: rows.map((r) => {
          const v = lineValue(r);
          return {
            memberId: r.memberId,
            productId: r.productId,
            quantity: Math.max(1, v.qty),
            fromStock: r.fromStock,
            total: v.total,
          };
        }),
        sawmillId,
        soldBy: user!.id,
        clientLabel,
        discountPercent: discount || undefined,
        note,
        invoiceRequested: wantInvoice,
      });
      setRows([{ key: nextKey, productId: products[0]?.id ?? "", quantity: "1", amount: "", mode: "qty", memberId: user!.id, fromStock: true }]);
      setNextKey((k) => k + 1);
      setNote("");
      setClientChoice("");
      setClientCustom("");
      setWantInvoice(false);
      if (wantInvoice && isAdmin) {
        toast.success("Vente enregistrée", { description: "La facture peut être éditée maintenant." });
        setProposed({ id: saleId });
        setTab("history");
      } else {
        if (wantInvoice) {
          toast.success("Demande de facture enregistrée", {
            description: "Le chef pourra l'émettre depuis l'historique des ventes.",
          });
        } else {
          toast.success("Vente enregistrée", { description: "Elle est appliquée ou en attente de validation selon votre rôle." });
        }
        navigate("/");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const runResolve = async (id: string, action: "validated" | "rejected") => {
    if (resolving) return; // anti double-clic
    setResolving(id);
    try {
      await resolveSale(id, action, user!.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setResolving(null);
    }
  };

  const ownerName = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? "?";
  const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? "?";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Ventes"
        subtitle="Une vente peut combiner plusieurs produits et piocher dans les stocks de plusieurs employés. Le nom du client est obligatoire (fiche, compte ou saisie libre) — vous pouvez demander une facture parchemin signée, éditée par le chef."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "new" | "history")}>
        <TabsList>
          <TabsTrigger value="pending">
            À valider {pending.length > 0 && `(${pending.length})`}
          </TabsTrigger>
          <TabsTrigger value="new">
            <Plus className="h-4 w-4" /> Nouvelle vente
          </TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 ? (
            <EmptyState message="Aucune vente en attente de validation." />
          ) : (
            pending.map((s) => (
              <Card key={s.id} className="card-glow">
                <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    {s.lines.map((l) => (
                      <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{productName(l.productId)}</span>
                        <span className="text-muted-foreground">× {fmtQty(l.quantity)}</span>
                        <Badge variant="outline" className="ring-1 ring-primary/40 text-primary">
                          stock de {ownerName(l.memberId)}
                        </Badge>
                        {!l.fromStock && (
                          <Badge variant="outline" className="ring-1 ring-amber-500/40 text-amber-400">
                            sur soi
                          </Badge>
                        )}
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground">
                      Vendue par {ownerName(s.soldBy)} · {new Date(s.createdAt).toLocaleString("fr-FR")}
                      {s.note && <span className="block italic">« {s.note} »</span>}
                    </div>
                    {s.clientLabel && (
                      <div className="text-xs text-amber-400">
                        Client : {s.clientLabel}
                        {s.discountPercent ? ` — réduction ${s.discountPercent} %` : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-semibold text-primary">{fmtSeptims(s.total)}</span>
                    {canValidate && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void runResolve(s.id, "validated")}
                          className="bg-emerald-600 hover:bg-emerald-500"
                          disabled={resolving !== null}
                        >
                          <Check className="h-4 w-4" /> Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolving !== null}
                          onClick={() => void runResolve(s.id, "rejected")}
                        >
                          <X className="h-4 w-4" /> Refuser
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="new">
          <Card className="card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <HandCoins className="h-4 w-4 text-primary" /> Nouvelle vente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {rows.map((r) => {
                  const v = lineValue(r);
                  return (
                    <div
                      key={r.key}
                      className="grid gap-2 rounded-md border border-border bg-secondary/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                    >
                      <Field label="Produit">
                        <select
                          className={nativeSelectClass}
                          value={r.productId}
                          onChange={(e) => updateRow(r.key, { productId: e.target.value })}
                        >
                          {products.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name} — {fmtSeptims(pr.salePrice)}/u
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={r.mode === "qty" ? "Quantité" : "Montant (septims)"}>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={r.mode === "qty" ? "default" : "outline"}
                            onClick={() => updateRow(r.key, { mode: "qty" })}
                          >
                            Quantité
                          </Button>
                          <Button
                            size="sm"
                            variant={r.mode === "amount" ? "default" : "outline"}
                            onClick={() => updateRow(r.key, { mode: "amount" })}
                          >
                            Montant
                          </Button>
                        </div>
                        {r.mode === "qty" ? (
                          <Input
                            type="number"
                            min={1}
                            value={r.quantity}
                            onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                          />
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={r.amount}
                            onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                          />
                        )}
                        <p className="text-xs text-muted-foreground">
                          {r.mode === "qty"
                            ? `≈ ${fmtSeptims(v.total)}${discount > 0 ? ` (réduction ${discount} % incluse)` : ""}`
                            : v.qty > 0
                              ? `≈ ${fmtQty(v.qty)} unité(s)`
                              : "Entrez le montant encaissé"}
                        </p>
                      </Field>
                      {canChooseOwner ? (
                        <Field label="Stock prélevé chez">
                          <select
                            className={nativeSelectClass}
                            value={r.memberId}
                            onChange={(e) => updateRow(r.key, { memberId: e.target.value })}
                          >
                            {personnel.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : (
                        <Field label="Stock prélevé chez">
                          <input className={nativeSelectClass} value={ownerName(user!.id)} readOnly disabled />
                        </Field>
                      )}
                      <div className="flex items-end gap-2">
                        <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-secondary px-3 text-xs font-medium">
                          {r.fromStock ? "Stock" : "Sur soi"}
                          <Switch
                            checked={r.fromStock}
                            onCheckedChange={(v) => updateRow(r.key, { fromStock: v })}
                          />
                        </label>
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
                      <div className="text-right text-sm text-muted-foreground sm:col-span-4 sm:text-left">
                        Sous-total ligne :{" "}
                        <span className="font-semibold text-foreground">{fmtSeptims(v.total)}</span>
                        {r.memberId !== user!.id && canChooseOwner && r.fromStock && (
                          <span className="ml-2 text-amber-400">→ dette due à {ownerName(r.memberId)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" /> Ajouter une ligne
              </Button>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client (obligatoire)">
                  <select
                    className={nativeSelectClass}
                    value={clientChoice}
                    onChange={(e) => setClientChoice(e.target.value)}
                  >
                    <option value="">— Choisir le client —</option>
                    {clientOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.discount > 0 ? ` (réduction ${c.discount} %)` : ""}
                      </option>
                    ))}
                    <option value="__custom__">— Autre client (saisie libre) —</option>
                  </select>
                  {isCustomClient && (
                    <Input
                      className="mt-2"
                      value={clientCustom}
                      onChange={(e) => setClientCustom(e.target.value)}
                      placeholder="Nom du client…"
                    />
                  )}
                </Field>
                <Field label="Note (optionnel)">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Circonstances…" />
                </Field>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 px-4 py-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={wantInvoice} onCheckedChange={setWantInvoice} />
                  Demander une facture
                  <span className="text-xs text-muted-foreground">
                    (le chef l'éditera en parchemin signé)
                  </span>
                </label>
                {wantInvoice && !clientLabel && (
                  <span className="text-xs font-medium text-amber-400">
                    Nom du client requis pour pouvoir facturer.
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  {discount > 0 ? (
                    <span className="text-emerald-400">
                      Réduction {discount} % ({selectedClient?.name}) incluse
                    </span>
                  ) : (
                    <span className="font-medium">Total de la vente</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl font-bold text-primary">{fmtSeptims(total)}</span>
                  <Button onClick={submit} disabled={busy || rows.length === 0 || !clientLabel}>
                    Enregistrer la vente (en attente)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {history.length === 0 ? (
            <EmptyState message="Aucune vente enregistrée pour le moment." />
          ) : (
            history.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  {s.lines.map((l) => (
                    <span key={l.id} className="mr-2 text-muted-foreground">
                      <span className="font-medium text-foreground">{productName(l.productId)}</span> ×{" "}
                      {fmtQty(l.quantity)} ({ownerName(l.memberId)}
                      {!l.fromStock ? ", sur soi" : ""})
                    </span>
                  ))}
                  {s.clientLabel && (
                    <span className="mr-2 text-xs text-amber-400">
                      Client : {s.clientLabel}
                      {s.discountPercent ? ` (−${s.discountPercent} %)` : ""}
                    </span>
                  )}
                  {s.validatedBy && (
                    <span className="block text-xs text-muted-foreground">
                      {s.status === "validated" ? "validé par" : "refusé par"} {ownerName(s.validatedBy)} le{" "}
                      {new Date(s.validatedAt!).toLocaleString("fr-FR")}
                    </span>
                  )}
                  {s.invoiceRequested && (
                    <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                      facture demandée
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.status === "rejected" && <PackageX className="h-4 w-4 text-destructive" />}
                  {isAdmin &&
                    s.status === "validated" &&
                    !s.orderId &&
                    (() => {
                      const inv = db.invoices.find((i) => i.kind === "sale" && i.sourceId === s.id);
                      return (
                        <span className="flex items-center gap-1">
                          <span className="text-xs text-emerald-400">{inv ? `N° ${inv.invoiceNo}` : "—"}</span>
                          <FactureButton kind="sale" id={s.id} issued={!!inv} />
                          <ClientNameEdit saleId={s.id} currentName={s.clientLabel} />
                        </span>
                      );
                    })()}
                  <span className="font-semibold">{fmtSeptims(s.total)}</span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {proposed && isAdmin && (
        <FactureDialogControlled
          kind="sale"
          id={proposed.id}
          open
          onOpenChange={(open) => {
            if (!open) setProposed(null);
          }}
        />
      )}
    </div>
  );
}
