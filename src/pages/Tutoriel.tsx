import {
  BookOpen,
  Calculator as CalculatorIcon,
  CheckCircle2,
  ClipboardList,
  Coins,
  Flame,
  HandCoins,
  Info,
  Pencil,
  Scale,
  Shield,
  ShoppingCart,
  Trees,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/constants";
import TutorielClient from "./TutorielClient";

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

export default function Tutoriel() {
  const { user } = useAuth();
  const role = user?.role ?? "visiteur";
  if (role === "client") return <TutorielClient />;
  const isManager = role === "admin" || role === "gestionnaire";
  const isChef = role === "admin";

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Tutoriel"
        subtitle={`Guide adapté à votre rôle : ${ROLE_LABELS[role]}. Chaque explication correspond à ce que vous pouvez réellement faire.`}
      />

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Info className="h-4 w-4 text-primary" /> Bienvenue aux Scieries de Bordeciel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Ce registre gère le stock de charbon et de bois des deux scieries (Rivebois et Pénombris),
            les rachats aux joueurs, les ventes, les dettes et les taxes hebdomadaires.
          </p>
          <p>
            <span className="text-foreground">Stocks et taxes sont séparés par scierie.</span> Le sélecteur
            en haut change de scierie : vous ne voyez que la scierie sélectionnée. Les membres de Rivebois
            n'apparaissent qu'à Rivebois, ceux de Pénombris qu'à Pénombris ; les personnes « les deux
            scieries » apparaissent dans les deux, avec des stocks et des taxes bien distincts par scierie.
          </p>
          <p>
            La semaine fiscale va du <span className="text-foreground">dimanche 00h00 au samedi 23h59</span> :
            la taxe (30 % à Rivebois, 15 % à Pénombris du bénéfice) + la taxe de citoyenneté et la cotisation
            stockage sont <span className="text-foreground">enregistrées automatiquement à la clôture</span>,
            puis une nouvelle semaine commence.
          </p>
          <p>
            <span className="text-foreground">Notifications :</span> dès qu'une action attend une validation,
            un <span className="text-foreground">badge rouge</span> apparaît sur l'onglet concerné (Ventes,
            Dépôts &amp; retraits, Commandes, Membres) et un <span className="text-foreground">bandeau ambre</span>{" "}
            s'affiche sur le tableau de bord.
          </p>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Trees className="h-4 w-4 text-primary" /> Le dépôt et le retrait de stock
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Rule icon={<Trees className="h-4 w-4 text-emerald-400" />} title="Le dépôt">
            Vous ajoutez dans <span className="text-foreground">votre stock de la scierie sélectionnée</span> du
            charbon / bois que vous avez (produit, acheté, racheté…). Vous pouvez déposer plusieurs produits
            d'un coup. Indiquez obligatoirement <span className="text-foreground">où vous remettez la
            marchandise</span> : à un gestionnaire/chef en main propre, ou laissée dans l'un des deux tonneaux
            (gauche ou droit) — le gestionnaire la retrouve là où vous l'avez laissée.
          </Rule>
          <Rule icon={<HandCoins className="h-4 w-4 text-amber-400" />} title="Le retrait">
            Vous reprenez du stock de la scierie (pour forger, vendre ailleurs…). Le stock est vérifié : un
            retrait supérieur au disponible est <span className="text-foreground">refusé</span> avec un message
            précisant quel stock est insuffisant.
          </Rule>
          {(isManager || isChef) && (
            <div className="sm:col-span-2">
              <Rule icon={<Shield className="h-4 w-4 text-primary" />} title="Règle gestionnaires / chef">
                <p>
                  Vos dépôts et retraits sont <span className="text-foreground">appliqués immédiatement</span>{" "}
                  (sans validation) et vous choisissez <span className="text-foreground">dans le stock de quel
                  membre</span> déposer (ou retirer) via la liste déroulante « Déposer dans le stock de » /
                  « Retirer du stock de ».
                </p>
              </Rule>
            </div>
          )}
          {role === "employe" && (
            <div className="sm:col-span-2">
              <Rule icon={<ClipboardList className="h-4 w-4 text-amber-400" />} title="Vos demandes d'employé">
                <p>
                  Vos dépôts/retraits partent en <span className="text-foreground">« demande »</span> : un
                  gestionnaire ou le chef doit les <span className="text-foreground">valider</span> avant que
                  votre stock ne change (onglet « À valider », badge rouge).
                </p>
              </Rule>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <ShoppingCart className="h-4 w-4 text-primary" /> Le rachat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            La scierie <span className="text-foreground">rachète</span> charbon et bois aux joueurs (prix
            affichés par produit). Le rachat est <span className="text-foreground">enregistré</span> (et compté
            dans vos taxes) mais <span className="text-foreground">n'entre pas en stock automatiquement</span> :
            faites ensuite un <span className="text-foreground">dépôt</span> pour le déposer dans la scierie.
            Un rachat ne crée jamais de dette.
          </p>
          <p>
            Une personne « les deux scieries » voit ses rachats dans les deux registres (marqués « rachat
            partagé »). Leur valeur forme un <span className="text-foreground">crédit fiscal commun</span> : ce
            crédit réduit une seule fois ses ventes de Rivebois et Pénombris, dans leur ordre chronologique. Le
            solde négatif commun apparaît dans les deux scieries pour rester visible, puis il est reporté sans être
            compté deux fois.
          </p>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <HandCoins className="h-4 w-4 text-primary" /> La vente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Rule icon={<HandCoins className="h-4 w-4 text-emerald-400" />} title="Comment vendre">
            Une vente peut mélanger plusieurs produits, prélevés <span className="text-foreground">dans le
            stock</span> ou vendus <span className="text-foreground">« sur soi »</span> (sans toucher au stock).
            Par ligne, entrez la <span className="text-foreground">quantité</span> ou le{" "}
            <span className="text-foreground">montant en septims</span> : l'autre est calculé automatiquement.
            Le stock est vérifié avant chaque vente.
          </Rule>
          <Rule icon={<Coins className="h-4 w-4 text-amber-400" />} title="Réduction client">
            Si vous vendez à un client enregistré (fiche client ou compte), choisissez-le : sa réduction est
            appliquée automatiquement au total et aux parts de chacun.
          </Rule>
          {(isManager || isChef) && (
            <div className="sm:col-span-2">
              <Rule icon={<Scale className="h-4 w-4 text-primary" />} title="Vente depuis le stock d'un autre membre">
                <p>
                  Gestionnaires et chef peuvent vendre en prélevant dans le stock d'un membre de la scierie
                  sélectionnée : son stock est débité et une <span className="text-foreground">dette
                  automatique</span> est créée. Les dettes sont suivies dans la page{" "}
                  <span className="text-foreground">Dettes</span>, regroupées par personne avec le détail.
                </p>
              </Rule>
            </div>
          )}
          {role === "employe" && (
            <div className="sm:col-span-2">
              <Rule icon={<ClipboardList className="h-4 w-4 text-amber-400" />} title="Ventes d'employé">
                <p>
                  Vos ventes passent par <span className="text-foreground">validation</span> d'un gestionnaire
                  avant d'être appliquées (stock vérifié à la validation aussi).
                </p>
              </Rule>
            </div>
          )}
        </CardContent>
      </Card>

      {role !== "visiteur" && (
        <Card className="card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <CalculatorIcon className="h-4 w-4 text-primary" /> Le calculateur de fusion
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
          <Rule icon={<Flame className="h-4 w-4 text-emerald-400" />} title="Son utilité">
            <p>
              Vous indiquez le <span className="text-foreground">nombre de lingots souhaités</span> (fer,
              acier, ébène…) et le calculateur vous donne, pour chaque type de charbon (pauvre, classique,
              briquette, coke), le total nécessaire à la fusion. Pour chaque recette, il affiche aussi le
              détail des <span className="text-foreground">minerais</span> et du charbon par lingot.
            </p>
          </Rule>
          <Rule icon={<HandCoins className="h-4 w-4 text-amber-400" />} title="Préparer une vente">
            <p>
              Cliquez sur « <span className="text-foreground">Préparer une vente</span> » : la vente s'ouvre{" "}
              <span className="text-foreground">pré-remplie</span> avec ces quantités de charbon, que vous
              pouvez encore modifier. Le stock est vérifié comme pour toute vente.
            </p>
          </Rule>
          {(isManager || isChef) && (
            <div className="sm:col-span-2">
              <Rule icon={<Pencil className="h-4 w-4 text-primary" />} title="Recettes modifiables (chef / admin)">
                <p>
                  Le chef peut cliquer « <span className="text-foreground">Modifier les recettes</span> » pour
                  ajuster les ingrédients de chaque lingot (par exemple l'ébène : 2 coke + 2 minerai d'ébène).
                  Les changements sont <span className="text-foreground">enregistrés automatiquement</span> et
                  s'appliquent pour tout le monde.
                </p>
              </Rule>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {role === "employe" && (
        <Card className="card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <ClipboardList className="h-4 w-4 text-primary" /> Passer une commande
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Les commandes sont réservées aux <span className="text-foreground">clients</span> : vous n'avez
              pas d'accès à l'onglet Commandes. Pour acheter du charbon, faites un{" "}
              <span className="text-foreground">rachat</span> puis un{" "}
              <span className="text-foreground">dépôt</span>, ou vendez directement ce que vous possédez.
            </p>
          </CardContent>
        </Card>
      )}

      {isManager && (
        <Card className="card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Ce que vous devez valider
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Rule icon={<Trees className="h-4 w-4 text-amber-400" />} title="Dépôts & retraits d'employés">
              Onglet « À valider » : acceptez ou refusez ; le stock n'est modifié qu'après validation.
            </Rule>
            <Rule icon={<HandCoins className="h-4 w-4 text-amber-400" />} title="Ventes d'employés">
              Onglet « À valider » : le stock est débité et les dettes créées à la validation.
            </Rule>
            <Rule icon={<ClipboardList className="h-4 w-4 text-amber-400" />} title="Commandes">
              Les commandes des clients arrivent « à préparer ». À la prise en charge, répartissez chaque
              produit entre les membres qui fournissent le stock : la vente est enregistrée et une{" "}
              <span className="text-foreground">dette automatique</span> est créée pour chaque fournisseur,
              comme dans une vente. Marquez ensuite « terminée » une fois livrée. Si le client ne vient pas,
              annulez la commande avec un <span className="text-foreground">motif</span> : les stocks sont
              restitués et le motif reste enregistré sur la fiche du client.
            </Rule>
            <Rule icon={<Scale className="h-4 w-4 text-amber-400" />} title="Dettes">
              Quand vous remboursez un membre, ouvrez la dette dans « Dettes » et cliquez « Marquer réglé ».
            </Rule>
            {isChef && (
              <div className="sm:col-span-2">
                <Rule icon={<Shield className="h-4 w-4 text-primary" />} title="Réservé au chef / admin">
                  <p>
                    Vous validez aussi les <span className="text-foreground">demandes de rôle</span> (onglet
                    Membres, page filtrée par la scierie sélectionnée), l'exonération de la taxe de citoyenneté,
                    la scierie d'accès de chacun, les <span className="text-foreground">fiches clients</span>{" "}
                    (demandes + changement de lien dans la page Clients) et les paramètres (taux de taxe, prix,
                    seuils critiques, recettes du calculateur).
                  </p>
                </Rule>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Coins className="h-4 w-4 text-primary" /> La taxe hebdomadaire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Pour chaque membre : <span className="text-foreground">(ventes − rachats)</span> de la semaine dans
            sa scierie → bénéfice imposé au taux de la scierie (30 % Rivebois / 15 % Pénombris), + la taxe de
            citoyenneté et la cotisation stockage.
          </p>
          <p>
            Si une semaine est <span className="text-foreground">négative</span> (plus de rachats que de ventes),
            la perte est <span className="text-foreground">reportée</span> sur les semaines suivantes et réduit
            le bénéfice imposable jusqu'à être absorbée. Les membres « les deux scieries » déduisent leurs
            rachats partagés sur les deux. Le chef peut <span className="text-foreground">exonérer un membre</span>{" "}
            de la taxe de citoyenneté. Le paiement est validé dans la page Taxes avec un suivi par semaine.
          </p>
        </CardContent>
      </Card>

      {role === "visiteur" && (
        <Card className="card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <BookOpen className="h-4 w-4 text-primary" /> Votre accès : consultation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Vous consultez les <span className="text-foreground">stocks</span> et tout l'
              <span className="text-foreground">historique</span> (rachats, ventes, dépôts, retraits) de la
              scierie sélectionnée, en lecture seule.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="ring-1 ring-primary/40 text-primary">
                {ROLE_LABELS[role]}
              </Badge>
              Le chef peut changer votre rôle à tout moment dans la page Membres.
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Astuce : les seuils critiques de stock (charbon et bois) apparaissent en rouge sur le graphique du
        tableau de bord.
      </p>
    </div>
  );
}
