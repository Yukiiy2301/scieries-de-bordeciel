import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared";
import { PERSONNEL_ROLES, VALIDATOR_ROLES } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import {
  useStore,
  computeWeeklyTax,
  fmtSeptims,
  getCurrentWeekStart,
  getWeekStart,
  memberWorksAt,
} from "@/lib/store";

function weekRangeLabel(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

export default function Taxes() {
  const { db, setSettlementPaid } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();

  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const sawmill = db.sawmills.find((s) => s.id === sawmillId)!;
  const canValidate = VALIDATOR_ROLES.includes(user!.role);

  const runMarkPaid = async (memberId: string) => {
    if (busyMember) return; // anti double-clic
    setBusyMember(memberId);
    try {
      await setSettlementPaid(sawmillId, memberId, weekStart, true, user!.id);
    } catch {
      // silencieux
    } finally {
      setBusyMember(null);
    }
  };

  const members = canValidate
    ? db.profiles
        .filter((p) => PERSONNEL_ROLES.includes(p.role) && memberWorksAt(p.sawmillAccess, sawmillId))
        .sort((a, b) => a.name.localeCompare(b.name))
    : db.profiles.filter((p) => p.id === user!.id);

  const isCurrentWeek = weekStart === getCurrentWeekStart();

  const payment = (memberId: string) =>
    db.settlementPayments.find(
      (p) => p.sawmillId === sawmillId && p.memberId === memberId && p.weekStart === weekStart
    );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Taxes & bénéfices"
        subtitle={`Scierie : ${sawmill.name} — taxe de ${Math.round(sawmill.taxRate * 100)} % du bénéfice + taxe de citoyenneté (${fmtSeptims(sawmill.citizenshipSeptims)})${sawmill.citizenshipCharcoal > 0 ? ` + taxe de cotisation stockage (${sawmill.citizenshipCharcoal} charbon classique)` : ""}.`}
      >
        <div className="flex items-center gap-1 rounded-md border border-input bg-secondary p-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              const d = new Date(weekStart + "T00:00:00");
              d.setDate(d.getDate() - 7);
              setWeekStart(getWeekStart(d));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium">{weekRangeLabel(weekStart)}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={isCurrentWeek}
            onClick={() => {
              const d = new Date(weekStart + "T00:00:00");
              d.setDate(d.getDate() + 7);
              setWeekStart(getWeekStart(d));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      <div className="overflow-x-auto rounded-lg border border-border bg-card card-glow">
        <Table>
          <TableHeader>
            <TableRow className="table-head">
              <TableHead className="min-w-[140px]">Membre</TableHead>
              <TableHead className="text-right">Ventes − rachats</TableHead>
              <TableHead className="text-right">Taxe ({Math.round(sawmill.taxRate * 100)} %)</TableHead>
              <TableHead className="text-right">Citoyenneté &amp; stockage</TableHead>
              <TableHead className="text-right">Total dû</TableHead>
              <TableHead className="min-w-[130px] text-right">Paiement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const t = computeWeeklyTax(db, sawmillId, m.id, weekStart);
              const pay = payment(m.id);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.name}
                    {m.taxExempt && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-emerald-400">exonéré citoyenneté</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${t.profit < 0 ? "text-destructive" : ""}`}>
                    {fmtSeptims(t.profit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtSeptims(t.taxAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtSeptims(t.citizenshipSeptims)}
                    {t.citizenshipCharcoal > 0 && <span className="block text-xs">+ {t.citizenshipCharcoal} charbon cl. (stockage)</span>}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary tabular-nums">
                    {fmtSeptims(t.totalDueSeptims)}
                  </TableCell>
                  <TableCell className="text-right">
                    {pay?.paid ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40">
                        Payé le {new Date(pay.paidAt!).toLocaleDateString("fr-FR")}
                      </Badge>
                    ) : canValidate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyMember !== null}
                        onClick={() => void runMarkPaid(m.id)}
                      >
                        <Check className="h-4 w-4" /> Valider le paiement
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non payé</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {members.length === 0 && <EmptyState message="Aucun membre du personnel." />}

      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          {isCurrentWeek
            ? "Semaine en cours : la taxe est calculée au fil de l'eau et sera enregistrée à la clôture du samedi 23h59, puis une nouvelle semaine commencera."
            : "Semaine passée : la taxe correspond aux ventes et rachats enregistrés pendant cette semaine."}{" "}
          Seules les ventes validées sont comptées dans le bénéfice. Un bénéfice négatif ne génère pas de taxe. Pour
          un membre des deux scieries, les rachats forment un crédit commun : il est consommé une seule fois par les
          ventes de Rivebois et Pénombris, dans leur ordre chronologique. Le solde négatif commun est affiché dans
          les deux scieries, puis reporté, mais il n'est consommé qu'une seule fois.
        </p>
      </div>
    </div>
  );
}
