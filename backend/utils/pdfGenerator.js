// utils/pdfGenerator.js
// Generates a structured KYC audit report PDF using pdfkit.
// Takes a complete Verification document from MongoDB and produces
// a professional PDF containing:
//   - Report header with verification ID and timestamp
//   - Customer details extracted from the document
//   - Document metadata (type, filename, upload time)
//   - Validation results table (pass/fail per rule)
//   - AML watchlist screening outcome
//   - Risk score with band and full breakdown
//   - Footer with disclaimer
// Returns the file path of the saved PDF.

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLORS = {
  primary:   '#1a1a2e',
  accent:    '#0f3460',
  pass:      '#16a34a',
  fail:      '#dc2626',
  low:       '#16a34a',
  medium:    '#d97706',
  high:      '#dc2626',
  lightGray: '#f3f4f6',
  midGray:   '#6b7280',
  white:     '#ffffff',
  border:    '#e5e7eb',
};

// ─── Helper: draw a horizontal rule ──────────────────────────────────────────
const drawRule = (doc, y) => {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(COLORS.border).lineWidth(1).stroke();
};

// ─── Helper: section heading ──────────────────────────────────────────────────
// Draws a filled accent rectangle then places text inside it.
// moveDown(1.2) after ensures the next content starts below the heading.
const sectionHeading = (doc, text) => {
  doc.moveDown(0.8);
  const y = doc.y;
  doc.rect(50, y, 495, 24).fill(COLORS.accent);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.white)
    .text(text, 58, y + 7, { width: 480 });
  doc.moveDown(1.2);
};

// ─── Helper: key-value row ────────────────────────────────────────────────────
const kvRow = (doc, label, value, isAlternate = false) => {
  const rowY = doc.y;
  if (isAlternate) {
    doc.rect(50, rowY, 495, 18).fill(COLORS.lightGray);
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.primary)
    .text(label, 58, rowY + 4, { width: 160 });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.primary)
    .text(String(value ?? 'N/A'), 220, rowY + 4, { width: 320 });
  doc.moveDown(0.6);
};

// ─── Helper: risk band colour ─────────────────────────────────────────────────
const riskColor = (band) => {
  if (band === 'Low')    return COLORS.low;
  if (band === 'Medium') return COLORS.medium;
  return COLORS.high;
};

// ─── Main generator ───────────────────────────────────────────────────────────
/**
 * generatePdfReport
 * @param {object} verification — full Mongoose Verification document
 * @returns {Promise<string>}   — absolute path to the saved PDF file
 */
const generatePdfReport = (verification) => {
  return new Promise((resolve, reject) => {
    try {
      // Ensure reports directory exists
      const reportsDir = path.join(__dirname, '..', 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const fileName    = `KYC_Report_${verification.verificationId}_${Date.now()}.pdf`;
      const filePath    = path.join(reportsDir, fileName);
      const writeStream = fs.createWriteStream(filePath);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title:    `KYC Audit Report — ${verification.verificationId}`,
          Author:   'SurakshID KYC System',
          Subject:  'KYC/AML Verification Report',
          Keywords: 'KYC AML sanctions verification',
        },
      });

      doc.pipe(writeStream);

      // Fill first page background white
      doc.rect(0, 0, 595, 842).fill(COLORS.white);

      // Fill background white on every subsequent page too
      doc.on('pageAdded', () => {
        doc.rect(0, 0, 595, 842).fill(COLORS.white);
      });

      // ── PAGE HEADER ──────────────────────────────────────────────────────────
      doc.rect(0, 0, 595, 80).fill(COLORS.primary);

      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(COLORS.white)
        .text('SurakshID', 50, 22);

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#a0aec0')
        .text('KYC / AML Document Verification Report', 50, 46);

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#a0aec0')
        .text(`Generated: ${new Date().toUTCString()}`, 50, 62);

      // Risk badge in top right
      const band = verification.riskBand || 'N/A';
      doc.rect(440, 18, 105, 44).fill(riskColor(band));
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.white)
        .text('RISK RATING', 448, 26);
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(COLORS.white)
        .text(band.toUpperCase(), 448, 36);

      doc.moveDown(4);

      // ── SECTION 1: VERIFICATION SUMMARY ─────────────────────────────────────
      sectionHeading(doc, '1. VERIFICATION SUMMARY');
      kvRow(doc, 'Verification ID',   verification.verificationId,              false);
      kvRow(doc, 'Customer ID',       verification.customerId || 'N/A',         true);
      kvRow(doc, 'Document Type',     verification.documentType,                false);
      kvRow(doc, 'Uploaded File',     verification.uploadedFileName,            true);
      kvRow(doc, 'File Type',         verification.fileType,                    false);
      kvRow(doc, 'Pipeline Status',   verification.status,                      true);
      kvRow(doc, 'Verification Date', verification.createdAt
        ? new Date(verification.createdAt).toUTCString()
        : 'N/A',                                                                false);

      // ── SECTION 2: EXTRACTED CUSTOMER DETAILS ────────────────────────────────
      sectionHeading(doc, '2. EXTRACTED CUSTOMER DETAILS');
      const fields = verification.extractedFields || {};

      if (Object.keys(fields).length === 0) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.midGray)
          .text('No fields extracted.', 58);
        doc.moveDown(0.5);
      } else {
        let alt = false;
        for (const [key, value] of Object.entries(fields)) {
          kvRow(
            doc,
            key,
            typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : value,
            alt
          );
          alt = !alt;
        }
      }

      // ── SECTION 3: VALIDATION RESULTS ────────────────────────────────────────
      sectionHeading(doc, '3. VALIDATION RESULTS');

      const overallStatus = verification.validationStatus || 'pending';
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(overallStatus === 'passed' ? COLORS.pass : COLORS.fail)
        .text(`Overall Status: ${overallStatus.toUpperCase()}`, 58);
      doc.moveDown(0.6);

      const report = verification.validationReport || [];
      if (report.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.midGray)
          .text('No validation results available.', 58);
        doc.moveDown(0.5);
      } else {
        // Table header row
        const tableY = doc.y;
        doc.rect(50, tableY, 495, 20).fill(COLORS.accent);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.white);
        doc.text('Field',  58,  tableY + 6, { width: 160 });
        doc.text('Status', 225, tableY + 6, { width: 60  });
        doc.text('Reason', 290, tableY + 6, { width: 250 });
        doc.moveDown(1.0);

        report.forEach((rule, i) => {
          const rowY = doc.y;
          if (i % 2 === 0) {
            doc.rect(50, rowY, 495, 18).fill(COLORS.lightGray);
          }
          const statusColor = rule.status === 'pass' ? COLORS.pass : COLORS.fail;

          doc
            .font('Helvetica').fontSize(8).fillColor(COLORS.primary)
            .text(rule.field, 58, rowY + 4, { width: 160 });
          doc
            .font('Helvetica-Bold').fontSize(8).fillColor(statusColor)
            .text(rule.status.toUpperCase(), 225, rowY + 4, { width: 60 });
          doc
            .font('Helvetica').fontSize(8).fillColor(COLORS.primary)
            .text(rule.reason || '', 290, rowY + 4, { width: 250 });
          doc.moveDown(0.6);
        });
      }

      // ── SECTION 4: AML WATCHLIST SCREENING ───────────────────────────────────
      sectionHeading(doc, '4. AML WATCHLIST SCREENING');
      const aml = verification.amlResult || {};

      kvRow(doc, 'Screened',      aml.screened ? 'Yes' : 'No',                  false);
      kvRow(doc, 'Watchlist Hit', aml.matched  ? '⚠ YES — MATCH FOUND' : '✓ No Match', true);

      if (aml.matched) {
        kvRow(doc, 'Matched Name',  aml.matchedName,  false);
        kvRow(doc, 'List Source',   aml.listSource,   true);
        kvRow(doc, 'Match Score',   aml.matchScore,   false);
        kvRow(doc, 'Sanction Type', aml.sanctionType, true);
      } else {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.pass)
          .text(
            'No matches found in OFAC or UN Security Council sanctions lists.',
            58
          );
        doc.moveDown(0.5);
      }

      // ── SECTION 5: RISK SCORE & BREAKDOWN ────────────────────────────────────
      sectionHeading(doc, '5. RISK SCORE & BREAKDOWN');

      const scoreBoxY = doc.y;

      // Score box (left)
      doc.rect(50, scoreBoxY, 240, 60).fill(riskColor(band));
      doc
        .font('Helvetica-Bold').fontSize(36).fillColor(COLORS.white)
        .text(String(verification.riskScore ?? 'N/A'), 58, scoreBoxY + 8, { width: 100 });
      doc
        .font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white)
        .text('/ 100', 58, scoreBoxY + 44);
      doc
        .font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white)
        .text(`${band} Risk`, 140, scoreBoxY + 20);

      // Recommendation box (right)
      const recommendations = {
        Low:    'Proceed with customer onboarding.',
        Medium: 'Flag for manual review before onboarding.',
        High:   'Escalate to compliance team. Do not onboard.',
      };
      doc.rect(300, scoreBoxY, 245, 60).fill(COLORS.lightGray);
      doc
        .font('Helvetica-Bold').fontSize(8).fillColor(COLORS.midGray)
        .text('RECOMMENDATION', 310, scoreBoxY + 10);
      doc
        .font('Helvetica').fontSize(9).fillColor(COLORS.primary)
        .text(recommendations[band] || 'N/A', 310, scoreBoxY + 26, { width: 225 });

      doc.moveDown(4.5);

      // Risk breakdown table
      const breakdown = verification.riskBreakdown || [];
      if (breakdown.length === 0) {
        doc
          .font('Helvetica').fontSize(9).fillColor(COLORS.pass)
          .text('No risk rules were triggered. Customer appears clean.', 58);
        doc.moveDown(0.5);
      } else {
        const bkY = doc.y;
        doc.rect(50, bkY, 495, 20).fill(COLORS.accent);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.white);
        doc.text('Triggered Rule', 58,  bkY + 6, { width: 310 });
        doc.text('Points Added',   390, bkY + 6, { width: 100 });
        doc.moveDown(1.0);

        breakdown.forEach((item, i) => {
          const rowY = doc.y;
          if (i % 2 === 0) {
            doc.rect(50, rowY, 495, 18).fill(COLORS.lightGray);
          }
          doc
            .font('Helvetica').fontSize(8).fillColor(COLORS.primary)
            .text(item.rule, 58, rowY + 4, { width: 325 });
          doc
            .font('Helvetica-Bold').fontSize(8).fillColor(COLORS.fail)
            .text(`+${item.pointsAdded}`, 390, rowY + 4, { width: 100 });
          doc.moveDown(0.6);
        });
      }

      // ── FOOTER ────────────────────────────────────────────────────────────────
      doc.moveDown(1.5);
      drawRule(doc, doc.y);
      doc.moveDown(0.5);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(COLORS.midGray)
        .text(
          'This report is generated automatically by SurakshID and is intended for internal compliance use only. ' +
          'It does not constitute legal advice. All screening is performed against publicly available sanctions data. ' +
          `Report ID: ${verification.verificationId} | Generated: ${new Date().toUTCString()}`,
          50,
          doc.y,
          { width: 495, align: 'center' }
        );

      doc.end();

      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error',  (err) => reject(err));

    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generatePdfReport };