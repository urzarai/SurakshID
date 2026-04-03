// utils/ocrUtils.js
// Utility wrapper around node-tesseract-ocr.
// Accepts a local file path and returns the raw extracted text string.
// All OCR configuration is centralized here so it can be tuned in one place.
// Note: binary path is quoted to handle the space in "Program Files" on Windows.

const tesseract = require('node-tesseract-ocr');

const OCR_CONFIG = {
  lang: 'eng',
  oem: 1,
  psm: 3,
  binary: '"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"',
};

/**
 * extractTextFromFile
 * Runs Tesseract OCR on the given file path and returns extracted text.
 * @param {string} filePath — absolute or relative path to the uploaded file
 * @returns {Promise<string>} — raw OCR text
 */
const extractTextFromFile = async (filePath) => {
  try {
    const text = await tesseract.recognize(filePath, OCR_CONFIG);
    return text.trim();
  } catch (error) {
    throw new Error(`OCR failed: ${error.message}`);
  }
};

module.exports = { extractTextFromFile };