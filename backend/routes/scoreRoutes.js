// routes/scoreRoutes.js
// Defines two routes for the risk scoring step:
//   POST /api/score             — compute and save risk score for a verification
//   GET  /api/score/:verificationId — fetch existing risk score without re-computing

const express = require('express');
const router = express.Router();
const { scoreDocument, getScore } = require('../controllers/scoreController');

// POST /api/score
router.post('/', scoreDocument);

// GET /api/score/:verificationId
router.get('/:verificationId', getScore);

module.exports = router;