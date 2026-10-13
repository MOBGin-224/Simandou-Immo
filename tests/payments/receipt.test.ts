import { describe, expect, it } from 'vitest';
import { generateReceiptPdf, type ReceiptData } from '../../src/modules/payments/receipt';

const BASE_RECEIPT: ReceiptData = {
  referenceNumber: 'PAY-2026-000123',
  publicReference: 'rcpt_abc123',
  version: 1,
  status: 'CONFIRMED',
  amount: 850_000,
  currency: 'GNF',
  method: 'MOBILE_MONEY',
  reference: 'MM-998877',
  paidAt: '2026-10-05T09:00:00.000Z',
  declaredAt: '2026-10-05T09:05:00.000Z',
  declaredBy: 'Mariam Camara',
  validatedAt: '2026-10-05T10:00:00.000Z',
  validatedBy: 'Ibrahima Soumah',
  tenantName: 'Fatoumata Diallo',
  apartmentName: 'Appartement B2',
  propertyName: 'Résidence Kipe Nord',
  organizationName: 'Simandou Gestion',
  allocations: [
    { kind: 'RENT', amount: 750_000, receivableId: 'rent-period-2026-10' },
    { kind: 'CHARGE', amount: 100_000, receivableId: 'charge-2026-10-eau' },
  ],
  appUrl: 'https://app.simandou-immo.gn',
  generatedAt: '2026-10-13T01:00:00.000Z',
};

describe('generateReceiptPdf', () => {
  it('génère un PDF non vide dont les octets commencent par la signature %PDF', async () => {
    const pdf = await generateReceiptPdf(BASE_RECEIPT);

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(0);
    expect(Array.from(pdf.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('génère un PDF sans erreur pour un paiement annulé', async () => {
    const cancelled: ReceiptData = {
      ...BASE_RECEIPT,
      status: 'CANCELLED',
      validatedAt: null,
      validatedBy: null,
    };

    const pdf = await generateReceiptPdf(cancelled);

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(0);
    expect(Array.from(pdf.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});
