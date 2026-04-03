// models/Verification.js
// Mongoose schema for a KYC verification record.
// One document is created per customer document upload and stores
// every stage of the pipeline: OCR text, extracted fields,
// validation results, AML screening outcome, risk score, and report path.

const mongoose = require('mongoose');

// --- Sub-schema: single validation rule result ---
const ValidationResultSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    status: { type: String, enum: ['pass', 'fail'], required: true },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

// --- Sub-schema: AML watchlist match result ---
const AMLResultSchema = new mongoose.Schema(
  {
    matched: { type: Boolean, default: false },
    matchedName: { type: String, default: null },
    listSource: { type: String, default: null },
    matchScore: { type: Number, default: null },
    sanctionType: { type: String, default: null },
  },
  { _id: false }
);

// --- Sub-schema: individual risk rule that was triggered ---
const RiskBreakdownSchema = new mongoose.Schema(
  {
    rule: { type: String, required: true },
    pointsAdded: { type: Number, required: true },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

// --- Main Verification Schema ---
const VerificationSchema = new mongoose.Schema(
  {
    // Unique ID for this verification session (used in PDF reports and audit logs)
    verificationId: {
      type: String,
      required: true,
      unique: true,
    },

    // Optional customer identifier passed from the frontend
    customerId: {
      type: String,
      default: null,
    },

    // Original uploaded file name
    uploadedFileName: {
      type: String,
      required: true,
    },

    // Mime type of uploaded file (image/jpeg, application/pdf, etc.)
    fileType: {
      type: String,
      default: null,
    },

    // Document category identified by LLM
    documentType: {
      type: String,
      enum: [
        'Passport',
        'National ID',
        'PAN Card',
        'Utility Bill',
        'Company Registration Certificate',
        'Bank Statement',
        'Unknown',
      ],
      default: 'Unknown',
    },

    // Raw text output from Tesseract OCR
    rawOcrText: {
      type: String,
      default: '',
    },

    // Structured fields extracted by Groq LLM (flexible — varies by document type)
    extractedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Array of pass/fail results from the validation engine
    validationReport: {
      type: [ValidationResultSchema],
      default: [],
    },

    // Overall validation status derived from validationReport
    validationStatus: {
      type: String,
      enum: ['pending', 'passed', 'failed'],
      default: 'pending',
    },

    // AML watchlist screening result
    amlResult: {
      type: AMLResultSchema,
      default: () => ({}),
    },

    // Computed risk score 0–100
    riskScore: {
      type: Number,
      default: null,
    },

    // Risk band derived from score
    riskBand: {
      type: String,
      enum: ['Low', 'Medium', 'High', null],
      default: null,
    },

    // Which rules were triggered and how many points each added
    riskBreakdown: {
      type: [RiskBreakdownSchema],
      default: [],
    },

    // File path of the generated PDF audit report (set after report generation)
    pdfReportPath: {
      type: String,
      default: null,
    },

    // Overall pipeline status
    status: {
      type: String,
      enum: ['uploaded', 'classified', 'extracted', 'validated', 'screened', 'scored', 'complete'],
      default: 'uploaded',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model('Verification', VerificationSchema);