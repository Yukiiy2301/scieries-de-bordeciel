import { Link } from "react-router-dom";
import { ArrowUpRight, BellRing, ClipboardList, Coins, FileText, HandCoins, Scale, Shield, Trees } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import {
  clientRelance,
  computeWeeklyTax,
  fmtQty,
  fmtSeptims,
  getCurrentWeekStart,
  globalStockOf,
  memberWorksAt,
  useStore,
} from "@/lib/store";
import { VALIDATOR_ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/shared";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

/** Lecture d'une variable CSS du thème en couleur hsl « compatible SVG » (virgules) */
function themeColor(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  return raw || name;
}

/** Génère des graduations d'axe en paliers fixes de 5000 : 0 / 5000 / 10000 / 15000 / 20000… */
function fixedTicks(max: number): number[] {
  const m = Math.max(20000, max);
  const ticks: number[] = [];
  for (let v = 0; v <= m; v += 5000) ticks.push(v);
  return ticks;
}

export default function Dashboard() {
  const { db } = useStore();
  const { user } = useAuth();
  const { sawmillId } = useSawmill();

  const sawmill = db.sawmills.find((s) => s.id === sawmillId)!;
  const personnel = db.profiles.filter(
    (p) => p.role !== "client" && memberWorksAt(p.sawmillAccess, sawmillId)
  );

  const pendingSales = db.sales.filter((s) => s.sawmillId === sawmillId && s.status === "pending");
  const pendingRequests = db.stockRequests.filter(
    (r) => r.sawmillId === sawmillId && r.status === "pending"
  );
  const pendingSalesTotal = pendingSales.reduce((sum, s) => sum + s.total, 0);

  const openDebts = db.debts.filter((d) => d.sawmillId === sawmillId && d.status === "open");
  const openDebtsTotal = openDebts.reduce((sum, d) => sum + d.amount, 0);

  const weekStart = getCurrentWeekStart();
  const myTax = computeWeeklyTax(db, sawmillId, user!.id, weekStart);
  const totalTaxDue = personnel.reduce(
    (sum, p) => sum + computeWeeklyTax(db, sawmillId, p.id, weekStart).totalDueSeptims,
    0
  );

  const canValidate = VALIDATOR_ROLES.includes(user!.role);

  const pendingOrders = canValidate
    ? db.orders.filter((o) => o.sawmillId === sawmillId && (o.status === "new" || o.status === "pending")).length
    : 0;
  const pendingRoles = user!.role === "admin" ? db.profiles.filter((p) => p.role === "pending").length : 0;
  const toSignSales =
    user!.role === "admin"
      ? db.sales.filter(
          (s) =>
            s.sawmillId === sawmillId &&
            s.status === "validated" &&
            s.invoiceRequested &&
            !s.orderId &&
            !db.invoices.some((i) => i.kind === "sale" && i.sourceId === s.id)
        )
      : [];
  const toSignOrders =
    user!.role === "admin"
      ? db.orders.filter(
          (o) =>
            o.sawmillId === sawmillId &&
            (o.status === "taken" || o.status === "done") &&
            o.invoiceRequested &&
            !db.invoices.some((i) => i.kind === "order" && i.sourceId === o.id)
        )
      : [];
  const toSignCount = toSignSales.length + toSignOrders.length;
  const relance = user!.role === "admin" ? clientRelance(db) : [];
  const relanceRecent = relance.filter((r) => r.weeks < 2).length;
  const relanceLate = relance.filter((r) => r.weeks >= 2 && r.weeks < 4).length;
  const relanceVeryLate = relance.filter((r) => r.weeks >= 4).length;

  const pendingActions =
    pendingSales.length +
    pendingRequests.length +
    (canValidate ? pendingOrders : 0) +
    (user!.role === "admin" ? pendingRoles : 0);

  const chartData = [...db.products]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => {
      const qty = globalStockOf(db, sawmillId, p.id);
      const threshold = p.criticalThreshold ?? 0;
      const enabled = p.criticalEnabled ?? false;
      return {
        name: p.name,
        quantity: qty,
        threshold,
        enabled,
        critical: enabled && threshold > 0 && qty < threshold,
      };
    });
  const uniqueThresholds = [
    ...new Set(chartData.filter((d) => d.enabled && d.threshold > 0).map((d) => d.threshold)),
  ];
  const chartMax = Math.max(100, ...chartData.map((d) => d.quantity), ...uniqueThresholds);
  const yTicks = fixedTicks(chartMax);

  // Couleurs du thème résolues en valeurs SVG valides (les hsl(var(...)) ne marchent pas dans recharts)
  const cPrimary = themeColor("--primary");
  const cDestructive = themeColor("--destructive");
  const cBorder = themeColor("--border");
  const cMuted = themeColor("--muted-foreground");
  const cFg = themeColor("--foreground");
  const cPopover = themeColor("--popover");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Tableau de bord"
        subtitle={`${sawmill.name} — semaine du ${new Date(weekStart + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}
      />

      {canValidate && pendingActions > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 animate-pulse">
          <BellRing className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-bold">{pendingActions}</span> action{pendingActions > 1 ? "s" : ""} à
            valider (ventes, dépôts/retraits, commandes
            {user!.role === "admin" ? " ou demandes de rôle" : ""})
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/ventes" className="transition-transform hover:-translate-y-0.5">
          <Card className="card-glow h-full">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <HandCoins className="h-4 w-4 text-primary" /> Ventes en attente
              </CardDescription>
            </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", pendingSales.length > 0 ? "text-amber-400 drop-shadow-[0_0_12px_hsl(40_95%_55%/0.4)]" : "text-foreground")}>
                  {pendingSales.length}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  {fmtSeptims(pendingSalesTotal)}
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                </div>
              </CardContent>
          </Card>
        </Link>

        {canValidate && (
          <Link to="/depots" className="transition-transform hover:-translate-y-0.5">
            <Card className="card-glow h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Trees className="h-4 w-4 text-primary" /> Dépôts &amp; retraits en attente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", pendingRequests.length > 0 ? "text-amber-400 drop-shadow-[0_0_12px_hsl(40_95%_55%/0.4)]" : "text-foreground")}>
                  {pendingRequests.length}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  à valider
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {canValidate && (
          <Link to="/dettes" className="transition-transform hover:-translate-y-0.5">
            <Card className="card-glow h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-primary" /> Dû aux membres
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{fmtSeptims(openDebtsTotal)}</div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  {openDebts.length} dette{openDebts.length > 1 ? "s" : ""} ouverte{openDebts.length > 1 ? "s" : ""}
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {canValidate && (
          <Link to="/commandes" className="transition-transform hover:-translate-y-0.5">
            <Card className="card-glow h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-primary" /> Commandes à préparer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", pendingOrders > 0 ? "text-amber-400 drop-shadow-[0_0_12px_hsl(40_95%_55%/0.4)]" : "text-foreground")}>
                  {pendingOrders}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  à traiter
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {user!.role === "admin" && (
          <Link to="/membres" className="transition-transform hover:-translate-y-0.5">
            <Card className="card-glow h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-primary" /> Demandes de rôle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", pendingRoles > 0 ? "text-amber-400 drop-shadow-[0_0_12px_hsl(40_95%_55%/0.4)]" : "text-foreground")}>
                  {pendingRoles}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  à valider
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {user!.role === "admin" && (
          <Link to="/factures" className="transition-transform hover:-translate-y-0.5">
            <Card className="card-glow h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" /> Factures à signer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", toSignCount > 0 ? "text-amber-400 drop-shadow-[0_0_12px_hsl(40_95%_55%/0.4)]" : "text-foreground")}>
                  {toSignCount}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  {toSignCount > 0 ? "à éditer / signer" : "aucune en attente"}
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {user!.role !== "visiteur" && (
          <Link to="/taxes" className="transition-transform hover:-translate-y-0.5">
            <Card className="card-glow h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-primary" />
                  {canValidate ? "Taxes & bénéfices" : "Ma taxe de la semaine"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {fmtSeptims(canValidate ? totalTaxDue : myTax.totalDueSeptims)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {canValidate ? (
                    <>
                      {personnel.length} membres · clôture samedi 23h59
                    </>
                  ) : (
                    <>bénéfice : {fmtSeptims(Math.max(0, myTax.profit))}</>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <Card className="card-glow mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Trees className="h-4 w-4 text-primary" /> Stock critique
          </CardTitle>
          <CardDescription>
            Les zones rouges indiquent les seuils critiques configurés dans Paramètres : une barre qui
            entre dans sa zone rouge signale un stock en dessous du seuil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorBoundary
            fallback={
              <div className="space-y-2">
                {chartData.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{d.name}</span>
                    <span className={d.critical ? "font-semibold text-destructive" : "font-semibold text-primary"}>
                      {fmtQty(d.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            }
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cBorder} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: cMuted, fontSize: 12 }}
                  interval={0}
                  tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 11) + "…" : v)}
                />
                <YAxis
                  ticks={yTicks}
                  tickFormatter={(v: number) => String(v)}
                  tick={{ fill: cMuted, fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: cPopover,
                    border: `1px solid ${cBorder}`,
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: cFg }}
                  itemStyle={{ color: cFg }}
                  formatter={(value) => [fmtQty(Number(value)), "Stock global"]}
                />
                {chartData
                  .filter((d) => d.enabled && d.threshold > 0)
                  .map((d) => (
                    <ReferenceArea
                      key={`area-${d.name}`}
                      x1={d.name}
                      x2={d.name}
                      y1={0}
                      y2={d.threshold}
                      fill={cDestructive}
                      fillOpacity={0.18}
                      stroke={cDestructive}
                      strokeOpacity={0.4}
                      strokeDasharray="4 4"
                    />
                  ))}
                {uniqueThresholds.map((t) => (
                  <ReferenceLine
                    key={`line-${t}`}
                    y={t}
                    stroke={cDestructive}
                    strokeDasharray="4 4"
                    label={{
                      value: `seuil ${fmtQty(t)}`,
                      fill: cDestructive,
                      fontSize: 11,
                      position: "insideTopLeft",
                    }}
                  />
                ))}
                <Bar dataKey="quantity" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.critical ? cDestructive : cPrimary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </ErrorBoundary>
        </CardContent>
      </Card>

      {user!.role === "admin" && relance.length > 0 && (
        <Card className="card-glow mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <BellRing className="h-4 w-4 text-amber-400" /> Clients à relancer
            </CardTitle>
            <CardDescription>
              Clients sans commande ni vente depuis au moins une semaine — forgerons &amp; commerçants à
              relancer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {relance.map((r) => {
              const band =
                r.weeks >= 4 ? "3 semaines et +" : r.weeks >= 2 ? "2 à 3 semaines" : "1 semaine";
              const color =
                r.weeks >= 4 ? "text-destructive" : r.weeks >= 2 ? "text-amber-400" : "text-foreground";
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{r.name}</span>
                  <span className={cn("text-xs font-semibold", color)}>{band}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {canValidate && pendingSales.length > 0 && (
        <Card className="card-glow mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg">Ventes à valider</CardTitle>
            <CardDescription>
              Les plus récentes d'abord — aller à la page Ventes pour valider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...pendingSales]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 5)
              .map((sale) => {
                const seller = db.profiles.find((p) => p.id === sale.soldBy);
                return (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      {sale.lines.slice(0, 2).map((l) => {
                        const prod = db.products.find((p) => p.id === l.productId);
                        const owner = db.profiles.find((p) => p.id === l.memberId);
                        return (
                          <span key={l.id} className="mr-2">
                            <span className="font-medium">{prod?.name}</span> × {l.quantity}
                            <span className="text-muted-foreground"> ({owner?.name})</span>
                          </span>
                        );
                      })}
                      {sale.lines.length > 2 && (
                        <span className="text-muted-foreground">+{sale.lines.length - 2} autres</span>
                      )}
                      {seller && (
                        <span className="ml-2 text-xs text-muted-foreground">vendue par {seller.name}</span>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold text-primary">{fmtSeptims(sale.total)}</span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
