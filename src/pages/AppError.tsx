import { AlertTriangle, RefreshCw, Trees } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="brand-icon mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl">
          <Trees className="h-7 w-7 text-stone-950" />
        </div>
        <h1 className="flex items-center justify-center gap-2 font-display text-xl font-bold">
          <AlertTriangle className="h-5 w-5 text-amber-400" /> Une erreur est survenue
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Le registre a rencontré un problème inattendu. Rechargez la page pour continuer — vos données
          sont en sécurité.
        </p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          <RefreshCw className="h-4 w-4" /> Recharger la page
        </Button>
      </div>
    </div>
  );
}
