/**
 * Règle de formulaire du noyau Invitations.
 *
 * La confirmation du mot de passe n'existe que dans le FORMULAIRE d'activation :
 * elle ne fait pas partie du contrat de l'API, qui reçoit un mot de passe. Elle
 * vit ici parce que la page d'activation est unique et sert les deux rôles
 * invitables (DEC-046) : la laisser dans l'un des deux modules obligerait la
 * route publique à importer celui-là plutôt que l'autre, sans raison.
 *
 * Pure : ni base, ni HTTP, ni React.
 */

/**
 * Message d'erreur si le mot de passe et sa confirmation diffèrent, sinon `null`.
 *
 * Elle protège d'une faute de frappe sur un secret qu'on ne voit pas, ce qui
 * coûterait ici un compte inutilisable dès sa première connexion. Elle se
 * contrôle AVANT l'acceptation : un lien n'est pas consommé pour une faute de
 * frappe.
 */
export function passwordConfirmationError(formData: FormData): string | null {
  const password = formData.get('password');
  const confirmation = formData.get('passwordConfirmation');

  if (typeof password !== 'string' || typeof confirmation !== 'string') return null;

  return password === confirmation ? null : 'Les deux mots de passe ne sont pas identiques.';
}
