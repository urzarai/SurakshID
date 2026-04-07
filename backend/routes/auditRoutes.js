// routes/auditRoutes.js
// Defines audit log routes:
//   GET    /api/audit/stats          — aggregate dashboard statistics
//   GET    /api/audit                — paginated, filterable verification list
//   GET    /api/audit/:verificationId — full single verification record
//   DELETE /api/audit/clear          — delete all verification records
//
// Note: /stats and /clear must be defined before /:verificationId
// so Express does not treat them as verificationId params.

const express = require('express');
const router  = express.Router();
const {
  getAuditLog,
  getVerificationById,
  getAuditStats,
  clearAuditLog,
} = require('../controllers/auditController');

// GET /api/audit/stats
router.get('/stats', getAuditStats);

// DELETE /api/audit/clear
router.delete('/clear', clearAuditLog);

// GET /api/audit
router.get('/', getAuditLog);

// GET /api/audit/:verificationId
router.get('/:verificationId', getVerificationById);

module.exports = router;