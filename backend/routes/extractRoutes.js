// routes/extractRoutes.js
// Defines the POST /api/extract route.
// Expects a verificationId in the request body.
// Delegates to extractController which selects the correct prompt,
// calls Groq, and stores the structured extracted fields in MongoDB.

const express = require('express');
const router = express.Router();
const { extractFields } = require('../controllers/extractController');

// POST /api/extract
router.post('/', extractFields);

module.exports = router;