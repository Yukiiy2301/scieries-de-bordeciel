import { useState } from "react";
import { ChevronDown, ChevronRight, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import { fmtQty, fmtSeptims, useStore } from "@/lib/store";
import type { Debt } from "@/lib/types";

export default function Dettes() {
  const { db, settleDebt } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const runSettle = async (debtId: string) => {
    if (busyId) return; // anti double-clic
    setBusyId(debtId);
    try {
      await settleDebt(debtId, user!.id);
    } catch {
      // silencieux : l'action sera retentée à la prochaine ouverture
    } finally {
      setBusyId(null);
    }
  };

  const debts = db.debts.filter((d) => d.sawmillId === sawmillId);
  const open = debts.filter((d) => d.status === "open").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const settled = debts.filter((d) => d.status === "settled").sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? ""));
  const totalOpen = open.reduce((s, d) => s + d.amount, 0);

  // Regroupement par couple débiteur → créditeur
  const groups = new Map<string, { debtorId: string; creditorId: string; total: number; items: Debt[] }>();
  for (const d of open) {
    const key = `${d.debtorId}|${d.creditorId}`;
    const g = groups.get(key) ?? { debtorId: d.debtorId, creditorId: d.creditorId, total: 0, items: [] };
    g.total += d.amount;
    g.items.push(d);
    groups.set(key, g);
  }
  const groupList = [...groups.values()].sort((a, b) => b.total - a.total);

  const name = (id: string) => db.profiles.find((p) => p.id === id)?.name ?? "?";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dettes"
        subtitle="Lorsqu'un gestionnaire vend depuis le stock d'un membre, la scierie doit une somme à ce membre. Les dettes d'une même personne sont regroupées."
      />

      <div className="mb-4 flex flex-wrap gap-4">
        <Card className="card-glow min-w-[220px]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-sm">
              <Scale className="h-4 w-4 text-primary" /> Total dû aux membres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{fmtSeptims(totalOpen)}</div>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Dettes ouvertes</h2>
      {groupList.length === 0 ? (
        <EmptyState message="Aucune dette ouverte. Toutes les dettes ont été réglées." />
      ) : (
        <div className="space-y-3">
          {groupList.map((g) => {
            const key = `${g.debtorId}|${g.creditorId}`;
            const isOpen = !!expanded[key];
            return (
              <Card key={key} className="card-glow">
                <CardContent className="pt-4">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0 text-sm">
                      <span className="font-semibold text-amber-400">{name(g.debtorId)}</span>
                      <span className="text-muted-foreground"> doit à </span>
                      <span className="font-semibold">{name(g.creditorId)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {g.items.length > 1 ? `${g.items.length} dettes` : "1 dette"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold text-primary">{fmtSeptims(g.total)}</span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      {g.items.map((d) => {
                        const product = d.productId ? db.products.find((p) => p.id === d.productId) : undefined;
                        return (
                          <div
                            key={d.id}
                            className="flex flex-col gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="text-muted-foreground">
                              {product ? (
                                <span>
                                  <span className="font-medium text-foreground">{product.name}</span> ×{" "}
                                  {fmtQty(d.quantity ?? 0)}
                                </span>
                              ) : (
                                "Dette"
                              )}{" "}
                              · {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="font-semibold text-primary">{fmtSeptims(d.amount)}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId !== null}
                                onClick={() => void runSettle(d.id)}
                              >
                                Marquer réglé
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Dettes réglées</h2>
      {settled.length === 0 ? (
        <EmptyState message="Aucune dette réglée pour l'instant." />
      ) : (
        <div className="space-y-2">
          {settled.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/60 px-4 py-2.5 text-sm"
            >
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{name(d.debtorId)}</span> →{" "}
                {name(d.creditorId)} · réglé par {name(d.settledBy!)} le{" "}
                {new Date(d.settledAt!).toLocaleDateString("fr-FR")}
              </div>
              <span className="font-semibold text-muted-foreground line-through">{fmtSeptims(d.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
