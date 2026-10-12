import { requireAccessContextOrSignIn } from '@/lib/auth/guard';

import CancelPaymentClient from './cancel-payment-client';

export default async function CancelPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);
  const isTenantOnly = roles.length > 0 && roles.every((role) => role === 'TENANT');

  return <CancelPaymentClient paymentId={id} isTenantOnly={isTenantOnly} />;
}
