// pages/AuditPage.jsx
// Displays the full audit log of all KYC verifications.
// Shows summary stat cards at the top (total, risk bands, AML hits).
// Below that: a filterable, paginated table of all verification records.
// Filters: search by ID, risk band, document type, date range.
// Each row links to the full result page for that verification.
// Data is fetched from /api/audit and /api/audit/stats.

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuditLog, getAuditStats } from '../services/api';
import Loader from '../components/Loader';

// ─── Risk band helpers ────────────────────────────────────────────────────────
const riskClass = (band) => {
  if (band === 'Low')    return 'low';
  if (band === 'Medium') return 'medium';
  if (band === 'High')   return 'high';
  return 'neutral';
};

// ─── Status badge colour ──────────────────────────────────────────────────────
const statusClass = (status) => {
  if (status === 'complete') return 'low';
  if (status === 'scored')   return 'medium';
  return 'neutral';
};

// ─── Document types and risk bands for filter dropdowns ───────────────────────
const DOCUMENT_TYPES = [
  'Passport',
  'National ID',
  'PAN Card',
  'Utility Bill',
  'Company Registration Certificate',
  'Bank Statement',
];

const RISK_BANDS = ['Low', 'Medium', 'High'];

const PIPELINE_STATUSES = [
  'uploaded',
  'classified',
  'extracted',
  'validated',
  'screened',
  'scored',
  'complete',
];

// ─── Stat card component ──────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, accent }) => (
  <div
    className="stat-card"
    style={accent ? { borderTop: `3px solid ${accent}` } : {}}
  >
    <div className="stat-card-label">{label}</div>
    <div
      className="stat-card-value"
      style={accent ? { color: accent } : {}}
    >
      {value ?? '—'}
    </div>
    {sub && <div className="stat-card-sub">{sub}</div>}
  </div>
);

export default function AuditPage() {
  const navigate = useNavigate();

  // ── Stats state ──────────────────────────────────────────────────────────────
  const [stats, setStats]           = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Table state ──────────────────────────────────────────────────────────────
  const [records, setRecords]       = useState([]);
  const [pagination, setPagination] = useState(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError]           = useState('');

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search, setSearch]         = useState('');
  const [riskBand, setRiskBand]     = useState('');
  const [documentType, setDocumentType] = useState('');
  const [status, setStatus]         = useState('');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [page, setPage]             = useState(1);
  const LIMIT = 10;

  // ── Fetch stats ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getAuditStats();
        setStats(res.data.data);
      } catch (err) {
        console.error('Stats fetch failed:', err.message);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // ── Fetch audit log ───────────────────────────────────────────────────────────
  const fetchAuditLog = useCallback(async () => {
    setTableLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: LIMIT,
        ...(search       && { search }),
        ...(riskBand     && { riskBand }),
        ...(documentType && { documentType }),
        ...(status       && { status }),
        ...(startDate    && { startDate }),
        ...(endDate      && { endDate }),
      };
      const res = await getAuditLog(params);
      setRecords(res.data.data.records);
      setPagination(res.data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit log.');
    } finally {
      setTableLoading(false);
    }
  }, [page, search, riskBand, documentType, status, startDate, endDate]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  // ── Reset to page 1 when filters change ──────────────────────────────────────
  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setRiskBand('');
    setDocumentType('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasActiveFilters =
    search || riskBand || documentType || status || startDate || endDate;

  return (
    <div className="page-content">
      <div className="bg-glow" />
      <div className="container">

        {/* ── Page Header ── */}
        <div className="page-header">
          <div className="page-header-eyebrow">
            <span className="page-header-eyebrow-dot" />
            Compliance Records
          </div>
          <h1>Audit Log</h1>
          <p>
            Full history of all KYC verifications. Filter by risk, document type,
            or date range. Click any row to view the full result.
          </p>
        </div>

        {/* ── Stat Cards ── */}
        {statsLoading ? (
          <div style={{ marginBottom: '24px' }}>
            <Loader text="Loading statistics..." />
          </div>
        ) : stats ? (
          <div className="stat-grid" style={{ marginBottom: '28px' }}>
            <StatCard
              label="Total Verifications"
              value={stats.totalVerifications}
              sub="All time"
            />
            <StatCard
              label="Low Risk"
              value={stats.riskSummary?.Low ?? 0}
              sub="Cleared for onboarding"
              accent="var(--color-risk-low)"
            />
            <StatCard
              label="Medium Risk"
              value={stats.riskSummary?.Medium ?? 0}
              sub="Flagged for review"
              accent="var(--color-risk-medium)"
            />
            <StatCard
              label="High Risk"
              value={stats.riskSummary?.High ?? 0}
              sub="Escalated to compliance"
              accent="var(--color-risk-high)"
            />
            <StatCard
              label="AML Hits"
              value={stats.amlHits ?? 0}
              sub="Watchlist matches found"
              accent={stats.amlHits > 0 ? 'var(--color-risk-high)' : undefined}
            />
          </div>
        ) : null}

        {/* ── Filters ── */}
        <div
          className="card"
          style={{ marginBottom: '20px' }}
        >
          <div className="card-header">
            <span className="card-title">Filters</span>
            {hasActiveFilters && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={clearFilters}
              >
                ✕ Clear all
              </button>
            )}
          </div>
          <div className="card-body">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px',
              }}
            >
              {/* Search */}
              <div className="form-group">
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Verification ID or Customer ID"
                  value={search}
                  onChange={handleFilterChange(setSearch)}
                />
              </div>

              {/* Risk Band */}
              <div className="form-group">
                <label className="form-label">Risk Band</label>
                <select
                  className="form-select"
                  value={riskBand}
                  onChange={handleFilterChange(setRiskBand)}
                >
                  <option value="">All bands</option>
                  {RISK_BANDS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Document Type */}
              <div className="form-group">
                <label className="form-label">Document Type</label>
                <select
                  className="form-select"
                  value={documentType}
                  onChange={handleFilterChange(setDocumentType)}
                >
                  <option value="">All types</option>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Pipeline Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={handleFilterChange(setStatus)}
                >
                  <option value="">All statuses</option>
                  {PIPELINE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div className="form-group">
                <label className="form-label">From Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={handleFilterChange(setStartDate)}
                />
              </div>

              {/* End Date */}
              <div className="form-group">
                <label className="form-label">To Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={handleFilterChange(setEndDate)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="card" style={{ marginBottom: '48px' }}>
          <div className="card-header">
            <span className="card-title">Verification Records</span>
            {pagination && (
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  fontWeight: 500,
                }}
              >
                {pagination.total} total record{pagination.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {tableLoading ? (
            <Loader text="Fetching records..." />
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🗂️</div>
              <h3>No records found</h3>
              <p>
                {hasActiveFilters
                  ? 'Try adjusting your filters.'
                  : 'No verifications have been run yet.'}
              </p>
              {hasActiveFilters && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: '16px' }}
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrapper" style={{ borderRadius: '0', border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Verification ID</th>
                      <th>Customer ID</th>
                      <th>Document Type</th>
                      <th>Risk Band</th>
                      <th>Score</th>
                      <th>AML</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr
                        key={record._id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/result/${record.verificationId}`)}
                      >
                        {/* Verification ID */}
                        <td>
                          <span className="mono">{record.verificationId}</span>
                        </td>

                        {/* Customer ID */}
                        <td>
                          <span
                            style={{
                              fontSize: '13px',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            {record.customerId || '—'}
                          </span>
                        </td>

                        {/* Document Type */}
                        <td>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {record.documentType || '—'}
                          </span>
                        </td>

                        {/* Risk Band */}
                        <td>
                          {record.riskBand ? (
                            <span className={`badge badge-${riskClass(record.riskBand)}`}>
                              {record.riskBand}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-faint)', fontSize: '12px' }}>—</span>
                          )}
                        </td>

                        {/* Score */}
                        <td>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color:
                                record.riskBand === 'Low'
                                  ? 'var(--color-risk-low)'
                                  : record.riskBand === 'Medium'
                                  ? 'var(--color-risk-medium)'
                                  : record.riskBand === 'High'
                                  ? 'var(--color-risk-high)'
                                  : 'var(--color-text-muted)',
                            }}
                          >
                            {record.riskScore ?? '—'}
                          </span>
                        </td>

                        {/* AML Hit */}
                        <td>
                          {record.amlResult?.matched ? (
                            <span className="badge badge-high">⚠ Hit</span>
                          ) : record.amlResult?.screened ? (
                            <span className="badge badge-low">✓ Clear</span>
                          ) : (
                            <span
                              style={{
                                color: 'var(--color-text-faint)',
                                fontSize: '12px',
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Pipeline Status */}
                        <td>
                          <span className={`badge badge-${statusClass(record.status)}`}>
                            {record.status}
                          </span>
                        </td>

                        {/* Date */}
                        <td>
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--color-text-muted)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {record.createdAt
                              ? new Date(record.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>

                        {/* View arrow */}
                        <td>
                          <span
                            style={{
                              color: 'var(--color-accent)',
                              fontSize: '14px',
                              fontWeight: 600,
                            }}
                          >
                            →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              {pagination && pagination.totalPages > 1 && (
                <div className="pagination">
                  <span className="pagination-info">
                    Showing {(pagination.currentPage - 1) * LIMIT + 1}–
                    {Math.min(pagination.currentPage * LIMIT, pagination.total)} of{' '}
                    {pagination.total} records
                  </span>
                  <div className="pagination-controls">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={!pagination.hasPrevPage}
                    >
                      ← Prev
                    </button>
                    {/* Page number buttons */}
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === pagination.totalPages ||
                          Math.abs(p - pagination.currentPage) <= 1
                      )
                      .reduce((acc, p, i, arr) => {
                        if (i > 0 && p - arr[i - 1] > 1) {
                          acc.push('...');
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '...' ? (
                          <span
                            key={`ellipsis-${i}`}
                            style={{
                              padding: '0 4px',
                              color: 'var(--color-text-muted)',
                              fontSize: '13px',
                            }}
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            className={`btn btn-sm ${
                              p === pagination.currentPage
                                ? 'btn-primary'
                                : 'btn-secondary'
                            }`}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!pagination.hasNextPage}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}