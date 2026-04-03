// routes/classifyRoutes.js
// Defines the POST /api/classify route.
// Expects a verificationId in the request body.
// Delegates to classifyController which calls Groq and updates MongoDB.

const express = require('express');
const router = express.Router();
const { classifyDocument } = require('../controllers/classifyController');

// POST /api/classify
router.post('/', classifyDocument);

module.exports = router;