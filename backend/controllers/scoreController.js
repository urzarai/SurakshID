// controllers/scoreController.js
// Handles the risk scoring step of the KYC pipeline.
// Takes a verificationId, fetches validationReport and amlResult from MongoDB,
// runs the weighted scoring engine via riskScoring.js,
// saves riskScore, riskBand, and riskBreakdown to MongoDB,
// and advances the verification status to 'scored'.
//
// Also exposes a GET /api/score/:verificationId route
// to fetch the score for an existing verification without re-computing.

const Verification = require('../models/Verification');
const { computeRiskScore } = require('../utils/riskScoring');

/**
 * scoreDocument
 * POST /api/score
 * Body: { verificationId: "VRF-XXXXXXXX" }
 */
const scoreDocument = async (req, res) => {
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

    // --- Ensure minimum pipeline steps are done ---
    if (!verification.extractedFields || Object.keys(verification.extractedFields).length === 0) {
      return res.status(422).json({
        success: false,
        message: 'Extracted fields not found. Complete /api/extract before scoring.',
      });
    }

    // --- Compute risk score ---
    const { riskScore, riskBand, riskBreakdown } = computeRiskScore({
      validationReport: verification.validationReport || [],
      amlResult:        verification.amlResult        || {},
      documentType:     verification.documentType,
    });

    // --- Save to MongoDB ---
    verification.riskScore     = riskScore;
    verification.riskBand      = riskBand;
    verification.riskBreakdown = riskBreakdown;
    verification.status        = 'scored';
    await verification.save();

    // --- Build recommendation message ---
    const recommendations = {
      Low:    'Proceed with customer onboarding.',
      Medium: 'Flag for manual review before onboarding.',
      High:   'Escalate to compliance team immediately. Do not onboard.',
    };

    return res.status(200).json({
      success: true,
      message: `Risk scoring complete. Band: ${riskBand}`,
      data: {
        verificationId:  verification.verificationId,
        documentType:    verification.documentType,
        riskScore:       verification.riskScore,
        riskBand:        verification.riskBand,
        recommendation:  recommendations[riskBand],
        riskBreakdown:   verification.riskBreakdown,
        validationStatus:verification.validationStatus,
        amlMatched:      verification.amlResult?.matched || false,
        status:          verification.status,
      },
    });
  } catch (error) {
    console.error('scoreDocument error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Risk scoring failed.',
      error: error.message,
    });
  }
};

/**
 * getScore
 * GET /api/score/:verificationId
 * Fetches the risk score for an existing verification without re-computing.
 */
const getScore = async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await Verification.findOne({ verificationId });
    if (!verification) {
      return res.status(404).json({
        success: false,
        message: `No verification found with ID: ${verificationId}`,
      });
    }

    if (verification.riskScore === null || verification.riskScore === undefined) {
      return res.status(422).json({
        success: false,
        message: 'Risk score not yet computed for this verification. Run /api/score first.',
      });
    }

    const recommendations = {
      Low:    'Proceed with customer onboarding.',
      Medium: 'Flag for manual review before onboarding.',
      High:   'Escalate to compliance team immediately. Do not onboard.',
    };

    return res.status(200).json({
      success: true,
      data: {
        verificationId:  verification.verificationId,
        documentType:    verification.documentType,
        riskScore:       verification.riskScore,
        riskBand:        verification.riskBand,
        recommendation:  recommendations[verification.riskBand],
        riskBreakdown:   verification.riskBreakdown,
        validationStatus:verification.validationStatus,
        amlMatched:      verification.amlResult?.matched || false,
        status:          verification.status,
      },
    });
  } catch (error) {
    console.error('getScore error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch risk score.',
      error: error.message,
    });
  }
};

module.exports = { scoreDocument, getScore };