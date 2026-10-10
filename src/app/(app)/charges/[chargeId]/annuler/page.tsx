import { notFound } from 'next/navigation';

import { ConfirmChargeActionForm } from '@/components/charge/confirm-charge-action-form';
import { Alert } from '@/components/ui/alert';
import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { formatMonth, pluralize } from '@/lib/ui/format';
import { describeCharge, isCancellable } from '@/modules/charges';

import { cancelChargeAction } from '../../actions';
import { loadChargePage } from '../../data';

/**
 * Confirmation d'annulation d'une charge (BR-054, API section 29).
 *
 * **Un seul écran pour deux situations**, et c'est voulu : annuler un BROUILLON
 * est la façon de corriger une erreur de saisie, aucune modification n'existant
 * dans ce lot (BR-053) ; annuler une charge PUBLIÉE éteint ses créances. Le
 * texte dit laquelle des deux s'applique, parce que les conséquences ne sont pas
 * les mêmes.
 *
 * Ce que l'écran promet est exactement ce que le domaine fait : rien n'est
 * supprimé. La charge, ses parts et les paiements déjà reçus restent
 * consultables, et c'est ce que BR-054 exige de conserver.
 *
 * Une charge déjà annulée mène à « introuvable » : l'écran n'a plus d'objet.
 */
export async function generateMetadata(props: PageProps<'/charges/[chargeId]/annuler'>) {
  const { chargeId } = await props.params;
  const charge = await loadChargePage(chargeId);

  return { title: `Annuler ${describeCharge(charge, formatMonth)}` };
}

export default async function CancelChargePage(props: PageProps<'/charges/[chargeId]/annuler'>) {
  const { chargeId } = await props.params;
  const charge = await loadChargePage(chargeId);

  if (!isCancellable(charge)) notFound();

  const published = charge.status === 'PUBLISHED';

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Annuler cette charge ?"
        description={describeCharge(charge, formatMonth)}
        back={{ href: `/charges/${charge.id}`, label: 'La charge' }}
      />

      <Card className="flex flex-col gap-1">
        <Overline as="h2">Montant de la facture</Overline>
        <Amount amount={charge.totalAmount} currency={charge.currency} scale="key" />
        <p className="text-xs text-muted">
          {published
            ? `Répartie entre ${pluralize(charge.unitCount, 'logement')}.`
            : "Cette charge est en brouillon : elle n'a créé aucune créance."}
        </p>
      </Card>

      {published ? (
        <Alert tone="warning" title="Les parts ne seront plus dues">
          {charge.unitCount === 1
            ? '1 créance passera en « annulé » et sortira du total dû de son locataire'
            : `${charge.unitCount} créances passeront en « annulé » et sortiront du total dû des locataires`}
          . Rien n&apos;est supprimé : la facture, ses parts et les paiements déjà reçus restent
          consultables.
        </Alert>
      ) : (
        <Alert tone="info" title="Corriger une charge">
          Une charge ne se modifie pas : l&apos;annuler puis en créer une autre laisse les deux dans
          l&apos;historique, là où une réécriture ferait disparaître l&apos;erreur sans trace.
        </Alert>
      )}

      <ConfirmChargeActionForm
        action={cancelChargeAction}
        chargeId={charge.id}
        cancelHref={`/charges/${charge.id}`}
        submitLabel="Annuler la charge"
        pendingLabel="Annulation..."
        variant="destructive"
      />
    </div>
  );
}
