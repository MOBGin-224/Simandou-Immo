/**
 * Génération du PDF de quittance formelle (DEC-058, section 4).
 *
 * Isolé du service et du repository, exactement comme
 * `src/modules/payments/receipt.ts` (Lot 11) : ce module ne connaît que la
 * forme `ReceiptPdfData`, jamais un enregistrement de base de données. Il
 * peut donc être testé seul, sans PGlite ni transaction.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

export type ReceiptPdfReceivable = {
  kind: 'RENT' | 'CHARGE';
  periodStart: string;
  amountDue: number;
  amountAllocated: number;
};

export type ReceiptPdfData = {
  referenceNumber: string;
  publicReference: string;
  version: number;
  status: 'EMISE' | 'INVALIDEE';
  invalidationReason: string | null;
  period: string;
  amount: number;
  currency: string;
  tenantName: string;
  apartmentName: string;
  propertyName: string;
  organizationName: string;
  emittedAt: string;
  receivables: ReceiptPdfReceivable[];
  appUrl: string;
  generatedAt: string;
};

const PAGE_WIDTH = 595.28; // A4, en points
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const NAVY = rgb(18 / 255, 59 / 255, 74 / 255); // #123B4A, charte SIMANDOU IMMO
const BRIGHT_BLUE = rgb(59 / 255, 141 / 255, 255 / 255); // #3B8DFF, charte SIMANDOU IMMO
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.4, 0.4, 0.4);
const RED = rgb(0.7, 0.1, 0.1);
const RED_BACKGROUND = rgb(0.98, 0.92, 0.92);

const RECEIVABLE_KIND_LABELS: Record<ReceiptPdfReceivable['kind'], string> = {
  RENT: 'Loyer',
  CHARGE: 'Charge',
};

/**
 * Chemins SVG du symbole officiel, recopiés de
 * `src/components/brand/brand-mark.tsx` (fond clair), comme dans le
 * générateur du Lot 11. La boîte d'origine est `21.7 25 127.5 130.8`, dans
 * un espace de coordonnées SVG (y vers le bas).
 */
const BRAND_SYMBOL_PATHS: Array<{ d: string; color: ReturnType<typeof rgb> }> = [
  { d: 'M21.7 76.7L43.3 65.8V143.7L21.7 135.3V76.7Z', color: NAVY },
  { d: 'M45.8 45L83.8 25V155.8L58.8 143.3V71.3L45.8 65V45Z', color: NAVY },
  { d: 'M94.2 43.3L126.2 58V76.3L117.5 79.7V143.3L94.2 155.8V43.3Z', color: BRIGHT_BLUE },
  { d: 'M128.7 75.8L149.2 85V135.3L128.7 143.3V75.8Z', color: BRIGHT_BLUE },
];
const BRAND_SYMBOL_HEIGHT = 130.8;
const BRAND_SYMBOL_TARGET_HEIGHT = 32;
const BRAND_SYMBOL_SCALE = BRAND_SYMBOL_TARGET_HEIGHT / BRAND_SYMBOL_HEIGHT;

function drawBrandSymbol(page: PDFPage, x: number, topY: number): void {
  for (const { d, color } of BRAND_SYMBOL_PATHS) {
    page.drawSvgPath(d, {
      x,
      y: topY,
      scale: BRAND_SYMBOL_SCALE,
      color,
      borderWidth: 0,
    });
  }
}

/**
 * La police standard Helvetica n'encode que WinAnsi (cp1252), qui ne connaît
 * pas l'espace fine insécable (U+202F) ni l'espace insécable (U+00A0)
 * qu'`Intl` insère en français. Les remplacer par une espace normale évite
 * `WinAnsi cannot encode` à l'écriture du PDF (appris au Lot 11).
 */
function toPdfSafeText(value: string): string {
  // U+202F (espace fine insécable) et U+00A0 (espace insécable), insérées par
  // Intl en français : WinAnsi (Helvetica) ne les encode pas.
  return value.replace(/[  ]/g, ' ');
}

function formatAmount(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  return toPdfSafeText(`${formatted} ${currency}`);
}

function formatDate(iso: string): string {
  return toPdfSafeText(
    new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso)),
  );
}

function formatPeriod(periodStart: string): string {
  return toPdfSafeText(
    new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
      new Date(periodStart),
    ),
  );
}

type Cursor = { y: number };

function drawLabelValue(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  cursor: Cursor,
  label: string,
  value: string,
): void {
  page.drawText(label, { x: MARGIN, y: cursor.y, size: 9, font, color: GREY });
  page.drawText(value, { x: MARGIN + 150, y: cursor.y, size: 10, font: bold, color: BLACK });
  cursor.y -= 18;
}

/**
 * Dessine la quittance et renvoie les octets du PDF.
 *
 * Une seule page A4. Le QR code pointe vers `{appUrl}/verify/{publicReference}`
 * pour une vérification publique de la quittance.
 */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const topY = PAGE_HEIGHT - MARGIN;

  // Logo, en haut à gauche.
  drawBrandSymbol(page, MARGIN, topY);
  page.drawText('SIMANDOU', {
    x: MARGIN + 44,
    y: topY - 20,
    size: 11,
    font: bold,
    color: NAVY,
  });
  page.drawText('IMMO', {
    x: MARGIN + 44 + bold.widthOfTextAtSize('SIMANDOU ', 11),
    y: topY - 20,
    size: 11,
    font: bold,
    color: BRIGHT_BLUE,
  });

  // QR code de vérification publique, en haut à droite.
  const verificationUrl = `${data.appUrl}/verify/${data.publicReference}`;
  const qrPngDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 0, width: 256 });
  const qrPngBase64 = qrPngDataUrl.slice(qrPngDataUrl.indexOf(',') + 1);
  const qrImage = await pdf.embedPng(Buffer.from(qrPngBase64, 'base64'));
  const qrSize = 72;
  page.drawImage(qrImage, {
    x: PAGE_WIDTH - MARGIN - qrSize,
    y: topY - qrSize,
    width: qrSize,
    height: qrSize,
  });

  const title = data.status === 'INVALIDEE' ? 'QUITTANCE DE LOYER INVALIDÉE' : 'QUITTANCE DE LOYER';
  const cursor: Cursor = { y: topY - 56 };
  page.drawText(title, { x: MARGIN, y: cursor.y, size: 16, font: bold, color: NAVY });
  cursor.y -= 22;
  page.drawText(`N° ${data.referenceNumber} · version ${data.version}`, {
    x: MARGIN,
    y: cursor.y,
    size: 10,
    font,
    color: GREY,
  });
  cursor.y -= 20;

  if (data.status === 'INVALIDEE') {
    const bandHeight = 28;
    page.drawRectangle({
      x: MARGIN,
      y: cursor.y - bandHeight + 10,
      width: PAGE_WIDTH - 2 * MARGIN,
      height: bandHeight,
      color: RED_BACKGROUND,
    });
    page.drawText(
      `Invalidée : ${toPdfSafeText(data.invalidationReason ?? 'motif non renseigne')}`,
      {
        x: MARGIN + 10,
        y: cursor.y - bandHeight + 20,
        size: 9,
        font: bold,
        color: RED,
      },
    );
    cursor.y -= bandHeight + 12;
  } else {
    cursor.y -= 8;
  }

  drawLabelValue(page, font, bold, cursor, 'Locataire', data.tenantName);
  drawLabelValue(page, font, bold, cursor, 'Appartement', data.apartmentName);
  drawLabelValue(page, font, bold, cursor, 'Immeuble', data.propertyName);
  drawLabelValue(page, font, bold, cursor, 'Organisation', data.organizationName);
  cursor.y -= 10;

  drawLabelValue(page, font, bold, cursor, 'Période couverte', toPdfSafeText(data.period));
  drawLabelValue(
    page,
    font,
    bold,
    cursor,
    'Total attesté',
    formatAmount(data.amount, data.currency),
  );
  drawLabelValue(page, font, bold, cursor, "Date d'émission", formatDate(data.emittedAt));
  cursor.y -= 10;

  page.drawText('Détail des créances', {
    x: MARGIN,
    y: cursor.y,
    size: 11,
    font: bold,
    color: NAVY,
  });
  cursor.y -= 20;
  page.drawText('Nature', { x: MARGIN, y: cursor.y, size: 9, font: bold, color: GREY });
  page.drawText('Période', { x: MARGIN + 110, y: cursor.y, size: 9, font: bold, color: GREY });
  page.drawText('Montant dû', { x: MARGIN + 220, y: cursor.y, size: 9, font: bold, color: GREY });
  page.drawText('Montant alloué', {
    x: MARGIN + 340,
    y: cursor.y,
    size: 9,
    font: bold,
    color: GREY,
  });
  cursor.y -= 16;

  for (const receivable of data.receivables) {
    page.drawText(RECEIVABLE_KIND_LABELS[receivable.kind], {
      x: MARGIN,
      y: cursor.y,
      size: 10,
      font,
      color: BLACK,
    });
    page.drawText(formatPeriod(receivable.periodStart), {
      x: MARGIN + 110,
      y: cursor.y,
      size: 9,
      font,
      color: BLACK,
    });
    page.drawText(formatAmount(receivable.amountDue, data.currency), {
      x: MARGIN + 220,
      y: cursor.y,
      size: 9,
      font,
      color: BLACK,
    });
    page.drawText(formatAmount(receivable.amountAllocated, data.currency), {
      x: MARGIN + 340,
      y: cursor.y,
      size: 9,
      font,
      color: BLACK,
    });
    cursor.y -= 16;
  }

  const legalY = MARGIN + 54;
  page.drawText('Cette quittance atteste le règlement complet de la période indiquée.', {
    x: MARGIN,
    y: legalY + 12,
    size: 8,
    font,
    color: GREY,
  });
  page.drawText('Elle ne remplace pas une quittance fiscale.', {
    x: MARGIN,
    y: legalY,
    size: 8,
    font,
    color: GREY,
  });

  page.drawText(`Généré le ${formatDate(data.generatedAt)}`, {
    x: MARGIN,
    y: MARGIN + 24,
    size: 8,
    font,
    color: GREY,
  });
  page.drawText('SIMANDOU IMMO', {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    font,
    color: GREY,
  });

  return pdf.save();
}
