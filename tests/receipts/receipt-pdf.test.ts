import { describe, expect, it } from 'vitest';
import { generateReceiptPdf, type ReceiptPdfData } from '../../src/modules/receipts/receipt-pdf';

const BASE_RECEIPT: ReceiptPdfData = {
  referenceNumber: 'CAM-2026-10-0001',
  publicReference: 'Q-TEST000001',
  version: 1,
  status: 'EMISE',
  invalidationReason: null,
  period: 'octobre 2026',
  amount: 2_500_000,
  currency: 'GNF',
  tenantName: 'Fatoumata Diallo',
  apartmentName: 'Appartement B2',
  propertyName: 'Résidence Kipe Nord',
  organizationName: 'Simandou Gestion',
  emittedAt: '2026-11-06T09:00:00.000Z',
  receivables: [
    { kind: 'RENT', periodStart: '2026-10-01', amountDue: 2_500_000, amountAllocated: 2_500_000 },
  ],
  appUrl: 'https://app.simandou-immo.gn',
  generatedAt: '2026-11-06T09:05:00.000Z',
};

describe('generateReceiptPdf (quittances, DEC-058)', () => {
  it('génère un PDF non vide dont les octets commencent par la signature %PDF (ÉMISE)', async () => {
    const pdf = await generateReceiptPdf(BASE_RECEIPT);

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(0);
    expect(Array.from(pdf.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('génère un PDF non vide avec le motif, pour une quittance INVALIDEE', async () => {
    const invalidated: ReceiptPdfData = {
      ...BASE_RECEIPT,
      status: 'INVALIDEE',
      invalidationReason: 'Paiement annulé',
    };

    const pdf = await generateReceiptPdf(invalidated);

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(0);
    expect(Array.from(pdf.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('reste sous 400 Ko', async () => {
    const pdf = await generateReceiptPdf(BASE_RECEIPT);

    expect(pdf.length).toBeLessThan(400 * 1024);
  });
});
