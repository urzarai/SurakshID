// utils/ocrUtils.js
// Handles OCR for both image files and PDFs.
// PDFs are converted to PNG images using pdftoppm (from poppler-utils)
// called directly via child_process — works on both Windows and Linux.
// Each page image is then OCR'd by Tesseract and joined into one string.
// Falls back to PSM 6 if primary extraction returns minimal text.

const tesseract = require('node-tesseract-ocr');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');
const { execSync } = require('child_process');

// ─── Binary paths ─────────────────────────────────────────────────────────────
const IS_WIN = os.platform() === 'win32';

const TESSERACT_BINARY = IS_WIN
  ? '"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"'
  : 'tesseract';

const PDFTOPPM_BINARY = IS_WIN
  ? '"C:\\poppler\\poppler-25.12.0\\Library\\bin\\pdftoppm.exe"'
  : 'pdftoppm';

const OCR_CONFIG_PRIMARY = {
  lang:   'eng',
  oem:    1,
  psm:    3,
  binary: TESSERACT_BINARY,
};

const OCR_CONFIG_FALLBACK = {
  lang:   'eng',
  oem:    1,
  psm:    6,
  binary: TESSERACT_BINARY,
};

// ─── OCR a single image file ──────────────────────────────────────────────────
const ocrImage = async (imagePath) => {
  let text = await tesseract.recognize(imagePath, OCR_CONFIG_PRIMARY);
  text = text.trim();

  if (text.length < 30) {
    text = await tesseract.recognize(imagePath, OCR_CONFIG_FALLBACK);
    text = text.trim();
  }

  return text;
};

// ─── Convert PDF pages to images using pdftoppm directly ─────────────────────
const extractTextFromPdf = async (filePath) => {
  const outputDir    = path.dirname(filePath);
  const baseName     = path.basename(filePath, path.extname(filePath));
  const outputPrefix = path.join(outputDir, baseName + '_page');

  // Call pdftoppm directly via child_process
  // -r 200 = 200 DPI resolution — good balance of quality vs speed
  // -png   = output PNG files
  const cmd = `${PDFTOPPM_BINARY} -r 200 -png "${filePath}" "${outputPrefix}"`;

  try {
    execSync(cmd, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`pdftoppm failed: ${err.message}`);
  }

  // Collect all generated page images
  const pageImages = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith(baseName + '_page') && f.endsWith('.png'))
    .sort()
    .map((f) => path.join(outputDir, f));

  if (pageImages.length === 0) {
    throw new Error('PDF conversion produced no images. Check Poppler installation.');
  }

  // OCR each page and clean up
  const pageTexts = [];
  for (const imgPath of pageImages) {
    const text = await ocrImage(imgPath);
    if (text) pageTexts.push(text);
    fs.unlinkSync(imgPath);
  }

  return pageTexts.join('\n\n');
};

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * extractTextFromFile
 * Detects file type and routes to the correct OCR method.
 * @param {string} filePath — absolute path to the uploaded file
 * @returns {Promise<string>} — extracted text
 */
const extractTextFromFile = async (filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      return await extractTextFromPdf(filePath);
    }

    return await ocrImage(filePath);

  } catch (error) {
    throw new Error(`OCR failed: ${error.message}`);
  }
};

module.exports = { extractTextFromFile };