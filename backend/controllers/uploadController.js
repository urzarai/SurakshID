// controllers/uploadController.js
// Handles the document upload pipeline for Day 2.
// Step 1 — Receives the uploaded file via Multer
// Step 2 — Runs Tesseract OCR on the file to extract raw text
// Step 3 — Creates a new Verification document in MongoDB with status 'uploaded'
// Step 4 — Returns the verificationId, raw OCR text, and file metadata to the client
// Document classification and field extraction are handled in Day 3 and Day 4.

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Verification = require('../models/Verification');
const { extractTextFromFile } = require('../utils/ocrUtils');

/**
 * uploadDocument
 * POST /api/upload
 * Body: multipart/form-data with field name 'document'
 * Optional body field: customerId (string)
 */
const uploadDocument = async (req, res) => {
  try {
    // --- Check file was attached ---
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Send a file with field name "document".' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const fileType = req.file.mimetype;
    const customerId = req.body.customerId || null;

    // --- Run OCR ---
    const rawOcrText = await extractTextFromFile(filePath);

    if (!rawOcrText || rawOcrText.length === 0) {
      return res.status(422).json({ success: false, message: 'OCR could not extract any text from the uploaded file. Try a clearer image.' });
    }

    // --- Generate unique verification ID ---
    const verificationId = `VRF-${uuidv4().toUpperCase().slice(0, 8)}`;

    // --- Save to MongoDB ---
    const verification = await Verification.create({
      verificationId,
      customerId,
      uploadedFileName: fileName,
      fileType,
      rawOcrText,
      status: 'uploaded',
    });

    // --- Respond ---
    return res.status(201).json({
      success: true,
      message: 'File uploaded and OCR completed successfully.',
      data: {
        verificationId: verification.verificationId,
        mongoId: verification._id,
        uploadedFileName: verification.uploadedFileName,
        fileType: verification.fileType,
        customerId: verification.customerId,
        rawOcrText: verification.rawOcrText,
        status: verification.status,
        createdAt: verification.createdAt,
      },
    });
  } catch (error) {
    console.error('uploadDocument error:', error.message);
    return res.status(500).json({ success: false, message: 'Upload failed.', error: error.message });
  }
};

module.exports = { uploadDocument };