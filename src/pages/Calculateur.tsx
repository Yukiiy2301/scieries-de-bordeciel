import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator as CalcIcon, Flame, Gem, Hammer, HandCoins, Pencil, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Field } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { useStore, fmtQty } from "@/lib/store";
import { cn } from "@/lib/utils";

const CHARCOAL_META: Record<string, { label: string; color: string }> = {
  "charbon-pauvre": { label: "Charbon pauvre", color: "#b0a899" },
  "charbon-classique": { label: "Charbon classique", color: "#e6a13c" },
  "charbon-briquette": { label: "Charbon briquette", color: "#9a6a34" },
  "charbon-coke": { label: "Charbon coke", color: "#5b6472" },
};
const CHARCOAL_KEYS = Object.keys(CHARCOAL_META);

function ItemChip({ keyId, label, quantity, big }: { keyId: string; label: string; quantity: number; big?: boolean }) {
  const isCharcoal = CHARCOAL_KEYS.includes(keyId);
  const color = isCharcoal ? CHARCOAL_META[keyId].color : "#8a93a6";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        big && "px-3.5 py-2 text-sm"
      )}
      style={{ borderColor: `${color}55`, background: `${color}1a`, color }}
    >
      {isCharcoal ? <Flame className="h-3.5 w-3.5" /> : <Gem className="h-3.5 w-3.5" />}
      {quantity} × {label}
    </span>
  );
}

export default function Calculateur() {
  const { db, updateRecipe } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  const isAdmin = user?.role === "admin";
  const isClient = user?.role === "client";
  const recipes = [...db.recipes].sort((a, b) => a.sortOrder - b.sortOrder);

  const qtyOf = (id: string) => Math.max(0, parseInt(qtys[id] || "0", 10) || 0);

  // Total de charbon nécessaire par type
  const charcoalTotals: Record<string, number> = {};
  for (const key of CHARCOAL_KEYS) charcoalTotals[key] = 0;
  for (const r of recipes) {
    const q = qtyOf(r.id);
    for (const ing of r.ingredients) {
      if (charcoalTotals[ing.key] !== undefined) charcoalTotals[ing.key] += ing.quantity * q;
    }
  }
  const anyRequest = recipes.some((r) => qtyOf(r.id) > 0);

  const orderItems = CHARCOAL_KEYS.filter((k) => charcoalTotals[k] > 0).map((k) => ({
    productId: k,
    quantity: charcoalTotals[k],
  }));
  const goCommand = () => navigate("/commandes", { state: { calcOrder: orderItems } });
  const goVente = () => navigate("/ventes", { state: { calcSale: orderItems } });

  const updateIngredient = (recipeId: string, index: number, quantity: number) => {
    const recipe = db.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const ingredients = recipe.ingredients.map((ing, i) =>
      i === index ? { ...ing, quantity: Math.max(0, quantity) } : ing
    );
    void updateRecipe(recipeId, ingredients);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Calculateur de fusion" subtitle="Indiquez le nombre de lingots souhaités : le calculateur vous donne le charbon et les minerais nécessaires.">
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
            <Pencil className="h-4 w-4" /> {editing ? "Terminer la modification" : "Modifier les recettes"}
          </Button>
        )}
      </PageHeader>

      <Card className="card-glow mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <CalcIcon className="h-4 w-4 text-primary" /> Charbon total nécessaire
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {anyRequest ? (
            CHARCOAL_KEYS.filter((k) => charcoalTotals[k] > 0).map((k) => (
              <ItemChip key={k} keyId={k} label={CHARCOAL_META[k].label} quantity={charcoalTotals[k]} big />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Entrez un nombre de lingots ci-dessous pour voir le charbon nécessaire.
            </p>
          )}
        </CardContent>
      </Card>

      {anyRequest && (
        <Card className="card-glow mb-6 border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <p className="text-sm text-muted-foreground">
              {isClient
                ? "Vous pouvez commander ces quantités de charbon à la scierie."
                : "Vous pouvez préparer une vente de ces quantités de charbon (modifiable ensuite)."}
            </p>
            {isClient ? (
              <Button onClick={goCommand}>
                <ShoppingCart className="h-4 w-4" /> Commander
              </Button>
            ) : (
              <Button onClick={goVente}>
                <HandCoins className="h-4 w-4" /> Préparer une vente
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {recipes.map((r) => {
          const q = qtyOf(r.id);
          return (
            <Card key={r.id} className="card-glow flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
                    <Hammer className="h-4 w-4 text-primary" />
                  </span>
                  {r.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {r.ingredients.map((ing, i) =>
                    editing && isAdmin ? (
                      <div key={i} className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1">
                        {CHARCOAL_KEYS.includes(ing.key) ? (
                          <Flame className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Gem className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="text-xs">{ing.label}</span>
                        <Input
                          type="number"
                          min={0}
                          className="h-7 w-14 px-1 text-right text-xs"
                          value={ing.quantity}
                          onChange={(e) => updateIngredient(r.id, i, parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                    ) : (
                      <ItemChip key={i} keyId={ing.key} label={ing.label} quantity={ing.quantity} />
                    )
                  )}
                </div>

                <div className="mt-auto">
                  <Field label="Nombre de lingots">
                    <Input
                      type="number"
                      min={0}
                      value={qtys[r.id] ?? ""}
                      onChange={(e) => setQtys((s) => ({ ...s, [r.id]: e.target.value }))}
                      placeholder="0"
                    />
                  </Field>
                  {q > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Besoin pour {fmtQty(q)} lingot{q > 1 ? "s" : ""} :{" "}
                      {r.ingredients.map((ing, i) => (
                        <span key={i}>
                          {i > 0 && ", "}
                          {fmtQty(ing.quantity * q)} {ing.label}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isAdmin && editing && (
        <p className="mt-4 text-xs text-muted-foreground">
          Mode modification : ajustez les quantités directement sur chaque recette (enregistré automatiquement).
        </p>
      )}
    </div>
  );
}
