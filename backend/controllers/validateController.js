// controllers/validateController.js
// Handles the validation step of the KYC pipeline.
// Takes a verificationId, fetches extractedFields and documentType from MongoDB,
// runs all 6 validation rules via validationRules.js,
// saves the validationReport and validationStatus to MongoDB,
// and advances the verification status to 'validated'.

const Verification = require('../models/Verification');
const { runAllValidations } = require('../utils/validationRules');

/**
 * validateDocument
 * POST /api/validate
 * Body: { verificationId: "VRF-XXXXXXXX" }
 */
const validateDocument = async (req, res) => {
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

    // --- Check extraction step was completed ---
    if (!verification.extractedFields || Object.keys(verification.extractedFields).length === 0) {
      return res.status(422).json({
        success: false,
        message: 'No extracted fields found. Run /api/extract before validating.',
      });
    }

    // --- Run all validation rules ---
    const { validationReport, validationStatus } = runAllValidations(
      verification.extractedFields,
      verification.documentType
    );

    // --- Save to MongoDB ---
    verification.validationReport = validationReport;
    verification.validationStatus = validationStatus;
    verification.status = 'validated';
    await verification.save();

    // --- Respond ---
    return res.status(200).json({
      success: true,
      message: `Validation complete. Overall status: ${validationStatus.toUpperCase()}.`,
      data: {
        verificationId: verification.verificationId,
        documentType: verification.documentType,
        validationStatus: verification.validationStatus,
        validationReport: verification.validationReport,
        status: verification.status,
      },
    });
  } catch (error) {
    console.error('validateDocument error:', error.message);
    return res.status(500).json({ success: false, message: 'Validation failed.', error: error.message });
  }
};

module.exports = { validateDocument };