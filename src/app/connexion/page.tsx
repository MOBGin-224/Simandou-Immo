import { redirect } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { getCurrentUser } from '@/lib/auth';
import { safeNextPath } from '@/lib/http/next-path';

/**
 * Écran de connexion (DEC-032, ADR-006, ADR-008).
 *
 * Pourquoi cet écran est ici alors qu'aucun ticket ne le demande : le Lot 2 a
 * construit le service d'authentification, pas son interface, et sans écran de
 * connexion les écrans Immeubles de ce lot sont inatteignables par un humain. Il
 * est donc réduit au strict nécessaire, et le parcours complet, activation d'une
 * invitation comprise, appartient au lot Gestionnaires (DEC-026).
 *
 * Aucun lien d'inscription : l'entrée dans le produit se fait exclusivement par
 * invitation (ADR-008). Aucun lien « mot de passe oublié » : la réinitialisation
 * passe par un utilisateur autorisé qui régénère un lien, pas par un envoi
 * automatique, faute de fournisseur SMS au MVP (DEC-008, DEC-026).
 *
 * Formulaire HTML natif, soumis à un gestionnaire de route : il fonctionne sans
 * JavaScript, ce qui compte sur un réseau mobile où un script peut ne jamais
 * arriver.
 */
export const metadata = { title: 'Connexion' };

const MESSAGES: Record<string, string> = {
  identifiants: 'Numéro de téléphone ou mot de passe incorrect.',
  'compte-inactif': "Ce compte n'est pas actif. Demandez au propriétaire de réactiver votre accès.",
  'champs-manquants': 'Renseignez votre numéro de téléphone et votre mot de passe.',
};

export default async function SignInPage(props: PageProps<'/connexion'>) {
  const searchParams = await props.searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  /*
   * Destination après la connexion, limitée à une liste fermée (voir `safeNextPath`).
   * Elle sert un invité qui possède déjà un compte : il se connecte, puis revient à
   * son invitation (DEC-041). Toute autre valeur est ignorée, jamais suivie.
   */
  const next = safeNextPath(first(searchParams.suivant));

  // Déjà connecté : rester sur cet écran inviterait à se reconnecter sans raison.
  // La racine oriente selon le rôle (DEC-046), et elle seule : un locataire
  // n'atteint aucun immeuble.
  if (await getCurrentUser()) redirect(next ?? '/');

  const code = first(searchParams.erreur);
  const message = code ? MESSAGES[code] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <p className="font-display text-sm font-bold tracking-widest text-brand">SIMANDOU IMMO</p>
          <h1 className="font-display text-2xl font-semibold text-ink">Connexion</h1>
          <p className="text-sm text-muted">Gestion opérationnelle d&apos;immeubles locatifs.</p>
        </div>

        <Card className="flex flex-col gap-5">
          {message ? <Alert tone="danger">{message}</Alert> : null}

          {next ? (
            <Alert tone="info">
              Cette invitation est destinée à un compte existant. Connectez-vous avec ce compte pour
              l&apos;accepter.
            </Alert>
          ) : null}

          <form method="post" action="/api/v1/sessions" className="flex flex-col gap-5">
            {next ? <input type="hidden" name="suivant" value={next} /> : null}

            <Field
              id="phone"
              label="Numéro de téléphone"
              required
              hint="Au format international, par exemple +224620000001."
            >
              {(attributes) => (
                <Input
                  {...attributes}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="username"
                  required
                  autoFocus
                />
              )}
            </Field>

            <Field id="password" label="Mot de passe" required>
              {(attributes) => (
                <Input
                  {...attributes}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              )}
            </Field>

            <Button type="submit" fullWidth size="lg">
              Se connecter
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted">
          L&apos;accès se fait sur invitation. Contactez le propriétaire ou le gestionnaire de
          l&apos;immeuble.
        </p>
      </div>
    </main>
  );
}
