/**
 * Règles pures d'une invitation (BR-011 à BR-014, DEC-041, DEC-045).
 *
 * Ni base, ni horloge implicite, ni HTTP : chaque fonction reçoit ce dont elle a
 * besoin, y compris l'instant courant. C'est ce qui rend l'expiration testable
 * sans attendre sept jours.
 */

/** Statuts de `invitation_status`. Valeurs identiques partout (DEC-021). */
export type InvitationStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export type InvitationTiming = {
  status: InvitationStatus;
  expiresAt: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Statut RÉEL d'une invitation à un instant donné.
 *
 * `EXPIRED` est DÉRIVÉ : une invitation ouverte dont la date est passée. Aucune
 * tâche planifiée ne l'écrit, aucune n'existant au MVP (DEC-041). Se fier au
 * seul statut stocké ferait donc d'un lien périmé un lien valable tant que
 * personne n'aurait touché à sa ligne.
 *
 * L'instant d'expiration est EXCLU : à la milliseconde exacte de `expiresAt`, le
 * lien est déjà périmé. La requête qui consomme le lien applique la même borne
 * (`expires_at > now`), et les deux ne doivent jamais diverger.
 */
export function effectiveInvitationStatus(
  invitation: InvitationTiming,
  now: Date,
): InvitationStatus {
  const open = invitation.status === 'PENDING' || invitation.status === 'SENT';

  if (open && invitation.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';

  return invitation.status;
}

/** Une invitation est ouverte tant qu'elle peut encore être acceptée. */
export function isInvitationOpen(invitation: InvitationTiming, now: Date): boolean {
  const status = effectiveInvitationStatus(invitation, now);

  return status === 'PENDING' || status === 'SENT';
}

/**
 * Instant d'expiration d'une invitation émise à `issuedAt` (DEC-045).
 *
 * La durée est celle de la configuration au moment de l'émission, puis figée dans
 * la ligne : modifier la variable n'altère pas les invitations déjà émises.
 */
export function invitationExpiry(issuedAt: Date, ttlDays: number): Date {
  return new Date(issuedAt.getTime() + ttlDays * MS_PER_DAY);
}

/** Chemin public d'une invitation, sans l'adresse du site. */
export function invitationPath(token: string): string {
  return `/invitation/${token}`;
}

/**
 * Lien d'invitation complet, tel que le propriétaire le copie.
 *
 * Construit sur `APP_URL` et non sur l'adresse de la requête : derrière un proxy,
 * celle-ci n'est pas toujours l'adresse que voit l'invité.
 */
export function buildInvitationLink(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, '')}${invitationPath(token)}`;
}

/**
 * Ce que l'invité doit faire, selon l'état de son compte (parcours 5, étape 3).
 *
 * ```text
 * DEFINE_PASSWORD   il n'a pas encore de compte actif : il définit son mot de passe
 * CONFIRM           il a un compte actif et il est connecté avec : il confirme
 * SIGN_IN_REQUIRED  il a un compte actif et n'est pas connecté avec : il se connecte
 * ```
 *
 * Commun aux deux rôles invitables : l'état du compte ne dépend pas du rôle
 * (DEC-046).
 */
export type InvitationPreviewMode = 'DEFINE_PASSWORD' | 'CONFIRM' | 'SIGN_IN_REQUIRED';

/** Mode d'aperçu, déduit de l'état du compte invité et de la session présentée. */
export function invitationPreviewMode(
  target: { id: string; status: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' },
  sessionUserId: string | null,
): InvitationPreviewMode {
  if (target.status === 'PENDING_ACTIVATION') return 'DEFINE_PASSWORD';

  return sessionUserId === target.id ? 'CONFIRM' : 'SIGN_IN_REQUIRED';
}
