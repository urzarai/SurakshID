// server.js
// Entry point for the SurakshID backend server.
// Initializes Express, connects to MongoDB, registers all middleware,
// mounts all API routes, loads watchlist data, and starts the HTTP server.
// This is the final backend version — all routes are active.

const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const fs      = require('fs');
const path    = require('path');

dotenv.config();

const connectDB          = require('./config/db');
const { initWatchlists } = require('./services/watchlistService');

// ─── Ensure required directories exist on startup ─────────────────────────────
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

// ─── Force CORS headers on every response including errors ────────────────────
// Set raw headers before Express routing so even crash responses include them
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin &&
    (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── CORS via express/cors package ────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Crash safety ─────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ success: true, message: 'SurakshID API is running', version: '1.0.0' });
});

// ─── Watchlist Status ─────────────────────────────────────────────────────────
app.get('/api/watchlist-status', (req, res) => {
  const { getWatchlistStatus } = require('./services/watchlistService');
  res.json({ success: true, data: getWatchlistStatus() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/upload',   require('./routes/uploadRoutes'));
app.use('/api/classify', require('./routes/classifyRoutes'));
app.use('/api/extract',  require('./routes/extractRoutes'));
app.use('/api/validate', require('./routes/validateRoutes'));
app.use('/api/screen',   require('./routes/screenRoutes'));
app.use('/api/score',    require('./routes/scoreRoutes'));
app.use('/api/report',   require('./routes/reportRoutes'));
app.use('/api/audit',    require('./routes/auditRoutes'));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
  });
});

// ─── Start Server then Initialize Watchlists ──────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`SurakshID server running on port ${PORT}`);
  await initWatchlists();
});