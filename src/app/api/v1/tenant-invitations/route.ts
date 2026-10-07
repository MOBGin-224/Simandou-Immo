import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { inviteTenant } from '@/modules/tenants';

/**
 * Invitation d'un locataire (API section 16, DEC-046).
 *
 * ```text
 * POST /api/v1/tenant-invitations
 * ```
 *
 * Le corps porte le nom, le téléphone, l'email facultatif et le `apartmentId`.
 * **Aucun champ `channel`** : DEC-026 n'offre qu'un lien de partage, que
 * l'inviteur transmet par son propre moyen. **Aucune date d'entrée ni montant de
 * loyer** : ils appartiennent au bail, au Lot 8.
 *
 * Aucun `organizationId` non plus : le logement la détermine. Le backend vérifie
 * que l'appelant peut gérer LE LOGEMENT visé, logement de son organisation, non
 * archivé, dont l'immeuble est dans son périmètre. Un logement inexistant et un
 * logement hors périmètre reçoivent le même refus (ADR-008).
 *
 * La réponse porte le LIEN d'invitation, une seule fois. La base ne conserve que
 * le hachage du jeton (SEC-INV-002), donc le lien ne peut pas être reconstitué
 * ensuite : un lien perdu se renvoie.
 *
 * Permission `tenant.invite`, propriétaire comme gestionnaire.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const issued = await inviteTenant(getDb(), context, await readJsonBody(request));

    return dataResponse({ invitation: issued.invitation, link: issued.link }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
