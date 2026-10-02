import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { getDb } from '@/db/client';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/ui/format';
import { invitationPath } from '@/modules/invitations';
import { InvitationInvalidError, previewInvitation } from '@/modules/managers';

/**
 * Activation d'un compte gestionnaire (parcours 5, MVP-BACKLOG-025).
 *
 * Page PUBLIQUE : le jeton de l'adresse est la seule preuve. Elle affiche ce que le
 * parcours 5 promet, l'organisation, l'invitant, les immeubles et le rôle, puis
 * propose ce que l'invité doit faire selon l'état de son compte :
 *
 * ```text
 * DEFINE_PASSWORD   pas de compte actif : il choisit son mot de passe
 * CONFIRM           compte actif, connecté avec : il confirme
 * SIGN_IN_REQUIRED  compte actif, pas connecté avec : il se connecte
 * ```
 *
 * Consulter la page ne consomme PAS l'invitation : un aperçu chargé par un
 * navigateur ou un lecteur de liens ne doit pas la brûler.
 *
 * Un lien inutilisable, quelle qu'en soit la cause, affiche la même page
 * « introuvable » : elle ne dit pas s'il a expiré, été révoqué ou déjà servi
 * (ADR-008).
 *
 * Le formulaire est un formulaire HTML natif soumis à une route : il fonctionne sans
 * JavaScript, ce qui compte sur un réseau mobile où un script peut ne jamais
 * arriver. La route ouvre la session de l'invité et le conduit à son environnement
 * (parcours 5, étape 6).
 *
 * `referrer: no-referrer` : l'adresse contient le secret, elle ne doit jamais
 * partir dans l'en-tête d'une requête vers un autre site.
 */
export const metadata = { title: 'Invitation', referrer: 'no-referrer' as const };

const MESSAGES: Record<string, string> = {
  'mot-de-passe': `Le mot de passe doit faire entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères.`,
  confirmation: 'Les deux mots de passe ne sont pas identiques.',
  connexion: "Connectez-vous avec le compte invité pour accepter l'invitation.",
};

export default async function InvitationPage(props: PageProps<'/invitation/[token]'>) {
  const { token } = await props.params;
  const searchParams = await props.searchParams;
  const code = Array.isArray(searchParams.erreur) ? searchParams.erreur[0] : searchParams.erreur;
  const message = code ? MESSAGES[code] : undefined;

  const user = await getCurrentUser();

  let preview;

  try {
    preview = await previewInvitation(getDb(), { token, sessionUserId: user?.id ?? null });
  } catch (error) {
    if (error instanceof InvitationInvalidError) notFound();

    throw error;
  }

  const here = invitationPath(token);
  const acceptAction = `/api/v1/invitations/${token}/accept`;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <p className="font-display text-sm font-bold tracking-widest text-brand">SIMANDOU IMMO</p>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {preview.inviteeName}, vous êtes invité
          </h1>
          <p className="text-sm text-muted">
            {preview.inviterName || 'Le propriétaire'} vous confie la gestion de{' '}
            {preview.propertyNames.length > 1 ? 'ces immeubles' : 'cet immeuble'}.
          </p>
        </div>

        <Card className="flex flex-col gap-4">
          <dl className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Organisation
              </dt>
              <dd className="break-words text-base text-ink">{preview.organizationName}</dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Rôle</dt>
              <dd className="text-base text-ink">Gestionnaire</dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {preview.propertyNames.length > 1 ? 'Immeubles confiés' : 'Immeuble confié'}
              </dt>
              <dd>
                <ul className="flex flex-col gap-0.5 text-base text-ink">
                  {preview.propertyNames.map((name) => (
                    <li key={name} className="break-words">
                      {name}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>

            {preview.phone ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Votre identifiant de connexion
                </dt>
                <dd className="text-base text-ink">{preview.phone}</dd>
              </div>
            ) : null}
          </dl>

          <p className="text-xs text-muted">
            Ce lien ne peut servir qu&apos;une fois et expire le{' '}
            {formatDate(preview.expiresAt.toISOString())}.
          </p>
        </Card>

        {message ? <Alert tone="danger">{message}</Alert> : null}

        {preview.mode === 'DEFINE_PASSWORD' ? (
          <Card className="flex flex-col gap-5">
            <form method="post" action={acceptAction} className="flex flex-col gap-5">
              <Field
                id="password"
                label="Choisissez votre mot de passe"
                required
                hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères. Vous vous connecterez avec votre numéro et ce mot de passe.`}
              >
                {(attributes) => (
                  <Input
                    {...attributes}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    maxLength={MAX_PASSWORD_LENGTH}
                  />
                )}
              </Field>

              <Field id="passwordConfirmation" label="Confirmez votre mot de passe" required>
                {(attributes) => (
                  <Input
                    {...attributes}
                    name="passwordConfirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    maxLength={MAX_PASSWORD_LENGTH}
                  />
                )}
              </Field>

              <Button type="submit" fullWidth size="lg">
                Activer mon compte
              </Button>
            </form>
          </Card>
        ) : null}

        {preview.mode === 'CONFIRM' ? (
          <Card className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Vous êtes connecté avec le compte invité. Il suffit de confirmer : votre mot de passe
              ne change pas.
            </p>

            <form method="post" action={acceptAction}>
              <Button type="submit" fullWidth size="lg">
                Accepter l&apos;invitation
              </Button>
            </form>
          </Card>
        ) : null}

        {preview.mode === 'SIGN_IN_REQUIRED' ? (
          <Card className="flex flex-col gap-4">
            {preview.signedInAsOther ? (
              <>
                <Alert tone="warning">
                  Vous êtes connecté avec un autre compte que celui de cette invitation.
                </Alert>

                <p className="text-sm text-muted">
                  Déconnectez-vous, puis connectez-vous avec le numéro {preview.phone ?? 'invité'}{' '}
                  pour accepter.
                </p>

                {/* Déconnexion par formulaire et non par lien : elle modifie l'état du serveur. */}
                <form method="post" action="/api/v1/sessions/revoke">
                  <input type="hidden" name="suivant" value={here} />
                  <Button type="submit" variant="secondary" fullWidth size="lg">
                    Se déconnecter
                  </Button>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Ce numéro a déjà un compte. Connectez-vous avec lui pour accepter
                  l&apos;invitation : votre mot de passe ne change pas.
                </p>

                <Link
                  href={`/connexion?suivant=${encodeURIComponent(here)}`}
                  className={buttonClasses('primary', 'lg', true)}
                >
                  Se connecter pour accepter
                </Link>
              </>
            )}
          </Card>
        ) : null}
      </div>
    </main>
  );
}
