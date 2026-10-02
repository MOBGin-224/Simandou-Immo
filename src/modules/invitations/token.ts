import { createHash, randomBytes } from 'node:crypto';

/**
 * Jeton d'invitation (SEC-INV-001, SEC-INV-002, ADR-008).
 *
 * Le lien d'invitation est un SECRET DE FAIT : il permet la création d'un accès.
 * Trois propriétés, et chacune a une raison.
 *
 *   1. IMPRÉVISIBLE. 32 octets du générateur cryptographique du système, soit 256
 *      bits : le deviner n'est pas une question de patience mais de physique.
 *      Aucune horloge, aucun compteur, aucun identifiant ne participe au jeton.
 *   2. STOCKÉ HACHÉ. La base ne conserve que le SHA-256 du jeton. Une fuite de la
 *      base ne permet donc pas de rejouer une invitation en attente. Un hachage
 *      rapide suffit ici, et il est même préférable à un hachage de mot de passe :
 *      l'entropie du jeton est de 256 bits, la force brute n'a rien à gagner d'un
 *      coût ralenti, et la recherche par hachage doit rester une lecture directe.
 *   3. ENCODÉ POUR L'ADRESSE. base64url, sans `+`, `/` ni `=` : le jeton se colle
 *      dans une adresse et traverse WhatsApp ou un SMS sans être altéré.
 *
 * Conséquence assumée : le lien ne se réaffiche JAMAIS. Un lien perdu se renvoie.
 */
export const INVITATION_TOKEN_BYTES = 32;

/**
 * Forme d'un jeton bien formé : 32 octets en base64url font 43 caractères.
 *
 * Sert à écarter, AVANT toute lecture de la base, une entrée qui ne peut pas être
 * un jeton. L'effet de bord utile est de ne jamais transmettre à la base une
 * chaîne arbitraire fournie par le visiteur d'une page publique.
 */
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type GeneratedInvitationToken = {
  /** À transmettre à l'invité, une seule fois. Ne JAMAIS le stocker ni le journaliser. */
  token: string;
  /** Ce que la base conserve. */
  tokenHash: string;
};

/** Hachage d'un jeton, en hexadécimal : 64 caractères, tels que la colonne les attend. */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateInvitationToken(): GeneratedInvitationToken {
  const token = randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');

  return { token, tokenHash: hashInvitationToken(token) };
}

export function isWellFormedInvitationToken(token: string): boolean {
  return INVITATION_TOKEN_PATTERN.test(token);
}
