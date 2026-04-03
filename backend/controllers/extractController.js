// controllers/extractController.js
// Handles structured field extraction from OCR text using Groq LLM.
// Takes a verificationId, fetches rawOcrText and documentType from MongoDB,
// selects the correct type-specific prompt from extractionPrompts.js,
// calls Groq, parses the JSON response, stores extractedFields in MongoDB,
// and advances the verification status to 'extracted'.

const Verification = require('../models/Verification');
const { callGroq } = require('../utils/groqClient');
const { getExtractionPrompt } = require('../utils/extractionPrompts');

/**
 * extractFields
 * POST /api/extract
 * Body: { verificationId: "VRF-XXXXXXXX" }
 */
const extractFields = async (req, res) => {
  try {
    const { verificationId } = req.body;

    // --- Validate input ---
    if (!verificationId) {
      return res.status(400).json({ success: false, message: 'verificationId is required.' });
    }

    // --- Fetch verification record ---
    const verification = await Verification.findOne({ verificationId });
    if (!verification) {
      return res.status(404).json({ success: false, message: `No verification found with ID: ${verificationId}` });
    }

    // --- Check document is classified ---
    if (!verification.documentType || verification.documentType === 'Unknown') {
      return res.status(422).json({
        success: false,
        message: 'Document type is Unknown or not yet classified. Run /api/classify first.',
      });
    }

    // --- Check OCR text exists ---
    if (!verification.rawOcrText || verification.rawOcrText.length === 0) {
      return res.status(422).json({ success: false, message: 'No OCR text found for this verification.' });
    }

    // --- Get type-specific prompts ---
    let systemPrompt, userPrompt;
    try {
      ({ systemPrompt, userPrompt } = getExtractionPrompt(
        verification.documentType,
        verification.rawOcrText
      ));
    } catch (promptError) {
      return res.status(422).json({ success: false, message: promptError.message });
    }

    // --- Call Groq ---
    const rawResponse = await callGroq(systemPrompt, userPrompt, 1024);

    // --- Parse JSON response ---
    let extractedFields;
    try {
      const cleaned = rawResponse.replace(/```json|```/gi, '').trim();
      extractedFields = JSON.parse(cleaned);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        message: 'Groq returned a response that could not be parsed as JSON.',
        rawResponse,
      });
    }

    // --- Save to MongoDB ---
    verification.extractedFields = extractedFields;
    verification.status = 'extracted';
    await verification.save();

    // --- Respond ---
    return res.status(200).json({
      success: true,
      message: `Fields extracted successfully for ${verification.documentType}.`,
      data: {
        verificationId: verification.verificationId,
        documentType: verification.documentType,
        extractedFields: verification.extractedFields,
        status: verification.status,
      },
    });
  } catch (error) {
    console.error('extractFields error:', error.message);
    return res.status(500).json({ success: false, message: 'Extraction failed.', error: error.message });
  }
};

module.exports = { extractFields };