import { Settings, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Field, PageHeader } from "@/components/shared";
import { fmtSeptims, useStore } from "@/lib/store";

export default function Parametres() {
  const { db, updateSawmill, updateProduct, resetData } = useStore();

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Paramètres"
        subtitle="Taux de taxes et prix modifiables — réservé au chef / administrateur."
      />

      {db.sawmills.map((s) => (
        <Card key={s.id} className="card-glow">
          <CardHeader>
            <CardTitle className="font-display text-lg">{s.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Taxe sur le bénéfice (%)">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={Math.round(s.taxRate * 100 * 10) / 10}
                onChange={(e) => updateSawmill(s.id, { taxRate: (parseFloat(e.target.value) || 0) / 100 })}
              />
            </Field>
            <Field label="Taxe de citoyenneté (septims)">
              <Input
                type="number"
                min={0}
                value={s.citizenshipSeptims}
                onChange={(e) => updateSawmill(s.id, { citizenshipSeptims: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              />
            </Field>
            <Field label="Taxe de cotisation stockage (charbon classique)">
              <Input
                type="number"
                min={0}
                value={s.citizenshipCharcoal}
                onChange={(e) => updateSawmill(s.id, { citizenshipCharcoal: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              />
            </Field>
          </CardContent>
        </Card>
      ))}

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="font-display text-lg">Prix des produits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...db.products]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-secondary/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{p.name}</div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch
                      checked={p.criticalEnabled ?? false}
                      onCheckedChange={(v) => updateProduct(p.id, { criticalEnabled: v })}
                    />
                    Seuil critique {p.criticalEnabled ? "activé" : "désactivé"}
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <Field label="Prix de vente">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      className="h-9 w-28 text-right"
                      value={p.salePrice}
                      onChange={(e) => updateProduct(p.id, { salePrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                  </Field>
                  <Field label="Prix de rachat">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      className="h-9 w-28 text-right"
                      value={p.buybackPrice}
                      onChange={(e) => updateProduct(p.id, { buybackPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                  </Field>
                  <div className="pb-2 text-sm text-muted-foreground">
                    marge : {fmtSeptims(Math.round((p.salePrice - p.buybackPrice) * 100) / 100)}
                  </div>
                </div>
                {p.criticalEnabled && (
                  <Field label="Seuil critique (stock global en dessous duquel c'est critique)">
                    <Input
                      type="number"
                      min={0}
                      className="h-9 w-40 text-right"
                      value={p.criticalThreshold ?? 5000}
                      onChange={(e) =>
                        updateProduct(p.id, { criticalThreshold: Math.max(0, parseInt(e.target.value, 10) || 0) })
                      }
                    />
                  </Field>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg text-destructive">
            <Settings className="h-4 w-4" /> Zone dangereuse
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Efface toutes les données d'exploitation (stocks, ventes, rachats, demandes, dettes,
            commandes, taxes, fiches clients) de toutes les scieries. Les comptes, scieries et produits
            sont conservés. Cette action est irréversible.
          </p>
          <Button variant="destructive" onClick={() => void resetData()}>
            <Trash2 className="h-4 w-4" /> Réinitialiser les données
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
