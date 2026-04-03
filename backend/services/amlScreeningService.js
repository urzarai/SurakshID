// services/amlScreeningService.js
// Core AML screening logic.
// Uses fuse.js to fuzzy-match a customer's name against both
// the OFAC Consolidated list and the UN Security Council list
// loaded in memory by watchlistService.js.
//
// Returns the highest scoring match found across both lists,
// along with match metadata: source, score, sanction type.
// A match score threshold of 0.35 is used (fuse.js: lower = more similar).

const Fuse = require('fuse.js');
const { getOfacList, getUnList } = require('./watchlistService');

// ─── Fuse.js configuration ────────────────────────────────────────────────────
// threshold: 0.35 means only fairly close matches are returned
// lower threshold = stricter matching
const FUSE_OPTIONS = {
  includeScore: true,
  threshold: 0.35,
  keys: ['name'],
  minMatchCharLength: 3,
  shouldSort: true,
};

// Minimum fuse score to flag as a match (fuse score: 0=perfect, 1=no match)
const MATCH_SCORE_THRESHOLD = 0.35;

/**
 * screenName
 * Screens a name against both OFAC and UN watchlists using fuzzy matching.
 * Returns the best match found, or a no-match result.
 *
 * @param {string} name — full name to screen
 * @returns {object} — AML result object
 */
const screenName = (name) => {
  if (!name || name.trim().length === 0) {
    return {
      matched: false,
      matchedName: null,
      listSource: null,
      matchScore: null,
      sanctionType: null,
      screened: false,
      reason: 'No name provided for screening.',
    };
  }

  const cleanName = name.trim().toUpperCase();

  const ofacList = getOfacList();
  const unList   = getUnList();

  if (ofacList.length === 0 && unList.length === 0) {
    return {
      matched: false,
      matchedName: null,
      listSource: null,
      matchScore: null,
      sanctionType: null,
      screened: false,
      reason: 'Watchlists not loaded yet. Try again in a moment.',
    };
  }

  let bestMatch = null;
  let bestScore = 1; // fuse score starts at 1 (worst), goes to 0 (best)

  // ── Screen against OFAC ──
  if (ofacList.length > 0) {
    // Normalize OFAC names to uppercase for consistent matching
    const normalizedOfac = ofacList.map((e) => ({
      ...e,
      name: e.name.toUpperCase(),
    }));

    const ofacFuse = new Fuse(normalizedOfac, FUSE_OPTIONS);
    const ofacResults = ofacFuse.search(cleanName);

    if (ofacResults.length > 0) {
      const top = ofacResults[0];
      if (top.score < bestScore && top.score <= MATCH_SCORE_THRESHOLD) {
        bestScore = top.score;
        bestMatch = {
          matched: true,
          matchedName: top.item.name,
          listSource: 'OFAC Consolidated',
          // Convert fuse score (0=best) to similarity percentage (100=best)
          matchScore: parseFloat((1 - top.score).toFixed(2)),
          sanctionType: top.item.type || 'Unknown',
          program: top.item.program || null,
          screened: true,
        };
      }
    }
  }

  // ── Screen against UN ──
  if (unList.length > 0) {
    const normalizedUn = unList.map((e) => ({
      ...e,
      name: e.name.toUpperCase(),
    }));

    const unFuse = new Fuse(normalizedUn, FUSE_OPTIONS);
    const unResults = unFuse.search(cleanName);

    if (unResults.length > 0) {
      const top = unResults[0];
      if (top.score < bestScore && top.score <= MATCH_SCORE_THRESHOLD) {
        bestScore = top.score;
        bestMatch = {
          matched: true,
          matchedName: top.item.name,
          listSource: 'UN Security Council',
          matchScore: parseFloat((1 - top.score).toFixed(2)),
          sanctionType: top.item.type || 'Unknown',
          designation: top.item.designation || null,
          screened: true,
        };
      }
    }
  }

  // ── No match found ──
  if (!bestMatch) {
    return {
      matched: false,
      matchedName: null,
      listSource: null,
      matchScore: null,
      sanctionType: null,
      screened: true,
      reason: 'No matches found in OFAC or UN sanctions lists.',
    };
  }

  return bestMatch;
};

/**
 * extractNameForScreening
 * Pulls the most relevant name field from extractedFields
 * based on the document type.
 *
 * @param {object} extractedFields
 * @param {string} documentType
 * @returns {string|null}
 */
const extractNameForScreening = (extractedFields, documentType) => {
  if (!extractedFields) return null;

  switch (documentType) {
    case 'Passport':
    case 'National ID':
    case 'PAN Card':
      return extractedFields.fullName || null;

    case 'Utility Bill':
      return extractedFields.nameOnBill || null;

    case 'Bank Statement':
      return extractedFields.accountHolderName || null;

    case 'Company Registration Certificate':
      return extractedFields.companyName || null;

    default:
      return (
        extractedFields.fullName ||
        extractedFields.nameOnBill ||
        extractedFields.accountHolderName ||
        extractedFields.companyName ||
        null
      );
  }
};

module.exports = { screenName, extractNameForScreening };