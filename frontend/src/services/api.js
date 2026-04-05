// services/api.js
// Centralized Axios API client for the SurakshID frontend.
// All backend API calls go through this file.
// Base URL reads from the Vite environment variable VITE_API_URL.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180000, // 3 minutes — OCR + LLM on Render free tier can be slow
});

// ─── Upload & Pipeline ────────────────────────────────────────────────────────
export const uploadDocument = (formData) =>
  api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });

export const classifyDocument = (verificationId) =>
  api.post('/api/classify', { verificationId });

export const extractFields = (verificationId) =>
  api.post('/api/extract', { verificationId });

export const validateDocument = (verificationId) =>
  api.post('/api/validate', { verificationId });

export const screenDocument = (verificationId) =>
  api.post('/api/screen', { verificationId });

export const scoreDocument = (verificationId) =>
  api.post('/api/score', { verificationId });

// ─── Report ───────────────────────────────────────────────────────────────────
export const generateReport = (verificationId) =>
  api.post(`/api/report/generate/${verificationId}`);

export const getReportDownloadUrl = (verificationId) =>
  `${BASE_URL}/api/report/download/${verificationId}`;

// ─── Audit Log ────────────────────────────────────────────────────────────────
export const getAuditLog = (params) =>
  api.get('/api/audit', { params });

export const getAuditStats = () =>
  api.get('/api/audit/stats');

export const getVerificationById = (verificationId) =>
  api.get(`/api/audit/${verificationId}`);

// ─── Watchlist Status ─────────────────────────────────────────────────────────
export const getWatchlistStatus = () =>
  api.get('/api/watchlist-status');

// ─── Backend wake-up ping ─────────────────────────────────────────────────────
export const pingBackend = () =>
  api.get('/').catch(() => null);

export const clearAuditLog = () =>
  api.delete('/api/audit/clear', { data: { confirmClear: 'CONFIRM' } });