// utils/riskScoring.js
// Pure Node.js risk scoring engine — no AI involved.
// Computes a KYC risk score from 0 to 100 based on weighted rules.
// Each rule checks a specific condition from the verification record
// and adds points if the condition is triggered.
//
// Score bands:
//   0–20  → Low Risk    — proceed with onboarding
//   21–50 → Medium Risk — flag for manual review
//   51+   → High Risk   — escalate to compliance team
//
// Returns: { riskScore, riskBand, riskBreakdown }

// ─── Weighted rules definition ────────────────────────────────────────────────
// Each rule has:
//   id          — unique identifier
//   points      — how many points to add if triggered
//   description — human readable label shown in the PDF report and dashboard
const RISK_RULES = [
  {
    id: 'SANCTIONS_MATCH',
    points: 50,
    description: 'Customer name matched on OFAC or UN sanctions list',
  },
  {
    id: 'DOCUMENT_EXPIRED',
    points: 40,
    description: 'Submitted document is expired',
  },
  {
    id: 'NAME_MISMATCH',
    points: 30,
    description: 'Name inconsistency detected across document fields',
  },
  {
    id: 'MISSING_REQUIRED_FIELDS',
    points: 25,
    description: 'One or more required fields are missing from the document',
  },
  {
    id: 'ADDRESS_PROOF_OUTDATED',
    points: 15,
    description: 'Utility bill or address proof is older than 90 days',
  },
  {
    id: 'AGE_BELOW_18',
    points: 20,
    description: 'Customer appears to be under 18 years of age',
  },
  {
    id: 'INVALID_PAN_FORMAT',
    points: 15,
    description: 'PAN number does not match required format AAAAA9999A',
  },
];

// ─── Band assignment ──────────────────────────────────────────────────────────
/**
 * assignRiskBand
 * Converts a numeric score into a risk band label.
 * @param {number} score
 * @returns {string} 'Low' | 'Medium' | 'High'
 */
const assignRiskBand = (score) => {
  if (score <= 20) return 'Low';
  if (score <= 50) return 'Medium';
  return 'High';
};

// ─── Rule evaluators ──────────────────────────────────────────────────────────
// Each function checks one condition and returns
// { triggered: boolean, reason: string }

const evaluateSanctionsMatch = (amlResult) => {
  const triggered = amlResult?.matched === true;
  return {
    triggered,
    reason: triggered
      ? `Matched "${amlResult.matchedName}" on ${amlResult.listSource} with score ${amlResult.matchScore}`
      : 'No sanctions match found.',
  };
};

const evaluateDocumentExpired = (validationReport) => {
  const expiryRule = validationReport?.find((r) => r.field === 'expiryDate');
  const triggered = expiryRule?.status === 'fail';
  return {
    triggered,
    reason: triggered ? expiryRule.reason : 'Document expiry check passed.',
  };
};

const evaluateNameMismatch = (validationReport) => {
  const nameRule = validationReport?.find((r) => r.field === 'nameConsistency');
  const triggered = nameRule?.status === 'fail';
  return {
    triggered,
    reason: triggered ? nameRule.reason : 'Name consistency check passed.',
  };
};

const evaluateMissingFields = (validationReport) => {
  const completenessRule = validationReport?.find((r) => r.field === 'completeness');
  const triggered = completenessRule?.status === 'fail';
  return {
    triggered,
    reason: triggered ? completenessRule.reason : 'All required fields are present.',
  };
};

const evaluateAddressProofOutdated = (validationReport) => {
  const billDateRule = validationReport?.find((r) => r.field === 'billDate');
  const triggered = billDateRule?.status === 'fail';
  return {
    triggered,
    reason: triggered ? billDateRule.reason : 'Address proof recency check passed.',
  };
};

const evaluateAgeBelowMin = (validationReport) => {
  const ageRule = validationReport?.find((r) => r.field === 'dateOfBirth');
  const triggered = ageRule?.status === 'fail';
  return {
    triggered,
    reason: triggered ? ageRule.reason : 'Age requirement met.',
  };
};

const evaluateInvalidPan = (validationReport) => {
  const panRule = validationReport?.find((r) => r.field === 'panNumber');
  const triggered = panRule?.status === 'fail';
  return {
    triggered,
    reason: triggered ? panRule.reason : 'PAN format check passed or not applicable.',
  };
};

// ─── Master scorer ────────────────────────────────────────────────────────────
/**
 * computeRiskScore
 * Evaluates all risk rules against the verification record data
 * and returns a score, band, and full breakdown.
 *
 * @param {object} params
 * @param {Array}  params.validationReport — array of { field, status, reason }
 * @param {object} params.amlResult        — AML screening result object
 * @param {string} params.documentType     — classified document type
 * @returns {{ riskScore: number, riskBand: string, riskBreakdown: Array }}
 */
const computeRiskScore = ({ validationReport = [], amlResult = {}, documentType }) => {
  const riskBreakdown = [];
  let totalScore = 0;

  // Map each RISK_RULE id to its evaluator function
  const evaluators = {
    SANCTIONS_MATCH:        () => evaluateSanctionsMatch(amlResult),
    DOCUMENT_EXPIRED:       () => evaluateDocumentExpired(validationReport),
    NAME_MISMATCH:          () => evaluateNameMismatch(validationReport),
    MISSING_REQUIRED_FIELDS:() => evaluateMissingFields(validationReport),
    ADDRESS_PROOF_OUTDATED: () => evaluateAddressProofOutdated(validationReport),
    AGE_BELOW_18:           () => evaluateAgeBelowMin(validationReport),
    INVALID_PAN_FORMAT:     () => evaluateInvalidPan(validationReport),
  };

  for (const rule of RISK_RULES) {
    const evaluator = evaluators[rule.id];
    if (!evaluator) continue;

    const { triggered, reason } = evaluator();

    if (triggered) {
      totalScore += rule.points;
      riskBreakdown.push({
        rule: rule.description,
        pointsAdded: rule.points,
        reason,
      });
    }
  }

  // Cap score at 100
  const riskScore = Math.min(totalScore, 100);
  const riskBand  = assignRiskBand(riskScore);

  return { riskScore, riskBand, riskBreakdown };
};

module.exports = { computeRiskScore, assignRiskBand, RISK_RULES };