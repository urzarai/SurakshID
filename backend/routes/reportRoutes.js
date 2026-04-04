// routes/reportRoutes.js
// Defines two report routes:
//   POST /api/report/generate/:verificationId — triggers PDF generation
//   GET  /api/report/download/:verificationId — downloads the generated PDF

const express = require('express');
const router = express.Router();
const { generateReport, downloadReport } = require('../controllers/reportController');

// POST /api/report/generate/:verificationId
router.post('/generate/:verificationId', generateReport);

// GET /api/report/download/:verificationId
router.get('/download/:verificationId', downloadReport);

module.exports = router;