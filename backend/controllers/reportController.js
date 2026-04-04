// controllers/reportController.js
// Handles PDF audit report generation and download.
// Exposes two routes:
//   POST /api/report/generate/:verificationId — generates and saves PDF, returns file path
//   GET  /api/report/download/:verificationId — streams the PDF to the client for download
// Uses pdfGenerator.js to build the structured report from the Verification document.

const path = require('path');
const fs   = require('fs');
const Verification    = require('../models/Verification');
const { generatePdfReport } = require('../utils/pdfGenerator');

/**
 * generateReport
 * POST /api/report/generate/:verificationId
 * Generates the PDF and saves the file path to MongoDB.
 */
const generateReport = async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await Verification.findOne({ verificationId });
    if (!verification) {
      return res.status(404).json({
        success: false,
        message: `No verification found with ID: ${verificationId}`,
      });
    }

    // Generate PDF
    const filePath = await generatePdfReport(verification);

    // Save path to MongoDB
    verification.pdfReportPath = filePath;
    verification.status = 'complete';
    await verification.save();

    return res.status(200).json({
      success: true,
      message: 'PDF audit report generated successfully.',
      data: {
        verificationId: verification.verificationId,
        pdfReportPath: filePath,
        status: verification.status,
        downloadUrl: `/api/report/download/${verificationId}`,
      },
    });
  } catch (error) {
    console.error('generateReport error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'PDF generation failed.',
      error: error.message,
    });
  }
};

/**
 * downloadReport
 * GET /api/report/download/:verificationId
 * Streams the saved PDF to the client as a file download.
 */
const downloadReport = async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await Verification.findOne({ verificationId });
    if (!verification) {
      return res.status(404).json({
        success: false,
        message: `No verification found with ID: ${verificationId}`,
      });
    }

    if (!verification.pdfReportPath) {
      return res.status(422).json({
        success: false,
        message: 'No PDF report found for this verification. Run /api/report/generate first.',
      });
    }

    const filePath = verification.pdfReportPath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found on server. Please regenerate the report.',
      });
    }

    const fileName = `KYC_Report_${verificationId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('downloadReport error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'PDF download failed.',
      error: error.message,
    });
  }
};

module.exports = { generateReport, downloadReport };