import { useState } from "react";
import { BellRing, Check, Shield, Trash2, Users, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader, nativeSelectClass } from "@/components/shared";
import { ROLE_LABELS, SAWMILL_ACCESS_OPTIONS } from "@/lib/constants";
import type { Profile, Role } from "@/lib/types";
import { memberWorksAt, useStore } from "@/lib/store";
import { useSawmill } from "@/hooks/use-sawmill";

const ROLE_OPTIONS: Role[] = ["admin", "gestionnaire", "employe", "client", "visiteur"];

const ACCESS_LABELS: Record<Profile["sawmillAccess"], string> = {
  rivebois: "Scierie de Rivebois",
  penombris: "Scierie de Pénombris",
  both: "Les deux scieries",
};

function PendingRow({ p }: { p: Profile }) {
  const { updateProfile, deleteProfile } = useStore();
  const [role, setRole] = useState<Role>((p.requestedRole as Role) ?? "employe");
  const [sawmillAccess, setSawmillAccess] = useState<Profile["sawmillAccess"]>(p.sawmillAccess ?? "rivebois");
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    await updateProfile(p.id, { role, sawmillAccess });
    setBusy(false);
  };

  const refuse = async () => {
    setBusy(true);
    await deleteProfile(p.id);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-medium">{p.name}</div>
        <div className="text-xs text-muted-foreground">{p.email ?? "—"}</div>
        <div className="mt-1 text-xs">
          Demande :{" "}
          <span className="font-semibold text-amber-400">
            {ROLE_LABELS[(p.requestedRole as Role) ?? "visiteur"] ?? p.requestedRole}
          </span>{" "}
          ·{" "}
          <span className="text-muted-foreground">
            {ACCESS_LABELS[p.sawmillAccess] ?? "Les deux scieries"}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <select
          className={`${nativeSelectClass} h-9 w-40`}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          className={`${nativeSelectClass} h-9 w-44`}
          value={sawmillAccess}
          onChange={(e) => setSawmillAccess(e.target.value as Profile["sawmillAccess"])}
        >
          {SAWMILL_ACCESS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={busy} onClick={approve} className="bg-emerald-600 hover:bg-emerald-500">
          <Check className="h-4 w-4" /> Valider
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={refuse}>
          <X className="h-4 w-4" /> Refuser
        </Button>
      </div>
    </div>
  );
}

function MembersTable({ list }: { list: Profile[] }) {
  const { db, updateProfile, deleteProfile } = useStore();
  const adminCount = db.profiles.filter((x) => x.role === "admin").length;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card card-glow">
      <Table>
        <TableHeader>
          <TableRow className="table-head">
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-44">Rôle</TableHead>
            <TableHead className="w-48">Scierie</TableHead>
            <TableHead className="w-28">Réduction</TableHead>
            <TableHead className="w-40">Exonéré citoyenneté</TableHead>
            <TableHead className="text-right">Inscrit le</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.email ?? "—"}</TableCell>
              <TableCell>
                <select
                  className={`${nativeSelectClass} h-8 w-full`}
                  value={p.role}
                  onChange={(e) => updateProfile(p.id, { role: e.target.value as Role })}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <select
                  className={`${nativeSelectClass} h-8 w-full`}
                  value={p.sawmillAccess}
                  onChange={(e) =>
                    updateProfile(p.id, { sawmillAccess: e.target.value as Profile["sawmillAccess"] })
                  }
                >
                  {SAWMILL_ACCESS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 w-20 text-right"
                  value={p.discountPercent}
                  onChange={(e) =>
                    updateProfile(p.id, {
                      discountPercent: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                    })
                  }
                />
              </TableCell>
              <TableCell>
                <Switch
                  checked={p.taxExempt ?? false}
                  onCheckedChange={(v) => updateProfile(p.id, { taxExempt: v })}
                />
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {new Date(p.createdAt).toLocaleDateString("fr-FR")}
              </TableCell>
              <TableCell className="text-right">
                {adminCount > 1 || p.role !== "admin" ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteProfile(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Membres() {
  const { db } = useStore();
  const { sawmillId } = useSawmill();

  const sawmill = db.sawmills.find((s) => s.id === sawmillId);

  const pending = [...db.profiles]
    .filter((p) => p.role === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // Membres actifs de la scierie affichée : Rivebois → ses membres, Pénombris → ses membres,
  // et « les deux scieries » sont visibles dans les deux.
  const active = db.profiles
    .filter(
      (p) => p.role !== "pending" && memberWorksAt(p.sawmillAccess, sawmillId)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gestion des membres"
        subtitle={`${sawmill?.name ?? ""} — seuls les membres de cette scierie (et ceux « des deux ») sont affichés. Changez de scierie avec le sélecteur pour gérer l'autre.`}
      />

      {pending.length > 0 && (
        <Card className="card-glow mb-6 border-amber-500/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg text-amber-400">
              <BellRing className="h-4 w-4" /> Demandes de rôle ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((p) => (
              <PendingRow key={p.id} p={p} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="card-glow mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Users className="h-4 w-4 text-primary" /> Comment fonctionne l'inscription ?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Chaque joueur crée son compte (email + mot de passe + rôle demandé). Le tout premier compte
          devient Chef. Les suivants arrivent « en attente » : une notification rouge s'affiche sur cet
          onglet, vous choisissez leur rôle et leur scierie, puis vous validez. Sans validation, ils
          n'accèdent à rien.
        </CardContent>
      </Card>

      <h2 className="mb-2 font-display text-lg font-semibold">
        Membres de {sawmill?.name ?? ""}{" "}
        <span className="text-sm font-normal text-muted-foreground">({active.length})</span>
      </h2>
      {active.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-secondary/30 px-4 py-4 text-sm text-muted-foreground">
          Aucun membre pour cette scierie.
        </p>
      ) : (
        <MembersTable list={active} />
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        Supprimer un membre retire son accès. Les stocks, ventes et dettes liés à son compte sont
        supprimés automatiquement.
      </p>
    </div>
  );
}
