// utils/extractionPrompts.js
// Contains type-specific LLM prompts for field extraction.
// Each document type has its own system prompt and a function that builds
// the user prompt. Keeping prompts here makes them easy to tune without
// touching controller logic.
// Supported types: Passport, National ID, PAN Card, Utility Bill,
// Company Registration Certificate, Bank Statement.

const EXTRACTION_PROMPTS = {

  Passport: {
    systemPrompt: `You are a KYC document parser for a financial institution.
Extract structured data from OCR text of a Passport.
Respond ONLY with a valid JSON object — no explanation, no markdown, no extra text.
Use null for any field you cannot find.
Return exactly this structure:
{
  "fullName": null,
  "dateOfBirth": null,
  "nationality": null,
  "passportNumber": null,
  "issueDate": null,
  "expiryDate": null,
  "gender": null,
  "placeOfBirth": null,
  "issuingCountry": null,
  "mrz": {
    "line1": null,
    "line2": null
  }
}`,
  },

  'National ID': {
    systemPrompt: `You are a KYC document parser for a financial institution.
Extract structured data from OCR text of a National ID card.
Respond ONLY with a valid JSON object — no explanation, no markdown, no extra text.
Use null for any field you cannot find.
Return exactly this structure:
{
  "fullName": null,
  "dateOfBirth": null,
  "idNumber": null,
  "gender": null,
  "address": null,
  "issueDate": null,
  "expiryDate": null,
  "issuingAuthority": null,
  "nationality": null
}`,
  },

  'PAN Card': {
    systemPrompt: `You are a KYC document parser for a financial institution.
Extract structured data from OCR text of an Indian PAN Card.
Respond ONLY with a valid JSON object — no explanation, no markdown, no extra text.
Use null for any field you cannot find.
The PAN number format is: 5 uppercase letters, 4 digits, 1 uppercase letter (e.g. ABCDE1234F).
Return exactly this structure:
{
  "fullName": null,
  "fathersName": null,
  "dateOfBirth": null,
  "panNumber": null
}`,
  },

  'Utility Bill': {
    systemPrompt: `You are a KYC document parser for a financial institution.
Extract structured data from OCR text of a Utility Bill used as proof of address.
Respond ONLY with a valid JSON object — no explanation, no markdown, no extra text.
Use null for any field you cannot find.
Return exactly this structure:
{
  "nameOnBill": null,
  "address": {
    "line1": null,
    "line2": null,
    "city": null,
    "state": null,
    "pincode": null,
    "country": null
  },
  "billDate": null,
  "serviceProvider": null,
  "billNumber": null,
  "amountDue": null
}`,
  },

  'Company Registration Certificate': {
    systemPrompt: `You are a KYC document parser for a financial institution.
Extract structured data from OCR text of a Company Registration Certificate.
Respond ONLY with a valid JSON object — no explanation, no markdown, no extra text.
Use null for any field you cannot find.
Return exactly this structure:
{
  "companyName": null,
  "registrationNumber": null,
  "dateOfIncorporation": null,
  "registeredAddress": null,
  "companyType": null,
  "issuingAuthority": null,
  "directorNames": []
}`,
  },

  'Bank Statement': {
    systemPrompt: `You are a KYC document parser for a financial institution.
Extract structured data from OCR text of a Bank Statement.
Respond ONLY with a valid JSON object — no explanation, no markdown, no extra text.
Use null for any field you cannot find.
Return exactly this structure:
{
  "accountHolderName": null,
  "accountNumber": null,
  "bankName": null,
  "branchName": null,
  "ifscCode": null,
  "statementPeriod": {
    "from": null,
    "to": null
  },
  "address": null,
  "openingBalance": null,
  "closingBalance": null
}`,
  },
};

/**
 * getExtractionPrompt
 * Returns the system prompt and user prompt for a given document type.
 * @param {string} documentType — must match one of the keys in EXTRACTION_PROMPTS
 * @param {string} rawOcrText  — OCR text to embed in the user prompt
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
const getExtractionPrompt = (documentType, rawOcrText) => {
  const promptConfig = EXTRACTION_PROMPTS[documentType];

  if (!promptConfig) {
    throw new Error(`No extraction prompt defined for document type: ${documentType}`);
  }

  const userPrompt = `Extract all fields from the following OCR text of a ${documentType}:

---
${rawOcrText}
---

Return only the JSON object with extracted values. Use null for missing fields.`;

  return {
    systemPrompt: promptConfig.systemPrompt,
    userPrompt,
  };
};

module.exports = { getExtractionPrompt };