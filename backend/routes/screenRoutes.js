// routes/screenRoutes.js
// Defines the POST /api/screen route.
// Expects a verificationId in the request body.
// Delegates to screenController which runs fuzzy AML name matching
// against OFAC and UN watchlists and saves the result to MongoDB.

const express = require('express');
const router = express.Router();
const { screenDocument } = require('../controllers/screenController');

// POST /api/screen
router.post('/', screenDocument);

module.exports = router;