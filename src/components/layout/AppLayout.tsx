import { useState, type ReactNode } from "react";
import { NavLink, Outlet, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  Calculator,
  ClipboardList,
  Coins,
  HandCoins,
  History,
  LayoutDashboard,
  LogOut,
  Scale,
  Settings,
  Shield,
  ShoppingCart,
  Trees,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { REQUESTABLE_ROLES, ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useSawmill } from "@/hooks/use-sawmill";
import { useStore } from "@/lib/store";
import { Field, nativeSelectClass } from "@/components/shared";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin", "gestionnaire", "employe", "visiteur"], end: true },
  { to: "/stock", label: "Stocks", icon: Boxes, roles: ["admin", "gestionnaire", "employe", "visiteur"] },
  { to: "/ventes", label: "Ventes", icon: HandCoins, roles: ["admin", "gestionnaire", "employe"] },
  { to: "/rachats", label: "Rachats", icon: ShoppingCart, roles: ["admin", "gestionnaire", "employe"] },
  { to: "/depots", label: "Dépôts & retraits", icon: Trees, roles: ["admin", "gestionnaire", "employe"] },
  { to: "/commandes", label: "Commandes", icon: ClipboardList, roles: ["admin", "gestionnaire", "client"] },
  { to: "/calculateur", label: "Calculateur", icon: Calculator, roles: ["admin", "gestionnaire", "employe", "client"] },
  { to: "/clients", label: "Clients", icon: Users, roles: ["admin"] },
  { to: "/membres", label: "Membres", icon: Shield, roles: ["admin"] },
  { to: "/dettes", label: "Dettes", icon: Scale, roles: ["admin", "gestionnaire"] },
  { to: "/taxes", label: "Taxes", icon: Coins, roles: ["admin", "gestionnaire", "employe"] },
  { to: "/historique", label: "Historique", icon: History, roles: ["admin", "gestionnaire", "visiteur"] },
  { to: "/tutoriel", label: "Tutoriel", icon: BookOpen, roles: ["admin", "gestionnaire", "employe", "client", "visiteur"] },
  { to: "/parametres", label: "Paramètres", icon: Settings, roles: ["admin"] },
];

export function allowedNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={user.role === "client" ? "/commandes" : "/"} replace />;
  }
  return <>{children}</>;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-icon flex h-9 w-9 items-center justify-center rounded-md shadow-lg shadow-orange-900/40">
        <Trees className="h-5 w-5 text-stone-950" />
      </div>
      <div className="leading-tight">
        <div className="font-display gold-text text-lg font-bold">Les Scieries de Bordeciel</div>
        <div className="text-[11px] text-muted-foreground">Registre des scieries</div>
      </div>
    </div>
  );
}

function SawmillSwitcher() {
  const { db } = useStore();
  const { user } = useAuth();
  const { sawmillId, setSawmillId } = useSawmill();
  const allowed = db.sawmills.filter((s) => user?.sawmillAccess === "both" || s.id === user?.sawmillAccess);

  if (allowed.length <= 1) {
    const current = db.sawmills.find((s) => s.id === sawmillId);
    return (
      <span className="inline-flex h-9 items-center rounded-md border border-input bg-secondary px-3 text-sm font-medium text-foreground">
        {current?.name ?? ""}
      </span>
    );
  }

  return (
    <select
      value={sawmillId}
      onChange={(e) => setSawmillId(e.target.value)}
      className="h-9 rounded-md border border-input bg-secondary px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {allowed.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function PendingScreen() {
  const { user, logout } = useAuth();
  const { updateProfile } = useStore();
  const [role, setRole] = useState(user?.requestedRole ?? "employe");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    await updateProfile(user.id, { requestedRole: role });
    setBusy(false);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 animate-fade-in">
        <div className="text-center">
          <div className="brand-icon mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl">
            <Trees className="h-7 w-7 text-stone-950" />
          </div>
          <h1 className="font-display gold-text text-2xl font-bold">Les Scieries de Bordeciel</h1>
        </div>
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="font-display text-lg">Compte en attente de validation</CardTitle>
            <CardDescription>
              Bonjour {user?.name}. Votre compte est en attente : le chef / administrateur doit valider
              votre rôle avant que vous puissiez accéder au registre des scieries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Rôle demandé">
              <select className={nativeSelectClass} value={role} onChange={(e) => setRole(e.target.value)}>
                {REQUESTABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={submit} disabled={busy} className="w-full">
              {sent ? "Demande envoyée" : "Envoyer ma demande de rôle"}
            </Button>
            {sent && (
              <p className="text-sm text-emerald-400">
                Demande enregistrée. Le chef la validera bientôt.
              </p>
            )}
            <Button variant="ghost" onClick={logout} className="w-full text-muted-foreground">
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { db } = useStore();
  const { sawmillId } = useSawmill();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "pending") return <PendingScreen />;

  const items = allowedNavItems(user.role);
  const isManager = user.role === "admin" || user.role === "gestionnaire";
  const pendingCount = user.role === "admin" ? db.profiles.filter((p) => p.role === "pending").length : 0;
  const pendingOrders = isManager
    ? db.orders.filter((o) => o.sawmillId === sawmillId && (o.status === "new" || o.status === "pending")).length
    : 0;
  const pendingSalesCount = isManager
    ? db.sales.filter((s) => s.sawmillId === sawmillId && s.status === "pending").length
    : 0;
  const pendingReqsCount = isManager
    ? db.stockRequests.filter((r) => r.sawmillId === sawmillId && r.status === "pending").length
    : 0;
  const badgeCounts: Record<string, number> = {
    "/membres": pendingCount,
    "/commandes": pendingOrders,
    "/ventes": pendingSalesCount,
    "/depots": pendingReqsCount,
  };
  const navBadge = (item: NavItem) => badgeCounts[item.to] ?? 0;

  return (
    <div className="flex h-full min-h-screen w-full">
      {/* Sidebar desktop */}
      <aside
        className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border lg:flex"
        style={{ background: "var(--sidebar-grad)" }}
      >
        <div className="p-4">
          <Brand />
        </div>
        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-inner ring-1 ring-sidebar-border"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4 text-primary/80" />
              {item.label}
              {navBadge(item) > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                  {navBadge(item)}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-1 text-sm font-medium text-foreground">{user.name}</div>
          <div className="mb-2 px-1 text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Brand />
          <div className="flex items-center gap-2">
            <SawmillSwitcher />
            <button
              onClick={logout}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-secondary text-muted-foreground hover:text-destructive"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Nav mobile */}
        <nav className="sticky top-[61px] z-10 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-3 py-2 backdrop-blur scrollbar-thin lg:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {navBadge(item) > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                  {navBadge(item)}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Main */}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="hidden text-sm text-muted-foreground lg:block">
              {user.name} · {ROLE_LABELS[user.role]}
            </div>
            <div className="ml-auto lg:ml-0">
              <SawmillSwitcher />
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
