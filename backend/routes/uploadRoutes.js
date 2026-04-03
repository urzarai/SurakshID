// routes/uploadRoutes.js
// Defines the /api/upload route.
// Uses Multer middleware to handle single file upload under field name 'document',
// then passes control to uploadController.

const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { uploadDocument } = require('../controllers/uploadController');

// POST /api/upload
// Field name for the file must be 'document'
router.post('/', upload.single('document'), uploadDocument);

module.exports = router;