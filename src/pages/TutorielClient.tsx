import {
  BadgePercent,
  Calculator as CalculatorIcon,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Info,
  MapPin,
  ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";

function Rule({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export default function TutorielClient() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Votre guide client"
        subtitle="Tout ce que vous pouvez faire en tant que client des Scieries de Bordeciel : commander du charbon et du bois, profiter de vos réductions et calculer vos besoins de fusion."
      />

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Info className="h-4 w-4 text-primary" /> Bienvenue, client !
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            En tant que client, vous avez accès à <span className="text-foreground">Commandes</span>, au{" "}
            <span className="text-foreground">Calculateur de fusion</span> et à ce guide. Le registre
            (stocks, ventes, dépôts, taxes…) est réservé au personnel des scieries.
          </p>
          <p>
            Chaque commande est passée auprès de la scierie sélectionnée en haut de l'écran (Rivebois ou
            Pénombris), puis préparée par un gestionnaire. Vous pouvez suivre son avancement en continu.
          </p>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <ShoppingCart className="h-4 w-4 text-primary" /> Commander (onglet Commandes)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Rule icon={<ShoppingCart className="h-4 w-4 text-emerald-400" />} title="Composer votre commande">
            <p>
              Dans l'onglet <span className="text-foreground">Commandes</span>, choisissez les produits
              (charbon, bois…) et la quantité souhaitée pour chacun. Le prix total est calculé
              automatiquement. Vous pouvez cocher « Demander une facture » : le chef vous remettra ensuite
              une <span className="text-foreground">facture parchemin signée</span>.
            </p>
          </Rule>
          <Rule icon={<Clock className="h-4 w-4 text-emerald-400" />} title="Retrait et livraison">
            <p>
              Précisez l'<span className="text-foreground">heure de retrait</span> (ex. « 20h ») et le{" "}
              <span className="text-foreground">lieu de livraison</span> ou une note. Cliquez ensuite sur
              « Envoyer la commande ».
            </p>
          </Rule>
          <Rule icon={<ClipboardCheck className="h-4 w-4 text-amber-400" />} title="Suivre son avancement">
            <p>
              Vos commandes apparaissent dans « Mes commandes » avec leur statut :{" "}
              <span className="text-foreground">« à préparer »</span> →{" "}
              <span className="text-foreground">« prise en charge »</span> (le personnel prélève les stocks
              de la scierie pour préparer votre commande) →{" "}
              <span className="text-foreground">« terminée »</span>.
            </p>
          </Rule>
          <Rule icon={<MapPin className="h-4 w-4 text-amber-400" />} title="Retrait direct">
            <p>
              Si vous passez prendre votre commande à la scierie, il suffit d'indiquer l'heure de retrait
              et de laisser le lieu vide.
            </p>
          </Rule>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <BadgePercent className="h-4 w-4 text-primary" /> Votre réduction
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Rule icon={<FileCheck2 className="h-4 w-4 text-emerald-400" />} title="Fiche client validée">
            <p>
              Si le chef a validé une <span className="text-foreground">fiche client</span> pour vous, votre
              réduction est appliquée <span className="text-foreground">automatiquement</span> à toutes vos
              commandes. Vous voyez le pourcentage déduit avant d'envoyer.
            </p>
          </Rule>
          <Rule icon={<BadgePercent className="h-4 w-4 text-amber-400" />} title="Demander une fiche">
            <p>
              Sans fiche, vous pouvez en <span className="text-foreground">demander une</span> directement
              dans le formulaire de commande : choisissez la fiche souhaitée, le chef la valide, puis votre
              réduction s'applique.
            </p>
          </Rule>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <CalculatorIcon className="h-4 w-4 text-primary" /> Le calculateur de fusion
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Rule icon={<CalculatorIcon className="h-4 w-4 text-emerald-400" />} title="Entrer vos lingots">
            <p>
              Indiquez le <span className="text-foreground">nombre de lingots souhaités</span> (fer, acier,
              ébène…) : le calculateur vous donne le <span className="text-foreground">total de charbon
              nécessaire</span> par type (pauvre, classique, briquette, coke) et le détail des minerais par
              recette.
            </p>
          </Rule>
          <Rule icon={<ShoppingCart className="h-4 w-4 text-amber-400" />} title="Commander en un clic">
            <p>
              Cliquez sur « <span className="text-foreground">Commander</span> » : votre commande s'ouvre{" "}
              <span className="text-foreground">pré-remplie</span> avec ces quantités de charbon et votre
              réduction déjà appliquée. Il ne reste qu'à préciser l'heure de retrait et le lieu.
            </p>
          </Rule>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <CheckCircle2 className="h-4 w-4 text-primary" /> En résumé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. <span className="text-foreground">Calculateur</span> : entrez vos lingots → « Commander ».</p>
          <p>2. <span className="text-foreground">Commandes</span> : vérifiez les quantités, ajoutez l'heure de retrait et le lieu → « Envoyer ».</p>
          <p>3. <span className="text-foreground">Mes commandes</span> : suivez « à préparer » → « prise en charge » → « terminée ».</p>
          <p className="pt-1 text-xs text-muted-foreground">
            Une question ? Le chef ou un gestionnaire peut vous aider et valider votre fiche client.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
