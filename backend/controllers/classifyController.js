// controllers/classifyController.js
// Handles document type classification using Groq LLM.
// Takes a verificationId, fetches the rawOcrText from MongoDB,
// sends it to Groq with a strict classification prompt,
// parses the JSON response, updates the Verification document
// with the identified documentType, and advances status to 'classified'.

const Verification = require('../models/Verification');
const { callGroq } = require('../utils/groqClient');

// The exact document types the LLM must choose from
const VALID_DOCUMENT_TYPES = [
  'Passport',
  'National ID',
  'PAN Card',
  'Utility Bill',
  'Company Registration Certificate',
  'Bank Statement',
];

/**
 * classifyDocument
 * POST /api/classify
 * Body: { verificationId: "VRF-XXXXXXXX" }
 */
const classifyDocument = async (req, res) => {
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

    // --- Check OCR text exists ---
    if (!verification.rawOcrText || verification.rawOcrText.length === 0) {
      return res.status(422).json({ success: false, message: 'No OCR text found for this verification. Upload step may have failed.' });
    }

    // --- Build Groq prompts ---
    const systemPrompt = `You are a document classification expert for a KYC/AML system used by financial institutions.
Your job is to look at OCR-extracted text from an identity document and classify what type of document it is.
You must respond ONLY with a valid JSON object — no explanation, no markdown, no extra text.
The JSON must have exactly this structure:
{
  "documentType": "<type>",
  "confidence": "<High|Medium|Low>",
  "reasoning": "<one sentence explaining why>"
}
You must choose documentType strictly from this list:
- Passport
- National ID
- PAN Card
- Utility Bill
- Company Registration Certificate
- Bank Statement
If you cannot determine the type, use "Unknown".`;

    const userPrompt = `Classify this document based on the following OCR-extracted text:

---
${verification.rawOcrText}
---

Return only the JSON object.`;

    // --- Call Groq ---
    const rawResponse = await callGroq(systemPrompt, userPrompt, 512);

    // --- Parse JSON from response ---
    let parsed;
    try {
      // Strip any accidental markdown code fences
      const cleaned = rawResponse.replace(/```json|```/gi, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        message: 'Groq returned a response that could not be parsed as JSON.',
        rawResponse,
      });
    }

    // --- Validate document type ---
    const documentType = VALID_DOCUMENT_TYPES.includes(parsed.documentType)
      ? parsed.documentType
      : 'Unknown';

    // --- Update MongoDB ---
    verification.documentType = documentType;
    verification.status = 'classified';
    await verification.save();

    // --- Respond ---
    return res.status(200).json({
      success: true,
      message: 'Document classified successfully.',
      data: {
        verificationId: verification.verificationId,
        documentType: verification.documentType,
        confidence: parsed.confidence || 'Unknown',
        reasoning: parsed.reasoning || '',
        status: verification.status,
      },
    });
  } catch (error) {
    console.error('classifyDocument error:', error.message);
    return res.status(500).json({ success: false, message: 'Classification failed.', error: error.message });
  }
};

module.exports = { classifyDocument };