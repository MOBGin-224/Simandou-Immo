import DisputePaymentClient from './dispute-payment-client';

export default async function DisputePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <DisputePaymentClient paymentId={id} />;
}
