import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Plus, Trash2, Trees, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Field, PageHeader, StatusBadge, nativeSelectClass } from "@/components/shared";
import { VALIDATOR_ROLES, PERSONNEL_ROLES } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import { memberWorksAt, useStore, fmtQty } from "@/lib/store";

interface Row {
  key: number;
  productId: string;
  quantity: string;
}

const BARREL_OPTIONS = [
  { value: "tonneau_gauche", label: "Tonneau de gauche" },
  { value: "tonneau_droit", label: "Tonneau de droite" },
];

export default function Depots() {
  const { db, createStockRequest, resolveStockRequest } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();
  const navigate = useNavigate();

  const [type, setType] = useState<"depot" | "retrait">("depot");
  const [memberId, setMemberId] = useState(user!.id);
  const [rows, setRows] = useState<Row[]>([
    { key: 0, productId: db.products[0]?.id ?? "", quantity: "1" },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [note, setNote] = useState("");
  const [deliveredTo, setDeliveredTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const canValidate = VALIDATOR_ROLES.includes(user!.role);
  const canChooseMember = canValidate;
  const personnel = db.profiles.filter(
    (p) => PERSONNEL_ROLES.includes(p.role) && memberWorksAt(p.sawmillAccess, sawmillId)
  );
  const validators = db.profiles.filter(
    (p) => VALIDATOR_ROLES.includes(p.role) && memberWorksAt(p.sawmillAccess, sawmillId)
  );

  const requests = db.stockRequests.filter((r) => r.sawmillId === sawmillId);
  const pending = requests
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const history = requests
    .filter((r) => r.status !== "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { key: nextKey, productId: db.products[0]?.id ?? "", quantity: "1" }]);
    setNextKey((k) => k + 1);
  };

  const removeRow = (key: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  };

  const submit = async () => {
    if (type === "depot" && !deliveredTo) {
      toast.error("Choisissez où la marchandise est remise ou laissée (gestionnaire/chef ou tonneau).");
      return;
    }
    const lines = rows
      .map((r) => ({ productId: r.productId, quantity: Math.max(1, parseInt(r.quantity, 10) || 1) }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0 || busy) return;
    setBusy(true);
    try {
      await createStockRequest(user!.id, memberId, sawmillId, lines, type, note, type === "depot" ? deliveredTo : undefined);
      toast.success(type === "depot" ? "Dépôt enregistré" : "Retrait enregistré", {
        description: "La demande est appliquée ou en attente de validation selon votre rôle.",
      });
      navigate("/");
      setRows([{ key: nextKey, productId: db.products[0]?.id ?? "", quantity: "1" }]);
      setNextKey((k) => k + 1);
      setNote("");
      setDeliveredTo("");
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
      await resolveStockRequest(id, action, user!.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setResolving(null);
    }
  };

  const memberName = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? "?";
  const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? "?";
  const deliveredLabel = (v?: string) => {
    if (!v) return "";
    const barrel = BARREL_OPTIONS.find((b) => b.value === v);
    return barrel ? barrel.label : memberName(v);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dépôts & retraits"
        subtitle="Demandes de modification de stock : dépôt (ajout) ou retrait (prélèvement), avec plusieurs produits par demande. Appliquées uniquement après validation par un gestionnaire."
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            À valider {pending.length > 0 && `(${pending.length})`}
          </TabsTrigger>
          <TabsTrigger value="new">
            <Plus className="h-4 w-4" /> Nouvelle demande
          </TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 ? (
            <EmptyState message="Aucune demande de dépôt ou retrait en attente." />
          ) : (
            pending.map((r) => (
              <Card key={r.id} className="card-glow">
                <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={r.type === "depot" ? "text-emerald-400 ring-emerald-500/40" : "text-amber-400 ring-amber-500/40"}>
                        <Trees className="mr-1 h-3 w-3" />
                        {r.type === "depot" ? "Dépôt" : "Retrait"}
                      </Badge>
                      {r.lines.map((l) => (
                        <span key={l.id} className="text-sm">
                          <span className="font-semibold">{productName(l.productId)}</span>{" "}
                          <span className="text-muted-foreground">× {fmtQty(l.quantity)}</span>
                        </span>
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{memberName(r.memberId)}</span>
                      {r.type === "depot" && r.deliveredTo && (
                        <span className="text-xs text-amber-400/90">
                          {" "}
                          · remis/laissé : {deliveredLabel(r.deliveredTo)}
                        </span>
                      )}
                      {r.note && <span className="block text-xs italic">« {r.note} »</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString("fr-FR")}</div>
                  </div>
                  {canValidate && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500"
                        disabled={resolving !== null}
                        onClick={() => void runResolve(r.id, "validated")}
                      >
                        <Check className="h-4 w-4" /> Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolving !== null}
                        onClick={() => void runResolve(r.id, "rejected")}
                      >
                        <X className="h-4 w-4" /> Refuser
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="new">
          <Card className="card-glow">
            <CardHeader>
              <CardTitle className="font-display text-lg">Nouvelle demande ({user!.name})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Type">
                  <select className={nativeSelectClass} value={type} onChange={(e) => setType(e.target.value as "depot" | "retrait")}>
                    <option value="depot">Dépôt (ajouter du stock)</option>
                    <option value="retrait">Retrait (retirer du stock)</option>
                  </select>
                </Field>
                <Field label={type === "depot" ? "Déposer dans le stock de" : "Retirer du stock de"}>
                  {canChooseMember ? (
                    <select className={nativeSelectClass} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                      {personnel.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className={nativeSelectClass} value={memberName(user!.id)} readOnly disabled />
                  )}
                </Field>
                <Field label="Note (optionnel)">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Raison, provenance…" />
                </Field>
              </div>

              {type === "depot" && (
                <Field label="Remis à / laissé dans *">
                  <select
                    className={nativeSelectClass}
                    value={deliveredTo}
                    onChange={(e) => setDeliveredTo(e.target.value)}
                  >
                    <option value="">— Choisir —</option>
                    {validators.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                    {BARREL_OPTIONS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">
                    À qui avez-vous remis la marchandise, ou dans quel tonneau l'avez-vous laissée ? Le gestionnaire
                    la retrouve là où vous l'avez indiqué.
                  </span>
                </Field>
              )}

              <div className="space-y-3">
                {rows.map((r) => (
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
                        {db.products
                          .slice()
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
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
                    <div className="flex items-end">
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
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" /> Ajouter un produit
              </Button>

               <Button onClick={submit} disabled={busy || rows.length === 0}>
                 <Plus className="h-4 w-4" /> Envoyer la demande
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {history.length === 0 ? (
            <EmptyState message="Aucune demande traitée pour le moment." />
          ) : (
            history.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{r.type === "depot" ? "Dépôt" : "Retrait"}</span>
                  {" · "}
                  {r.lines.map((l) => (
                    <span key={l.id} className="mr-2 text-muted-foreground">
                      <span className="font-medium text-foreground">{productName(l.productId)}</span> × {fmtQty(l.quantity)}
                    </span>
                  ))}
                  <span className="text-muted-foreground">· {memberName(r.memberId)}</span>
                  {r.type === "depot" && r.deliveredTo && (
                    <span className="text-xs text-amber-400/90"> · remis/laissé : {deliveredLabel(r.deliveredTo)}</span>
                  )}
                  {r.validatedBy && (
                    <span className="ml-2 block text-xs text-muted-foreground">
                      {r.status === "validated" ? "validé par" : "refusé par"} {memberName(r.validatedBy)}{" "}
                      le {new Date(r.validatedAt!).toLocaleString("fr-FR")}
                    </span>
                  )}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
