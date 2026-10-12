import ValidatePaymentClient from './validate-payment-client';

export default async function ValidatePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <ValidatePaymentClient paymentId={id} />;
}
