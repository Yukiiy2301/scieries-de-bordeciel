import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Trees } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M19.54 5.34A17.3 17.3 0 0 0 15.3 4a12 12 0 0 0-.54 1.1 16.1 16.1 0 0 0-5.5 0A11.3 11.3 0 0 0 8.7 4a17.4 17.4 0 0 0-4.24 1.35C1.78 9.32 1.06 13.2 1.42 17a17 17 0 0 0 5.2 2.63 12.8 12.8 0 0 0 1.27-1.65 10.8 10.8 0 0 1-2-.95l.49-.38a12.4 12.4 0 0 0 11.24 0l.5.38a11 11 0 0 1-2 .95c.37.58.8 1.13 1.27 1.65A17 17 0 0 0 22.58 17c.43-4.4-.74-8.24-3.04-11.66ZM8.52 14.7c-1.06 0-1.94-.98-1.94-2.18 0-1.2.86-2.18 1.94-2.18 1.08 0 1.96.99 1.94 2.18 0 1.2-.86 2.18-1.94 2.18Zm6.96 0c-1.06 0-1.94-.98-1.94-2.18 0-1.2.86-2.18 1.94-2.18 1.08 0 1.96.99 1.94 2.18 0 1.2-.86 2.18-1.94 2.18Z" />
    </svg>
  );
}

export default function Login() {
  const { user, loginWithDiscord } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === "client" ? "/commandes" : "/"} replace />;

  const handleDiscordLogin = async () => {
    setBusy(true);
    setError("");
    const { error: authError } = await loginWithDiscord();
    if (authError) {
      setError(authError);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 animate-fade-in">
        <div className="mb-6 text-center">
          <div className="brand-icon mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl shadow-xl shadow-orange-900/50">
            <Trees className="h-7 w-7 text-stone-950" />
          </div>
          <h1 className="font-display gold-text text-3xl font-bold">Les Scieries de Bordeciel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Registre des stocks — Rivebois &amp; Pénombris</p>
          <div className="deco-rule mx-auto mt-4 max-w-[220px]" />
        </div>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="font-display text-lg">Connexion au registre</CardTitle>
            <CardDescription>
              Utilisez votre compte Discord. Lors de votre première connexion, un profil sera créé automatiquement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleDiscordLogin} disabled={busy} className="w-full gap-2">
              <DiscordIcon />
              {busy ? "Redirection vers Discord…" : "Se connecter avec Discord"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-center text-xs text-muted-foreground">
              Le premier compte créé devient automatiquement administrateur. Les comptes suivants devront être validés dans le registre.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
