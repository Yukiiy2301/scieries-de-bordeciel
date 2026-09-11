import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
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
import { useStore } from "@/lib/store";

/** Permet au chef / admin de corriger le nom du client d'une vente (oubli ou erreur). */
export function ClientNameEdit({ saleId, currentName }: { saleId: string; currentName?: string }) {
  const { updateSaleClientLabel } = useStore();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentName ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    const name = value.trim();
    if (!name) {
      toast.error("Le nom du client ne peut pas être vide.");
      return;
    }
    setBusy(true);
    try {
      await updateSaleClientLabel(saleId, name);
      toast.success("Nom du client mis à jour", { description: name });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-primary"
        title="Modifier le nom du client"
        onClick={() => {
          setValue(currentName ?? "");
          setOpen(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Modifier le nom du client</DialogTitle>
            <DialogDescription>
              Ce nom apparaîtra sur la facture de cette vente si elle est éditée par la suite.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Nom du client"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
