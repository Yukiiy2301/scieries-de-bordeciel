import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, ScrollText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore, fmtSeptims } from "@/lib/store";
import { downloadInvoicePdf, generateInvoice, type InvoicePdfResult } from "@/lib/invoice";

interface DialogProps {
  kind: "sale" | "order";
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FactureDialog({ kind, id, open, onOpenChange }: DialogProps) {
  const { db } = useStore();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InvoicePdfResult | null>(null);

  const sale = kind === "sale" ? db.sales.find((s) => s.id === id) : undefined;
  const order = kind === "order" ? db.orders.find((o) => o.id === id) : undefined;
  const sawmillId = sale?.sawmillId ?? order?.sawmillId;
  const sawmillName = db.sawmills.find((s) => s.id === sawmillId)?.name;
  const clientLabel =
    sale?.clientLabel ??
    (order ? db.profiles.find((p) => p.id === order.clientId)?.name : undefined) ??
    "";
  const amount = sale?.total ?? order?.total ?? 0;

  const close = (next: boolean) => {
    if (!next) {
      setResult(null);
      setBusy(false);
    }
    onOpenChange(next);
  };

  const issue = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await generateInvoice(kind, id);
      setResult(res);
      downloadInvoicePdf(res);
      toast.success("Facture émise", { description: `${res.invoiceNo} téléchargée.` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ScrollText className="h-5 w-5 text-primary" /> Éditer la facture
          </DialogTitle>
          <DialogDescription>
            {kind === "sale" ? "Vente" : "Commande"}
            {clientLabel ? ` de ${clientLabel}` : ""} · {sawmillName ?? "Scierie"}
            {amount ? ` · ${fmtSeptims(amount)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-secondary/30 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Facture parchemin officielle
            </p>
            <p className="text-muted-foreground">
              Signée par <span className="font-medium text-foreground">D'jack Borgne</span>, propriétaire de{" "}
              {sawmillName ? <span className="text-foreground">{sawmillName}</span> : "la scierie"}, puis
              téléchargée au format PDF.
            </p>
          </div>

          {result && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              Facture <span className="font-semibold">{result.invoiceNo}</span> émise et téléchargée.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={busy}>
            Fermer
          </Button>
          {result ? (
            <Button onClick={() => downloadInvoicePdf(result)}>
              <Download className="h-4 w-4" /> Télécharger à nouveau
            </Button>
          ) : (
            <Button onClick={() => void issue()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {busy ? "Création de la facture…" : "Éditer la facture"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bouton « Facture » pour le chef / admin (ouvre le dialogue de génération). */
export function FactureButton({
  kind,
  id,
  issued,
  className,
}: {
  kind: "sale" | "order";
  id: string;
  issued?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" />
        {issued ? "PDF émis" : "Facture"}
        {issued && (
          <Badge className="ml-1 h-4 bg-emerald-500/15 px-1 text-[10px] text-emerald-400 ring-1 ring-emerald-500/40">
            oui
          </Badge>
        )}
      </Button>
      {open && <FactureDialog kind={kind} id={id} open={open} onOpenChange={setOpen} />}
    </>
  );
}

/** Dialogue contrôlé (ex. proposé automatiquement au chef après une vente). */
export function FactureDialogControlled({ kind, id, open, onOpenChange }: DialogProps) {
  return <FactureDialog kind={kind} id={id} open={open} onOpenChange={onOpenChange} />;
}
