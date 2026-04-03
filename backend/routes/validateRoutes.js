// routes/validateRoutes.js
// Defines the POST /api/validate route.
// Expects a verificationId in the request body.
// Delegates to validateController which runs all 6 KYC validation rules
// and saves the report to MongoDB.

const express = require('express');
const router = express.Router();
const { validateDocument } = require('../controllers/validateController');

// POST /api/validate
router.post('/', validateDocument);

module.exports = router;