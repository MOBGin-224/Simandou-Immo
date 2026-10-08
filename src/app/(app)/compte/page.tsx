import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { describeRoles } from '@/lib/ui/labels';
import { TENANT_HOME } from '@/lib/ui/home';

/**
 * Compte, dernière entrée de la navigation principale (Component Specification
 * section 58, Information Architecture 7.3).
 *
 * **Pourquoi cet écran existe.** La navigation basse de la charte veut une
 * entrée de compte, et la déconnexion devait quitter l'en-tête : à 360 px,
 * « SIMANDOU IMMO » et « Se déconnecter » ne tenaient pas sur une ligne avec le
 * symbole de la marque, mesuré à un pixel près à 390 px. L'en-tête rendait donc
 * le logotype invisible sur téléphone. En reprenant la déconnexion ici, il
 * retrouve la place de porter la marque partout.
 *
 * **Ce que l'écran montre : le point de vue, et rien de personnel.** Le rôle,
 * parce que c'est lui qui commande ce que l'on voit, et non le nom de la
 * personne : une capture d'écran qui circule ne divulgue alors aucune identité,
 * et c'est la même règle que dans l'en-tête. Ni l'organisation n'est nommée, pour
 * la même raison.
 *
 * **Ce qu'il ne propose pas, et le dit.** Le téléphone et l'adresse email ne sont
 * modifiables par personne au MVP : les changer exigerait une vérification
 * qu'aucun canal ne permet (SEC-049, SEC-050, DEC-048). Un locataire peut
 * corriger son nom, et lui seul, le nom vivant dans `users` et appartenant donc
 * à la personne. Annoncer cette limite vaut mieux que laisser chercher un bouton
 * absent.
 */
export const metadata = { title: 'Mon compte' };

export default async function AccountPage() {
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);

  /*
   * Un locataire corrige SON nom (DEC-048). Le lien n'apparaît donc que pour
   * lui : un propriétaire n'a pas de nom de locataire à corriger, et l'écran
   * `/mon-logement/nom` n'existe pas pour qui n'est pas locataire.
   */
  const isTenant = roles.includes('TENANT');

  /** Un cumul autorisé par DEC-003 : le texte doit s'accorder au pluriel. */
  const hasSeveralRoles = new Set(roles).size > 1;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Mon compte" description="Votre accès à SIMANDOU IMMO" />

      <Card className="flex flex-col gap-4">
        <Overline>Votre accès</Overline>

        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <Overline as="dt">Vous êtes connecté en tant que</Overline>
            <dd className="text-base text-ink">{describeRoles(roles)}</dd>
          </div>
        </dl>

        {/*
          L'énumération COMPLÈTE est ici, alors que l'en-tête ne montre que le
          rôle qui gouverne : c'est l'écran qui a la place de le faire, et un
          cumul (DEC-003) ne se lit nulle part ailleurs.

          Le pluriel suit le nombre de rôles. « C'est ce rôle qui détermine »
          devant « Locataire et gestionnaire » se lirait comme une faute.
        */}
        <p className="text-sm text-muted">
          {hasSeveralRoles
            ? "Ce sont ces rôles qui déterminent ce que vous voyez dans l'application."
            : "C'est ce rôle qui détermine ce que vous voyez dans l'application."}
        </p>
      </Card>

      {isTenant ? (
        <Card className="flex flex-col gap-4">
          <Overline>Mes informations</Overline>

          <p className="text-sm text-muted">
            Vous pouvez corriger votre nom. Votre numéro de téléphone sert à vous connecter, et ni
            lui ni votre adresse email ne sont modifiables pour le moment : les changer demanderait
            une vérification que le produit ne sait pas encore mener.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/mon-logement/nom" className={buttonClasses('secondary', 'md', true)}>
              Modifier mon nom
            </Link>
            <Link href={TENANT_HOME} className={buttonClasses('secondary', 'md', true)}>
              Mon logement
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <Overline>Mes informations</Overline>
          <p className="text-sm text-muted">
            Votre nom, votre numéro de téléphone et votre adresse email ne sont pas modifiables
            depuis l&apos;application : les changer demanderait une vérification que le produit ne
            sait pas encore mener. Adressez-vous à la personne qui vous a ouvert cet accès.
          </p>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <Overline>Quitter l&apos;application</Overline>

        <p className="text-sm text-muted">
          Vous devrez saisir à nouveau votre numéro et votre mot de passe pour revenir.
        </p>

        {/*
          Déconnexion par FORMULAIRE, et non par lien : une déconnexion modifie
          l'état du serveur, ce qu'un GET ne doit jamais faire. Un lien serait en
          outre déclenché par un préchargement de navigateur, c'est-à-dire par
          une simple visite de cette page.
        */}
        <form method="post" action="/api/v1/sessions/revoke">
          <button type="submit" className={buttonClasses('destructive', 'md', true)}>
            Se déconnecter
          </button>
        </form>
      </Card>
    </div>
  );
}
