'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/field';
import { formatDate } from '@/lib/ui/format';

/**
 * Lien d'invitation, à copier (DEC-026, parcours 4 étape 7).
 *
 * Aucun envoi n'a lieu au MVP : le propriétaire copie ce lien et le transmet
 * lui-même, par WhatsApp, SMS ou en personne.
 *
 * **Le lien n'est affiché qu'UNE fois.** La base ne conserve que le hachage du
 * jeton (SEC-INV-002), donc rien ne permet de le reconstituer ensuite : le dire en
 * toutes lettres évite qu'un propriétaire referme la page sans l'avoir copié, puis
 * cherche un lien qui n'existe plus. Un lien perdu se renvoie.
 *
 * Composant client, et c'est justifié (MVP-ENG-014) : l'accès au presse-papiers
 * n'existe que dans le navigateur. Sans JavaScript, le lien reste affiché dans un
 * champ en lecture seule que l'on peut sélectionner et copier à la main.
 */
export type InvitationLinkPanelProps = {
  link: string;
  /** Date d'expiration, en ISO 8601. */
  expiresAt: string;
  name: string;
  phone: string | null;
  doneHref: string;
  doneLabel: string;
};

type CopyState = 'idle' | 'copied' | 'failed';

export function InvitationLinkPanel({
  link,
  expiresAt,
  name,
  phone,
  doneHref,
  doneLabel,
}: InvitationLinkPanelProps) {
  const [copy, setCopy] = useState<CopyState>('idle');

  async function copyLink() {
    // Sélectionner d'abord : si le presse-papiers est refusé, l'utilisateur n'a plus
    // qu'à copier lui-même, la sélection étant déjà faite.
    (document.getElementById('invitation-link') as HTMLTextAreaElement | null)?.select();

    try {
      await navigator.clipboard.writeText(link);
      setCopy('copied');
    } catch {
      try {
        setCopy(document.execCommand('copy') ? 'copied' : 'failed');
      } catch {
        setCopy('failed');
      }
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Alert tone="success" title="Invitation créée">
        {name}
        {phone ? ` (${phone})` : ''} peut maintenant activer son compte avec le lien ci-dessous.
      </Alert>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invitation-link" className="text-sm font-medium text-ink">
            Lien d&apos;invitation
          </label>
          {/*
            Champ MULTILIGNE et non une ligne : un lien de 70 caractères ne tient pas
            dans les 290 pixels d'un téléphone, et un champ d'une ligne en cacherait
            la fin. Ici il se replie et se lit en entier, ce qui permet aussi de le
            vérifier avant de le transmettre. `break-all` car une adresse n'a pas
            d'espace où se couper.
          */}
          <Textarea
            id="invitation-link"
            value={link}
            readOnly
            rows={3}
            onFocus={(event) => event.currentTarget.select()}
            className="resize-none font-mono text-sm break-all"
            aria-describedby="invitation-link-help"
          />
        </div>

        <Button type="button" size="lg" fullWidth onClick={copyLink}>
          Copier le lien
        </Button>

        {/* Annoncé par les lecteurs d'écran sans déplacer le focus. */}
        <p role="status" aria-live="polite" className="min-h-5 text-sm">
          {copy === 'copied' ? (
            <span className="text-success">Lien copié.</span>
          ) : copy === 'failed' ? (
            <span className="text-danger">
              Copie impossible ici. Appuyez longuement sur le lien, puis choisissez « Copier ».
            </span>
          ) : null}
        </p>

        <ul id="invitation-link-help" className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            <span className="font-medium text-ink">Ce lien ne sera plus affiché.</span> Copiez-le
            maintenant. S&apos;il est perdu, vous pourrez en générer un nouveau.
          </li>
          <li>Transmettez-le vous-même : par WhatsApp, par SMS ou en personne.</li>
          <li>
            Il ne peut servir qu&apos;une fois, et expire le{' '}
            <span className="font-medium text-ink">{formatDate(expiresAt)}</span>.
          </li>
        </ul>
      </Card>

      <Link href={doneHref} className={buttonClasses('secondary', 'md', true)}>
        {doneLabel}
      </Link>
    </div>
  );
}
