import { useState } from "react";
import { Eye, UserRoundSearch } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge, nativeSelectClass } from "@/components/shared";
import { FactureButton } from "@/components/invoice/Facture";
import { ClientNameEdit } from "@/components/invoice/ClientNameEdit";
import { useSawmill } from "@/hooks/use-sawmill";
import { useAuth } from "@/hooks/use-auth";
import { fmtQty, fmtSeptims, memberWorksAt, useStore } from "@/lib/store";
import { PERSONNEL_ROLES } from "@/lib/constants";

export default function Historique() {
  const { db } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();
  const isAdmin = user?.role === "admin";
  const [memberFilter, setMemberFilter] = useState("all");

  const personnel = db.profiles
    .filter((profile) => PERSONNEL_ROLES.includes(profile.role) && memberWorksAt(profile.sawmillAccess, sawmillId))
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedMemberId = personnel.some((profile) => profile.id === memberFilter) ? memberFilter : "all";

  const name = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? "?";
  const productName = (id: string) => db.products.find((p) => p.id === id)?.name ?? "?";
  const deliveredLabel = (v?: string) =>
    v === "tonneau_gauche" ? "Tonneau de gauche" : v === "tonneau_droit" ? "Tonneau de droite" : v ? name(v) : "";

  const purchases = db.purchases
    .filter((p) => {
      const owner = db.profiles.find((x) => x.id === p.memberId);
      const belongsToSawmill = p.sawmillId === sawmillId || owner?.sawmillAccess === "both";
      return belongsToSawmill && (selectedMemberId === "all" || p.memberId === selectedMemberId);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sales = db.sales
    .filter(
      (s) =>
        s.sawmillId === sawmillId &&
        (selectedMemberId === "all" || s.lines.some((line) => line.memberId === selectedMemberId))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const depots = db.stockRequests
    .filter(
      (r) =>
        r.sawmillId === sawmillId &&
        r.type === "depot" &&
        (selectedMemberId === "all" || r.memberId === selectedMemberId)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const retraits = db.stockRequests
    .filter(
      (r) =>
        r.sawmillId === sawmillId &&
        r.type === "retrait" &&
        (selectedMemberId === "all" || r.memberId === selectedMemberId)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const countBadge = (n: number) => (n > 0 ? ` (${n})` : "");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Historique"
        subtitle="Consultation seule : rachats, ventes, dépôts et retraits enregistrés dans cette scierie."
      />

      <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <UserRoundSearch className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Personne concernée</p>
            <p className="text-xs text-muted-foreground">Filtre les opérations effectuées pour son stock ou ses rachats.</p>
          </div>
        </div>
        <select
          className={`${nativeSelectClass} sm:w-64`}
          value={selectedMemberId}
          onChange={(event) => setMemberFilter(event.target.value)}
          aria-label="Filtrer l'historique par personne concernée"
        >
          <option value="all">Toutes les personnes</option>
          {personnel.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </div>

      <Tabs defaultValue="rachats">
        <TabsList>
          <TabsTrigger value="rachats">Rachats{countBadge(purchases.length)}</TabsTrigger>
          <TabsTrigger value="ventes">Ventes{countBadge(sales.length)}</TabsTrigger>
          <TabsTrigger value="depots">Dépôts{countBadge(depots.length)}</TabsTrigger>
          <TabsTrigger value="retraits">Retraits{countBadge(retraits.length)}</TabsTrigger>
        </TabsList>

        <TabsContent value="rachats">
          {purchases.length === 0 ? (
            <EmptyState message="Aucun rachat enregistré." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card card-glow">
              <Table>
                <TableHeader>
                  <TableRow className="table-head">
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Par</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{new Date(p.createdAt).toLocaleString("fr-FR")}</TableCell>
                      <TableCell className="font-medium">
                        {productName(p.productId)}
                        {p.sawmillId !== sawmillId && (
                          <span className="ml-1 text-[10px] font-medium text-primary">· partagé (les deux scieries)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtQty(p.quantity)}</TableCell>
                      <TableCell>{name(p.memberId)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{fmtSeptims(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ventes">
          {sales.length === 0 ? (
            <EmptyState message="Aucune vente enregistrée." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card card-glow">
              <Table>
                <TableHeader>
                  <TableRow className="table-head">
                    <TableHead>Date</TableHead>
                    <TableHead>Détail</TableHead>
                    <TableHead>Vendue par</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-32">Facture</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{new Date(s.createdAt).toLocaleString("fr-FR")}</TableCell>
                      <TableCell>
                        {s.lines.map((l) => (
                          <div key={l.id} className="text-sm">
                            <span className="font-medium">{productName(l.productId)}</span> × {fmtQty(l.quantity)}
                            <span className="text-muted-foreground">
                              {" "}({name(l.memberId)}
                              {!l.fromStock ? ", sur soi" : ""})
                            </span>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>{name(s.soldBy)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{fmtSeptims(s.total)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={s.status} />
                          {s.validatedBy && (
                            <span className="text-xs text-muted-foreground">par {name(s.validatedBy)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isAdmin && s.status === "validated" && !s.orderId ? (
                          (() => {
                            const inv = db.invoices.find((i) => i.kind === "sale" && i.sourceId === s.id);
                            return (
                              <span className="flex items-center gap-1.5">
                                {inv && (
                                  <span className="text-[10px] font-medium text-emerald-400">N° {inv.invoiceNo}</span>
                                )}
                                <FactureButton kind="sale" id={s.id} issued={!!inv} />
                                <ClientNameEdit saleId={s.id} currentName={s.clientLabel} />
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="depots">
          {depots.length === 0 ? (
            <EmptyState message="Aucun dépôt enregistré." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card card-glow">
              <Table>
                <TableHeader>
                  <TableRow className="table-head">
                    <TableHead>Date</TableHead>
                    <TableHead>Détail</TableHead>
                    <TableHead>Par</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depots.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{new Date(r.createdAt).toLocaleString("fr-FR")}</TableCell>
                      <TableCell>
                        {r.lines.map((l) => (
                          <div key={l.id} className="text-sm">
                            <span className="font-medium">{productName(l.productId)}</span> × {fmtQty(l.quantity)}
                          </div>
                        ))}
                        {r.deliveredTo && (
                          <div className="text-xs text-amber-400/90">remis/laissé : {deliveredLabel(r.deliveredTo)}</div>
                        )}
                      </TableCell>
                      <TableCell>{name(r.memberId)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={r.status} />
                          {r.validatedBy && (
                            <span className="text-xs text-muted-foreground">par {name(r.validatedBy)}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="retraits">
          {retraits.length === 0 ? (
            <EmptyState message="Aucun retrait enregistré." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card card-glow">
              <Table>
                <TableHeader>
                  <TableRow className="table-head">
                    <TableHead>Date</TableHead>
                    <TableHead>Détail</TableHead>
                    <TableHead>Par</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retraits.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{new Date(r.createdAt).toLocaleString("fr-FR")}</TableCell>
                      <TableCell>
                        {r.lines.map((l) => (
                          <div key={l.id} className="text-sm">
                            <span className="font-medium">{productName(l.productId)}</span> × {fmtQty(l.quantity)}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>{name(r.memberId)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={r.status} />
                          {r.validatedBy && (
                            <span className="text-xs text-muted-foreground">par {name(r.validatedBy)}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Eye className="h-3.5 w-3.5" />
        Historique en lecture seule : les modifications passent par les demandes de vente / dépôt / retrait.
      </div>
    </div>
  );
}
