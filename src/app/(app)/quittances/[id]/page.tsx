import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { getEnv } from '@/lib/env';

import ReceiptDetailClient from './receipt-detail-client';

export const metadata = { title: 'Détail de la quittance' };

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAccessContextOrSignIn();

  return <ReceiptDetailClient receiptId={id} appUrl={getEnv().APP_URL} />;
}
