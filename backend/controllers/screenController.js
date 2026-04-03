// controllers/screenController.js
// Handles the AML watchlist screening step of the KYC pipeline.
// Takes a verificationId, extracts the customer name from extractedFields,
// runs fuzzy screening against OFAC and UN lists via amlScreeningService,
// saves the amlResult to MongoDB, and advances status to 'screened'.

const Verification = require('../models/Verification');
const { screenName, extractNameForScreening } = require('../services/amlScreeningService');

/**
 * screenDocument
 * POST /api/screen
 * Body: { verificationId: "VRF-XXXXXXXX" }
 */
const screenDocument = async (req, res) => {
  try {
    const { verificationId } = req.body;

    // --- Validate input ---
    if (!verificationId) {
      return res.status(400).json({ success: false, message: 'verificationId is required.' });
    }

    // --- Fetch verification record ---
    const verification = await Verification.findOne({ verificationId });
    if (!verification) {
      return res.status(404).json({
        success: false,
        message: `No verification found with ID: ${verificationId}`,
      });
    }

    // --- Ensure extraction has been done ---
    if (!verification.extractedFields || Object.keys(verification.extractedFields).length === 0) {
      return res.status(422).json({
        success: false,
        message: 'No extracted fields found. Run /api/extract before screening.',
      });
    }

    // --- Pull the name to screen ---
    const nameToScreen = extractNameForScreening(
      verification.extractedFields,
      verification.documentType
    );

    if (!nameToScreen) {
      return res.status(422).json({
        success: false,
        message: 'Could not determine customer name from extracted fields for AML screening.',
      });
    }

    // --- Run AML screening ---
    const amlResult = screenName(nameToScreen);

    // --- Save to MongoDB ---
    verification.amlResult = amlResult;
    verification.status = 'screened';
    await verification.save();

    // --- Respond ---
    return res.status(200).json({
      success: true,
      message: amlResult.matched
        ? `⚠️  WATCHLIST HIT: ${nameToScreen} matched on ${amlResult.listSource}`
        : `✅ No watchlist matches found for: ${nameToScreen}`,
      data: {
        verificationId: verification.verificationId,
        screenedName: nameToScreen,
        amlResult: verification.amlResult,
        status: verification.status,
      },
    });
  } catch (error) {
    console.error('screenDocument error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'AML screening failed.',
      error: error.message,
    });
  }
};

module.exports = { screenDocument };