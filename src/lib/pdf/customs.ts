import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface CustomsAddress {
  /** Sender name — only present on the `from` address. */
  name?: string;
  line1: string;
  city: string;
  postcode: string;
  country: string;
  /** Optional contact phone — printed under the address when present. */
  phone?: string | null;
}

export interface CustomsItem {
  name: string;
  quantity: number;
  valueCents: number;
  hsCode: string | null;
  countryOfOrigin: string | null;
  weightGrams: number;
}

export interface CustomsInput {
  returnNumber: string;
  orderNumber: string;
  fromAddress: CustomsAddress & { name: string };
  toAddress: CustomsAddress;
  items: CustomsItem[];
  /** YNOT trader identifiers — printed in the recipient block when set. */
  eori?: string | null;
  vat?: string | null;
  /** ISO currency code for the total line. Defaults to GBP. */
  currency?: string;
}

/**
 * Render a CN23-style customs declaration PDF for an international return.
 *
 * Output is a Buffer containing a single A4 page with sender + recipient
 * addresses, the return + original order references, and a per-item table
 * (description, qty, HS code, origin, value, weight).
 *
 * Used by Group K's `buildAndStoreCustomsDeclaration` (returns flow). Spec §7.3.
 */
export async function buildCustomsDeclaration(input: CustomsInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 in points
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const currency = input.currency ?? 'GBP';

  const draw = (
    s: string,
    x: number,
    y: number,
    fnt: typeof font = font,
    size = 10,
  ): void => {
    page.drawText(s, { x, y, font: fnt, size, color: rgb(0, 0, 0) });
  };

  draw('CN23 — CUSTOMS DECLARATION', 40, 800, bold, 14);
  draw(
    `Return: ${input.returnNumber}    Original order: ${input.orderNumber}`,
    40,
    780,
  );

  // Sender block — top-left.
  let fromY = 750;
  draw('From (sender):', 40, fromY, bold);
  fromY -= 15;
  draw(input.fromAddress.name, 40, fromY);
  fromY -= 15;
  draw(input.fromAddress.line1, 40, fromY);
  fromY -= 15;
  draw(`${input.fromAddress.city} ${input.fromAddress.postcode}`, 40, fromY);
  fromY -= 15;
  draw(input.fromAddress.country, 40, fromY);
  if (input.fromAddress.phone) {
    fromY -= 15;
    draw(`Tel: ${input.fromAddress.phone}`, 40, fromY);
  }

  // Recipient block — top-right.
  let toY = 750;
  draw('To (recipient):', 320, toY, bold);
  toY -= 15;
  draw('YNOT London (Returns)', 320, toY);
  toY -= 15;
  draw(input.toAddress.line1, 320, toY);
  toY -= 15;
  draw(`${input.toAddress.city} ${input.toAddress.postcode}`, 320, toY);
  toY -= 15;
  draw(input.toAddress.country, 320, toY);
  if (input.toAddress.phone) {
    toY -= 15;
    draw(`Tel: ${input.toAddress.phone}`, 320, toY);
  }
  if (input.eori) {
    toY -= 15;
    draw(`EORI: ${input.eori}`, 320, toY);
  }
  if (input.vat) {
    toY -= 15;
    draw(`VAT: ${input.vat}`, 320, toY);
  }

  // Reason line — placed below whichever block is taller so it never collides.
  const blocksBottom = Math.min(fromY, toY) - 20;
  draw(
    'Reason: RETURNED MERCHANDISE — ORIGINAL SALE INVOICE ATTACHED',
    40,
    blocksBottom,
    bold,
  );

  // Table header.
  let y = blocksBottom - 40;
  draw('Description', 40, y, bold);
  draw('Qty', 280, y, bold);
  draw('HS code', 320, y, bold);
  draw('Origin', 400, y, bold);
  draw(`Value (${currency})`, 460, y, bold);
  draw('Weight (g)', 540, y, bold);
  y -= 16;

  let totalCents = 0;
  let totalWeight = 0;
  for (const it of input.items) {
    draw(it.name.slice(0, 40), 40, y);
    draw(String(it.quantity), 280, y);
    draw(it.hsCode ?? '—', 320, y);
    draw(it.countryOfOrigin ?? '—', 400, y);
    draw((it.valueCents / 100).toFixed(2), 460, y);
    draw(String(it.weightGrams), 540, y);
    totalCents += it.valueCents * it.quantity;
    totalWeight += it.weightGrams * it.quantity;
    y -= 14;
  }

  // Totals row.
  y -= 6;
  draw('Total declared value:', 40, y, bold);
  draw(`${(totalCents / 100).toFixed(2)} ${currency}`, 460, y, bold);
  draw(`${totalWeight} g`, 540, y, bold);

  // Signature + date block — anchored at the page foot so wider tables don't
  // collide with it. Sender signs to attest the declaration is truthful;
  // customs officers expect a manual signature on a printed CN23.
  draw('Sender declaration:', 40, 130, bold);
  draw(
    'I certify that the particulars above are correct and that this parcel',
    40,
    115,
  );
  draw('contains returned merchandise — no commercial value.', 40, 100);
  draw('Signature: ____________________', 40, 75);
  draw(`Date: ${new Date().toISOString().slice(0, 10)}`, 320, 75);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
