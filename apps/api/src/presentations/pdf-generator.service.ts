import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { PresentationSafePropertySnapshot } from '@real-estate/types';

type PdfDoc = InstanceType<typeof PDFDocument>;

export interface PresentationPdfItemInput {
  snapshot: PresentationSafePropertySnapshot;
  agentNote: string | null;
  /** Raw image bytes for the property's primary image — null when it has none, or the stored file couldn't be read/decoded. */
  imageBuffer: Buffer | null;
}

export interface PresentationPdfInput {
  title: string;
  brandingName: string;
  clientName: string | null;
  generatedAt: Date;
  items: PresentationPdfItemInput[];
}

const PAGE_MARGIN = 50;

/**
 * Server-side PDF generation via `pdfkit` — chosen over a headless
 * browser (Puppeteer/Playwright) because this codebase has no existing
 * PDF dependency and no other reason to carry a full Chromium binary;
 * `pdfkit` is pure Node, ships Helvetica built in (no font files to
 * bundle), and its imperative drawing API produces the same output
 * every time for the same input — deterministic, easy to unit test, no
 * headless-browser process to manage in production. See docs/API.md
 * "PDF generation library choice."
 *
 * Deliberately built from `PresentationSafePropertySnapshot` +
 * caller-resolved image bytes only — this function has no way to reach
 * owner/commission/private-notes data or exact coordinates, because its
 * input type carries none of them (see property.mapper.ts).
 */
@Injectable()
export class PdfGeneratorService {
  generate(input: PresentationPdfInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // `compress: false` — content streams stay plain text instead of
      // deflate-compressed, at a small file-size cost. This is what
      // lets an e2e test assert directly against the generated PDF's
      // raw bytes that a sensitive string (owner phone, commission
      // notes, exact coordinates) never appears anywhere in the
      // artifact actually sent to the client, not just in the DTO that
      // fed it. See test/presentation-security.e2e-spec.ts.
      const doc = new PDFDocument({
        margin: PAGE_MARGIN,
        size: 'A4',
        compress: false,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderCoverPage(doc, input);
      for (const item of input.items) {
        doc.addPage();
        this.renderPropertyPage(doc, item);
      }

      doc.end();
    });
  }

  private renderCoverPage(doc: PdfDoc, input: PresentationPdfInput): void {
    doc
      .fontSize(12)
      .fillColor('#666666')
      .text(input.brandingName.toUpperCase(), { align: 'center' });
    doc.moveDown(4);
    doc
      .fontSize(26)
      .fillColor('#111111')
      .text(input.title, { align: 'center' });
    doc.moveDown(1);
    if (input.clientName) {
      doc
        .fontSize(14)
        .fillColor('#333333')
        .text(`Prepared for ${input.clientName}`, { align: 'center' });
    }
    doc.moveDown(1);
    doc
      .fontSize(11)
      .fillColor('#888888')
      .text(
        input.generatedAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        { align: 'center' },
      );
    doc.moveDown(2);
    const count = input.items.length;
    doc
      .fontSize(11)
      .fillColor('#888888')
      .text(`${count} propert${count === 1 ? 'y' : 'ies'}`, {
        align: 'center',
      });
  }

  private renderPropertyPage(
    doc: PdfDoc,
    item: PresentationPdfItemInput,
  ): void {
    const { snapshot } = item;

    // A missing, unsupported, or corrupt image must never break the
    // whole presentation — skip it and keep every text section.
    if (item.imageBuffer) {
      try {
        doc.image(item.imageBuffer, { fit: [495, 280], align: 'center' });
        doc.moveDown(1);
      } catch {
        // intentionally swallowed — see comment above
      }
    }

    doc.fontSize(20).fillColor('#111111').text(snapshot.title);
    doc
      .fontSize(16)
      .fillColor('#1a73e8')
      .text(`${snapshot.currency} ${snapshot.price.toLocaleString('en-US')}`);
    doc.moveDown(0.5);

    const locationLabel =
      [snapshot.area, snapshot.city].filter(Boolean).join(', ') ||
      snapshot.country ||
      'Location on request';
    doc
      .fontSize(12)
      .fillColor('#333333')
      .text(
        `${snapshot.propertyType} · ${snapshot.listingPurpose === 'SALE' ? 'For Sale' : 'For Rent'} · ${locationLabel}`,
      );

    const facts: string[] = [];
    if (snapshot.bedrooms != null) facts.push(`${snapshot.bedrooms} Bed`);
    if (snapshot.bathrooms != null) facts.push(`${snapshot.bathrooms} Bath`);
    if (snapshot.areaSqm != null) facts.push(`${snapshot.areaSqm} m²`);
    if (facts.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor('#333333').text(facts.join('  ·  '));
    }

    if (snapshot.featureKeys.length > 0) {
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .fillColor('#555555')
        .text(
          snapshot.featureKeys
            .map((key) => key.replace(/_/g, ' '))
            .join('  •  '),
        );
    }

    if (snapshot.description) {
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor('#333333').text(snapshot.description);
    }

    if (item.agentNote) {
      doc.moveDown(0.8);
      doc
        .fontSize(11)
        .fillColor('#1a73e8')
        .text(`Agent note: ${item.agentNote}`);
    }
  }
}
