// server.js
// Entry point for the SurakshID backend server.
// Initializes Express, connects to MongoDB, registers all middleware,
// mounts all API routes, loads watchlist data, and starts the HTTP server.
// This is the final backend version — all routes are active.

const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const connectDB        = require('./config/db');
const { initWatchlists } = require('./services/watchlistService');

dotenv.config();

// Ensure required directories exist on server startup
const fs   = require('fs');
const path = require('path');

const requiredDirs = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'reports'),
];

requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

const app = express();

// Connect to MongoDB
connectDB();

// --- Core Middleware ---
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://suraksh-id.vercel.app',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health Check ---
app.get('/', (req, res) => {
  res.json({ success: true, message: 'SurakshID API is running', version: '1.0.0' });
});

// --- Watchlist Status ---
app.get('/api/watchlist-status', (req, res) => {
  const { getWatchlistStatus } = require('./services/watchlistService');
  res.json({ success: true, data: getWatchlistStatus() });
});

// --- API Routes ---
app.use('/api/upload',   require('./routes/uploadRoutes'));
app.use('/api/classify', require('./routes/classifyRoutes'));
app.use('/api/extract',  require('./routes/extractRoutes'));
app.use('/api/validate', require('./routes/validateRoutes'));
app.use('/api/screen',   require('./routes/screenRoutes'));
app.use('/api/score',    require('./routes/scoreRoutes'));
app.use('/api/report',   require('./routes/reportRoutes'));
app.use('/api/audit',    require('./routes/auditRoutes'));

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
  });
});

// --- Start Server then Initialize Watchlists ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`SurakshID server running on port ${PORT}`);
  await initWatchlists();
});