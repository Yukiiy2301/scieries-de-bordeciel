import { Coins, Info, UserRound } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import {
  useStore,
  computeWeeklyTax,
  fmtQty,
  fmtSeptims,
  getCurrentWeekStart,
  memberWorksAt,
  openDebtsSummary,
  stockOf,
} from "@/lib/store";

export default function Stock() {
  const { db } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();
  const weekStart = getCurrentWeekStart();

  const personnel = db.profiles
    .filter((p) => p.role !== "client" && memberWorksAt(p.sawmillAccess, sawmillId))
    .sort((a, b) => a.name.localeCompare(b.name));
  const products = [...db.products].sort((a, b) => a.sortOrder - b.sortOrder);

  const readOnly = user!.role === "visiteur";
  const sawmill = db.sawmills.find((s) => s.id === sawmillId);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Stocks"
        subtitle={
          readOnly
            ? `${sawmill?.name} — consultation seule : quantités par membre, propres à cette scierie.`
            : `${sawmill?.name} — quantités par membre (uniquement cette scierie), dettes dues à chacun et taxe de la semaine.`
        }
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-card card-glow">
        <Table>
          <TableHeader>
            <TableRow className="table-head">
              <TableHead className="min-w-[160px]">Membre</TableHead>
              {products.map((p) => (
                <TableHead key={p.id} className="min-w-[90px] text-right">
                  {p.name}
                </TableHead>
              ))}
              <TableHead className="min-w-[180px]">Dû à ce membre</TableHead>
              <TableHead className="min-w-[140px] text-right">Taxe due (semaine)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personnel.map((m) => {
              const debts = openDebtsSummary(db, m.id, sawmillId);
              const tax = computeWeeklyTax(db, sawmillId, m.id, weekStart);
              const isCurrentUser = m.id === user!.id;
              return (
                <TableRow
                  key={m.id}
                  className={isCurrentUser ? "bg-primary/10 ring-1 ring-inset ring-primary/40 hover:bg-primary/15" : undefined}
                >
                  <TableCell className={isCurrentUser ? "border-l-2 border-primary" : undefined}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={isCurrentUser ? "font-semibold text-primary" : "font-medium"}>{m.name}</span>
                      {isCurrentUser && (
                        <Badge variant="outline" className="gap-1 border-primary/50 bg-primary/10 text-primary">
                          <UserRound className="h-3 w-3" /> Mon stock
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{ROLE_LABELS[m.role]}</div>
                  </TableCell>
                  {products.map((p) => (
                    <TableCell
                      key={p.id}
                      className={`text-right tabular-nums ${isCurrentUser ? "font-semibold text-foreground" : ""}`}
                    >
                      {fmtQty(stockOf(db, m.id, sawmillId, p.id))}
                    </TableCell>
                  ))}
                  <TableCell>
                    {debts.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-1">
                        {debts.map((d, i) => {
                          const debtor = db.profiles.find((p) => p.id === d.debtorId);
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs ring-1 ring-amber-500/30"
                            >
                              <Coins className="h-3 w-3 shrink-0 text-amber-500" />
                              <span>
                                <span className="font-semibold">{debtor?.name}</span> doit{" "}
                                <span className="font-semibold text-amber-400">{fmtSeptims(d.amount)}</span>
                                {d.count > 1 && (
                                  <span className="text-muted-foreground"> ({d.count} dettes)</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {tax.totalDueSeptims > 0 ? (
                      <span className="font-semibold text-primary">{fmtSeptims(tax.totalDueSeptims)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          La taxe due inclut la taxe sur le bénéfice (ventes − rachats), la taxe de citoyenneté et la
          cotisation de stockage de la scierie, calculées pour la semaine en cours (clôture samedi 23h59).
        </p>
      </div>
    </div>
  );
}
