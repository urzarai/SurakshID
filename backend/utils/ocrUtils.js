// utils/ocrUtils.js
// Handles OCR for both image files and PDFs.
// PDFs are converted to PNG images via pdf-poppler first,
// then each page is OCR'd by Tesseract and joined into one string.
// Images are passed directly to Tesseract.
// Falls back to PSM 6 if primary extraction returns minimal text.

const tesseract = require('node-tesseract-ocr');
const path      = require('path');
const fs        = require('fs');

const OCR_CONFIG_PRIMARY = {
  lang:   'eng',
  oem:    1,
  psm:    3,
  binary: '"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"',
};

const OCR_CONFIG_FALLBACK = {
  lang:   'eng',
  oem:    1,
  psm:    6,
  binary: '"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"',
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

// ─── Convert PDF to images then OCR each page ────────────────────────────────
const extractTextFromPdf = async (filePath) => {
  const { default: poppler } = await import('pdf-poppler');

  const outputDir = path.dirname(filePath);
  const baseName  = path.basename(filePath, path.extname(filePath));

  const opts = {
    format:     'png',
    out_dir:    outputDir,
    out_prefix: baseName + '_page',
    page:       null,
    bin:        'C:\\poppler\\poppler-25.12.0\\Library\\bin\\pdftoppm.exe',
  };

  await poppler.convert(filePath, opts);

  // Collect all generated page images
  const pageImages = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith(baseName + '_page') && f.endsWith('.png'))
    .sort()
    .map((f) => path.join(outputDir, f));

  if (pageImages.length === 0) {
    throw new Error('PDF conversion produced no images. Check Poppler installation.');
  }

  // OCR each page and clean up the image after
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