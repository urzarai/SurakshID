// server.js
// Entry point for the SurakshID backend server.
// Initializes Express, connects to MongoDB, registers middleware,
// mounts all API routes, initializes watchlist data, and starts the HTTP server.

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initWatchlists } = require('./services/watchlistService');

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// --- Core Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health Check Route ---
app.get('/', (req, res) => {
  res.json({ success: true, message: 'SurakshID API is running', version: '1.0.0' });
});

// --- Watchlist Status Route ---
app.get('/api/watchlist-status', (req, res) => {
  const { getWatchlistStatus } = require('./services/watchlistService');
  res.json({ success: true, data: getWatchlistStatus() });
});

// --- API Routes ---
const uploadRoutes   = require('./routes/uploadRoutes');
const classifyRoutes = require('./routes/classifyRoutes');
const extractRoutes  = require('./routes/extractRoutes');
const validateRoutes = require('./routes/validateRoutes');
const screenRoutes   = require('./routes/screenRoutes');
const scoreRoutes    = require('./routes/scoreRoutes');

console.log('uploadRoutes type:',   typeof uploadRoutes);
console.log('classifyRoutes type:', typeof classifyRoutes);
console.log('extractRoutes type:',  typeof extractRoutes);
console.log('validateRoutes type:', typeof validateRoutes);
console.log('screenRoutes type:',   typeof screenRoutes);
console.log('scoreRoutes type:',    typeof scoreRoutes);

app.use('/api/upload',   uploadRoutes);
app.use('/api/classify', classifyRoutes);
app.use('/api/extract',  extractRoutes);
app.use('/api/validate', validateRoutes);
app.use('/api/screen',   screenRoutes);
app.use('/api/score',    scoreRoutes);
// app.use('/api/report',   require('./routes/reportRoutes'));
// app.use('/api/audit',    require('./routes/auditRoutes'));

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// --- Start Server then Initialize Watchlists ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`SurakshID server running on port ${PORT}`);
  await initWatchlists();
});