// routes/auditRoutes.js
// Defines three audit log routes:
//   GET /api/audit/stats          — aggregate dashboard statistics
//   GET /api/audit                — paginated, filterable verification list
//   GET /api/audit/:verificationId — full single verification record
//
// Note: /stats must be defined before /:verificationId
// so Express does not treat "stats" as a verificationId param.

const express = require('express');
const router  = express.Router();
const {
  getAuditLog,
  getVerificationById,
  getAuditStats,
} = require('../controllers/auditController');

// GET /api/audit/stats
router.get('/stats', getAuditStats);

// GET /api/audit
router.get('/', getAuditLog);

// GET /api/audit/:verificationId
router.get('/:verificationId', getVerificationById);

module.exports = router;