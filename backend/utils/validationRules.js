// utils/validationRules.js
// Pure Node.js validation engine — no AI involved.
// Contains all 6 KYC validation rules as individual functions.
// Each rule function receives the extractedFields and documentType,
// and returns a { field, status, reason } object.
// runAllValidations() orchestrates all rules and returns a full report
// along with an overall pass/fail status.
// fuse.js is used for fuzzy name matching across documents.

const Fuse = require('fuse.js');

// ─── Helper: parse a date string into a JS Date object ───────────────────────
// Handles formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY
const parseDate = (dateStr) => {
  if (!dateStr) return null;

  const str = dateStr.toString().trim();

  // Try native parse first (handles YYYY-MM-DD)
  let d = new Date(str);
  if (!isNaN(d)) return d;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    d = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
    if (!isNaN(d)) return d;
  }

  return null;
};

// ─── Rule 1: Document Expiry ──────────────────────────────────────────────────
// Checks that the document is not expired.
// Applies to: Passport, National ID, Bank Statement
const checkExpiry = (extractedFields, documentType) => {
  const expiryFieldMap = {
    Passport: 'expiryDate',
    'Bank Statement': null, // no expiry on bank statements
  };

  // Document types that don't have an expiry field — auto pass
  const noExpiryTypes = ['PAN Card', 'Utility Bill','National ID', 'Company Registration Certificate', 'Bank Statement'];
  if (noExpiryTypes.includes(documentType)) {
    return { field: 'expiryDate', status: 'pass', reason: `${documentType} does not have an expiry date.` };
  }

  const expiryValue = extractedFields?.expiryDate;

  if (!expiryValue) {
    return { field: 'expiryDate', status: 'fail', reason: 'Expiry date is missing from the document.' };
  }

  const expiryDate = parseDate(expiryValue);
  if (!expiryDate) {
    return { field: 'expiryDate', status: 'fail', reason: `Could not parse expiry date: "${expiryValue}".` };
  }

  const today = new Date();
  if (expiryDate < today) {
    return {
      field: 'expiryDate',
      status: 'fail',
      reason: `Document expired on ${expiryValue}. Expired documents cannot be accepted for KYC.`,
    };
  }

  return { field: 'expiryDate', status: 'pass', reason: `Document is valid until ${expiryValue}.` };
};

// ─── Rule 2: Age Verification ─────────────────────────────────────────────────
// Customer must be 18 years or older based on date of birth.
// Applies to all personal documents (not Company Registration).
const checkAge = (extractedFields, documentType) => {
  if (documentType === 'Company Registration Certificate') {
    return { field: 'dateOfBirth', status: 'pass', reason: 'Age check not applicable for company documents.' };
  }

  // Field name varies by document type
  const dobValue =
    extractedFields?.dateOfBirth ||
    extractedFields?.dob ||
    null;

  if (!dobValue) {
    return { field: 'dateOfBirth', status: 'fail', reason: 'Date of birth is missing from the document.' };
  }

  const dob = parseDate(dobValue);
  if (!dob) {
    return { field: 'dateOfBirth', status: 'fail', reason: `Could not parse date of birth: "${dobValue}".` };
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  if (age < 18) {
    return {
      field: 'dateOfBirth',
      status: 'fail',
      reason: `Customer is ${age} years old. Must be at least 18 years old for KYC.`,
    };
  }

  return { field: 'dateOfBirth', status: 'pass', reason: `Customer is ${age} years old. Age requirement met.` };
};

// ─── Rule 3: PAN Number Format ────────────────────────────────────────────────
// PAN must match the Indian PAN format: AAAAA9999A
// Only applies to PAN Card documents.
const checkPanFormat = (extractedFields, documentType) => {
  if (documentType !== 'PAN Card') {
    return { field: 'panNumber', status: 'pass', reason: 'PAN format check not applicable for this document type.' };
  }

  const panValue = extractedFields?.panNumber;

  if (!panValue) {
    return { field: 'panNumber', status: 'fail', reason: 'PAN number is missing from the document.' };
  }

  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!PAN_REGEX.test(panValue.trim().toUpperCase())) {
    return {
      field: 'panNumber',
      status: 'fail',
      reason: `PAN number "${panValue}" does not match the required format AAAAA9999A.`,
    };
  }

  return { field: 'panNumber', status: 'pass', reason: `PAN number "${panValue}" is in valid format.` };
};

// ─── Rule 4: Address Proof Recency ───────────────────────────────────────────
// Utility bills must be dated within the last 90 days.
// Only applies to Utility Bill documents.
const checkAddressProofRecency = (extractedFields, documentType) => {
  if (documentType !== 'Utility Bill') {
    return { field: 'billDate', status: 'pass', reason: 'Address proof recency check not applicable for this document type.' };
  }

  const billDateValue = extractedFields?.billDate;

  if (!billDateValue) {
    return { field: 'billDate', status: 'fail', reason: 'Bill date is missing from the utility bill.' };
  }

  const billDate = parseDate(billDateValue);
  if (!billDate) {
    return { field: 'billDate', status: 'fail', reason: `Could not parse bill date: "${billDateValue}".` };
  }

  const today = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(today.getDate() - 90);

  if (billDate < ninetyDaysAgo) {
    return {
      field: 'billDate',
      status: 'fail',
      reason: `Utility bill dated ${billDateValue} is older than 90 days. A recent bill is required for address proof.`,
    };
  }

  return { field: 'billDate', status: 'pass', reason: `Utility bill dated ${billDateValue} is within the last 90 days.` };
};

// ─── Rule 5: Name Consistency ─────────────────────────────────────────────────
// If more than one name field exists in extractedFields, they must fuzzy-match.
// Uses fuse.js to handle minor OCR discrepancies.
// Minimum match score threshold: 0.6 (fuse.js score is 0=perfect, 1=no match)
const checkNameConsistency = (extractedFields, documentType) => {
  // Collect all name-like fields from the extracted data
  const nameFields = [
    extractedFields?.fullName,
    extractedFields?.nameOnBill,
    extractedFields?.accountHolderName,
    extractedFields?.companyName,
  ].filter(Boolean); // remove nulls

  if (nameFields.length < 2) {
    return {
      field: 'nameConsistency',
      status: 'pass',
      reason: 'Only one name field found — cross-document name consistency check skipped.',
    };
  }

  // Compare each name against the first name using fuse.js
  const primaryName = nameFields[0];
  const fuse = new Fuse([primaryName], {
    includeScore: true,
    threshold: 0.4, // 0 = perfect match, 1 = match anything
  });

  for (let i = 1; i < nameFields.length; i++) {
    const results = fuse.search(nameFields[i]);
    // fuse score: 0 = perfect, higher = worse. We want score < 0.4 to pass.
    if (results.length === 0 || results[0].score > 0.4) {
      return {
        field: 'nameConsistency',
        status: 'fail',
        reason: `Name mismatch detected: "${primaryName}" vs "${nameFields[i]}". Names across documents must match.`,
      };
    }
  }

  return {
    field: 'nameConsistency',
    status: 'pass',
    reason: `All name fields are consistent: "${nameFields.join('", "')}".`,
  };
};

// ─── Rule 6: Document Completeness ───────────────────────────────────────────
// All required fields for the document type must be non-null and non-empty.
// Required fields are defined per document type.
const checkCompleteness = (extractedFields, documentType) => {
  const requiredFieldsMap = {
    Passport: ['fullName', 'dateOfBirth', 'passportNumber', 'expiryDate', 'nationality'],
    'National ID': ['fullName', 'dateOfBirth', 'idNumber'],
    'PAN Card': ['fullName', 'dateOfBirth', 'panNumber'],
    'Utility Bill': ['nameOnBill', 'address', 'billDate', 'serviceProvider'],
    'Company Registration Certificate': ['companyName', 'registrationNumber', 'dateOfIncorporation'],
    'Bank Statement': ['accountHolderName', 'accountNumber', 'bankName'],
  };

  const required = requiredFieldsMap[documentType];

  if (!required) {
    return { field: 'completeness', status: 'pass', reason: 'No completeness rules defined for this document type.' };
  }

  const missingFields = required.filter((field) => {
    const value = extractedFields?.[field];
    return value === null || value === undefined || value === '';
  });

  if (missingFields.length > 0) {
    return {
      field: 'completeness',
      status: 'fail',
      reason: `Missing required fields: ${missingFields.join(', ')}.`,
    };
  }

  return {
    field: 'completeness',
    status: 'pass',
    reason: `All required fields are present for ${documentType}.`,
  };
};

// ─── Master Runner ────────────────────────────────────────────────────────────
/**
 * runAllValidations
 * Runs all 6 validation rules and returns a complete report.
 * @param {object} extractedFields — fields from Groq extraction
 * @param {string} documentType   — classified document type
 * @returns {{ validationReport: Array, validationStatus: string }}
 */
const runAllValidations = (extractedFields, documentType) => {
  const validationReport = [
    checkExpiry(extractedFields, documentType),
    checkAge(extractedFields, documentType),
    checkPanFormat(extractedFields, documentType),
    checkAddressProofRecency(extractedFields, documentType),
    checkNameConsistency(extractedFields, documentType),
    checkCompleteness(extractedFields, documentType),
  ];

  // Overall status: 'failed' if any rule fails, 'passed' if all pass
  const validationStatus = validationReport.some((r) => r.status === 'fail')
    ? 'failed'
    : 'passed';

  return { validationReport, validationStatus };
};

module.exports = { runAllValidations };