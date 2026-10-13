import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { getEnv } from '@/lib/env';

import PaymentDetailClient from './payment-detail-client';

export const metadata = { title: 'Détail du paiement' };

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);
  const isOwnerOrManager = roles.some((role) => role === 'OWNER' || role === 'MANAGER');

  return (
    <PaymentDetailClient
      paymentId={id}
      isOwnerOrManager={isOwnerOrManager}
      appUrl={getEnv().APP_URL}
    />
  );
}
