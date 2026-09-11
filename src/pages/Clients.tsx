import { Fragment, useState } from "react";
import { toast } from "sonner";
import { BellRing, Check, ChevronDown, History, Pencil, StickyNote, Trash2, UserPlus, Users, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, Field, PageHeader } from "@/components/shared";
import { clientRelance, fmtQty, fmtSeptims, useStore } from "@/lib/store";

const ORDER_STATUS: Record<string, string> = {
  pending: "en attente",
  new: "à préparer",
  taken: "prise en charge",
  done: "terminée",
  cancelled: "annulée",
};

function ClientHistory({
  name,
  clientId,
  entryId,
}: {
  name: string;
  clientId?: string;
  entryId?: string;
}) {
  const { db } = useStore();
  const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? "?";
  const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR");

  // Une commande liée à une fiche appartient à la fois à l'historique de cette fiche
  // et à celui du compte qui l'a passée.
  const orders = db.orders
    .filter((o) =>
      clientId !== undefined
        ? o.clientId === clientId
        : entryId !== undefined && o.clientEntryId === entryId
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const orderIds = new Set(orders.map((order) => order.id));
  const sales = db.sales
    .filter(
      (s) =>
        s.status === "validated" &&
        (s.clientLabel === name || (s.orderId !== undefined && orderIds.has(s.orderId)))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const items: {
    id: string;
    type: string;
    detail: string;
    total: number;
    when: string;
    status: string;
    motif?: string;
  }[] = [
    ...sales.map((s) => ({
      id: `s-${s.id}`,
      type: "Vente",
      detail: s.lines.map((l) => `${productName(l.productId)} × ${fmtQty(l.quantity)}`).join(", "),
      total: s.total,
      when: s.createdAt,
      status: "validée",
    })),
    ...orders.map((o) => ({
      id: `o-${o.id}`,
      type: "Commande",
      detail: o.items.map((it) => `${productName(it.productId)} × ${fmtQty(it.quantity)}`).join(", "),
      total: o.total,
      when: o.createdAt,
      status: ORDER_STATUS[o.status] ?? o.status,
      motif: o.status === "cancelled" ? o.cancelledReason : undefined,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune commande ni vente pour ce client.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div
          key={it.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <span className="font-medium">{it.type}</span>
            <span className="text-muted-foreground"> · {it.detail}</span>
            {it.motif && (
              <span className="block text-xs text-destructive/80">Annulée — motif : {it.motif}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span>{dateTime(it.when)}</span>
            <span className="font-semibold text-primary">{fmtSeptims(it.total)}</span>
            <span>{it.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Clients() {
  const { db, addClientEntry, updateClientEntry, deleteClientEntry, updateProfile } = useStore();
  const [name, setName] = useState("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingNote, setEditingNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const entries = [...db.clientEntries].sort((a, b) => a.name.localeCompare(b.name));
  const accounts = db.profiles
    .filter((p) => p.role === "client")
    .sort((a, b) => a.name.localeCompare(b.name));
  const relance = clientRelance(db);

  const orderTotal = (clientId: string) =>
    db.orders.filter((o) => o.clientId === clientId).reduce((s, o) => s + o.total, 0);

  const create = () => {
    if (!name.trim()) return;
    addClientEntry(name, Math.max(0, Math.min(100, parseInt(discount, 10) || 0)), note.trim() || undefined);
    setName("");
    setDiscount("0");
    setNote("");
  };

  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const startEdit = (id: string, currentName: string, currentNote?: string) => {
    setEditingId(id);
    setEditingName(currentName);
    setEditingNote(currentNote ?? "");
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await updateClientEntry(editingId, { name: editingName, note: editingNote });
      toast.success("Fiche client mise à jour");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSavingEdit(false);
    }
  };

  const approveFiche = async (profileId: string) => {
    const prof = db.profiles.find((p) => p.id === profileId);
    if (!prof?.pendingEntryId) return;
    await updateProfile(profileId, { clientEntryId: prof.pendingEntryId, pendingEntryId: null });
  };

  const refuseFiche = async (profileId: string) => {
    await updateProfile(profileId, { pendingEntryId: null });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Fiches clients manuelles (ajoutées par le chef, avec réduction) et comptes clients (avec mot de passe, pour passer commande)."
      />

      {relance.length > 0 && (
        <Card className="card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <BellRing className="h-4 w-4 text-amber-400" /> Clients à relancer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {relance.map((r) => {
              const band = r.weeks >= 3 ? "3 semaines et +" : r.weeks === 2 ? "2 semaines" : "1 semaine";
              const color = r.weeks >= 3 ? "text-destructive" : r.weeks === 2 ? "text-amber-400" : "text-foreground";
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.lastActive ? "dernière activité" : "fiche créée"} : {new Date(r.referenceDate).toLocaleDateString("fr-FR")}
                  </span>
                  <span className={`text-xs font-semibold ${color}`}>{band}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <UserPlus className="h-4 w-4 text-primary" /> Ajouter un client manuellement
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <Field label="Nom du client" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Thane Cornebois" />
          </Field>
          <Field label="Réduction (%)">
            <Input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button onClick={create} disabled={!name.trim()} className="w-full">
              Ajouter
            </Button>
          </div>
          <Field label="Note (optionnel)" className="sm:col-span-4">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Client du camp nord, habitué…" />
          </Field>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <StickyNote className="h-4 w-4 text-primary" /> Fiches clients
          </CardTitle>
        </CardHeader>
        {entries.length === 0 ? (
          <CardContent>
            <EmptyState message="Aucune fiche client. Ajoutez vos clients manuellement ci-dessus." />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="table-head">
                  <TableHead>Client</TableHead>
                  <TableHead className="w-32">Réduction (%)</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-28">Historique</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((c) => {
                  const key = `e:${c.id}`;
                  return (
                    <Fragment key={c.id}>
                      <TableRow>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="h-8 w-20 text-right"
                            value={c.discountPercent}
                            onChange={(e) =>
                              updateClientEntry(c.id, {
                                discountPercent: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.note ?? "—"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => toggle(key)}>
                            {open[key] ? <ChevronDown className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                            {open[key] ? "Masquer" : "Voir"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground hover:text-primary"
                              onClick={() => startEdit(c.id, c.name, c.note)}
                              title="Modifier la fiche"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => deleteClientEntry(c.id)}
                              title="Supprimer la fiche"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {open[key] && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-secondary/20">
                            <ClientHistory name={c.name} entryId={c.id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Users className="h-4 w-4 text-primary" /> Comptes clients (avec connexion)
          </CardTitle>
        </CardHeader>
        {accounts.length === 0 ? (
          <CardContent>
            <EmptyState message="Aucun compte client. Créez-en un dans la page Membres (rôle « Client ») si un client veut se connecter pour commander." />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="table-head">
                  <TableHead>Compte</TableHead>
                  <TableHead className="w-44">Fiche client</TableHead>
                  <TableHead className="w-32">Réduction (%)</TableHead>
                  <TableHead className="text-right">Montant commandé</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="w-28">Historique</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((c) => {
                  const key = `a:${c.id}`;
                  const linked = c.clientEntryId ? db.clientEntries.find((e) => e.id === c.clientEntryId) : null;
                  const pending = c.pendingEntryId ? db.clientEntries.find((e) => e.id === c.pendingEntryId) : null;
                  return (
                    <Fragment key={c.id}>
                      <TableRow>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          {linked ? (
                            <span className="text-sm font-medium text-emerald-400">
                              {linked.name} · {linked.discountPercent} %
                            </span>
                          ) : pending ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-xs text-amber-400">demande : {pending.name}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-emerald-500 hover:text-emerald-400"
                                onClick={() => void approveFiche(c.id)}
                                title="Valider la fiche"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => void refuseFiche(c.id)}
                                title="Refuser la fiche"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="h-8 w-20 text-right"
                            value={c.discountPercent}
                            onChange={(e) =>
                              updateProfile(c.id, {
                                discountPercent: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {fmtSeptims(orderTotal(c.id))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {db.orders.filter((o) => o.clientId === c.id).length}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => toggle(key)}>
                            {open[key] ? <ChevronDown className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                            {open[key] ? "Masquer" : "Voir"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open[key] && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-secondary/20">
                            <ClientHistory name={c.name} clientId={c.id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={editingId !== null} onOpenChange={(isOpen) => !isOpen && !savingEdit && setEditingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Modifier la fiche client</DialogTitle>
            <DialogDescription>
              Corrigez le nom du client ou complétez sa note. La réduction reste modifiable directement dans le tableau.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Nom du client">
              <Input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                placeholder="Nom du client"
                autoFocus
              />
            </Field>
            <Field label="Note (optionnel)">
              <Input
                value={editingNote}
                onChange={(event) => setEditingNote(event.target.value)}
                placeholder="Client du camp nord, habitué…"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingId(null)} disabled={savingEdit}>
              Annuler
            </Button>
            <Button onClick={() => void saveEdit()} disabled={savingEdit || !editingName.trim()}>
              <Pencil className="h-4 w-4" /> Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        Les fiches clients manuelles apparaissent aussi dans le formulaire de vente et peuvent être
        choisies par un client connecté lors de sa commande pour appliquer sa réduction. L'historique
        regroupe les ventes (avec réduction) et les commandes du client.
      </p>
    </div>
  );
}
