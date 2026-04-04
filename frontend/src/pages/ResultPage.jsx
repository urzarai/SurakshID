// pages/ResultPage.jsx
// Displays the full verification result after the pipeline completes.
// Fetches the verification record from /api/audit/:verificationId.
// Shows four sections:
//   1. Verification summary header with risk badge
//   2. Extracted fields card
//   3. Validation report table (pass/fail per rule)
//   4. AML screening result + Risk score with breakdown
// Also provides a Download PDF Report button.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVerificationById, generateReport, getReportDownloadUrl } from '../services/api';
import Loader from '../components/Loader';

// ─── Helper: format field keys into readable labels ───────────────────────────
const formatKey = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

// ─── Helper: flatten nested extracted fields ──────────────────────────────────
const flattenFields = (fields, prefix = '') => {
  const rows = [];
  for (const [key, value] of Object.entries(fields)) {
    const label = prefix ? `${prefix} › ${formatKey(key)}` : formatKey(key);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      rows.push(...flattenFields(value, label));
    } else {
      rows.push({ label, value: value ?? '—' });
    }
  }
  return rows;
};

// ─── Risk band helpers ────────────────────────────────────────────────────────
const riskClass = (band) => {
  if (band === 'Low')    return 'low';
  if (band === 'Medium') return 'medium';
  return 'high';
};

const riskRecommendation = (band) => {
  if (band === 'Low')    return 'Proceed with customer onboarding.';
  if (band === 'Medium') return 'Flag for manual review before onboarding.';
  return 'Escalate to compliance team immediately. Do not onboard.';
};

// ─── Section wrapper component ────────────────────────────────────────────────
const Section = ({ title, badge, children }) => (
  <div className="card" style={{ marginBottom: '20px' }}>
    <div className="card-header">
      <span className="card-title">{title}</span>
      {badge}
    </div>
    <div className="card-body">{children}</div>
  </div>
);

export default function ResultPage() {
  const { verificationId } = useParams();
  const navigate = useNavigate();

  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfReady, setPdfReady]       = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getVerificationById(verificationId);
        setData(res.data.data);
        if (res.data.data.pdfReportPath) setPdfReady(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load verification result.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [verificationId]);

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      await generateReport(verificationId);
      setPdfReady(true);
    } catch (err) {
      setError('PDF generation failed. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = () => {
    const url = getReportDownloadUrl(verificationId);
    window.open(url, '_blank');
  };

  if (loading) return (
    <div className="page-content">
      <div className="container">
        <Loader text="Loading verification results..." />
      </div>
    </div>
  );

  if (error) return (
    <div className="page-content">
      <div className="container">
        <div className="page-header">
          <h1>Something went wrong</h1>
        </div>
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>← Back to Upload</button>
      </div>
    </div>
  );

  const {
    documentType,
    customerId,
    uploadedFileName,
    createdAt,
    extractedFields  = {},
    validationReport = [],
    validationStatus,
    amlResult        = {},
    riskScore,
    riskBand,
    riskBreakdown    = [],
    status,
  } = data;

  const band        = riskBand || 'Unknown';
  const fieldRows   = flattenFields(extractedFields);
  const passCount   = validationReport.filter((r) => r.status === 'pass').length;
  const failCount   = validationReport.filter((r) => r.status === 'fail').length;

  return (
    <div className="page-content">
      <div className="bg-glow" />
      <div className="container">

        {/* ── Page Header ── */}
        <div className="page-header">
          <div className="page-header-eyebrow">
            <span className="page-header-eyebrow-dot" />
            Verification Result
          </div>
          <h1>Verification Complete</h1>
          <p>
            Full pipeline results for{' '}
            <span className="mono">{verificationId}</span>
          </p>
        </div>

        {/* ── Top action bar ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            ← New Verification
          </button>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {!pdfReady ? (
              <button
                className="btn btn-secondary"
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
              >
                {generatingPdf ? (
                  <>
                    <div
                      className="spinner"
                      style={{ width: '14px', height: '14px', borderWidth: '2px' }}
                    />
                    Generating...
                  </>
                ) : (
                  '⬇ Generate PDF Report'
                )}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleDownloadPdf}>
                ⬇ Download PDF Report
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/audit')}
            >
              View Audit Log →
            </button>
          </div>
        </div>

        {/* ── Section 1: Summary header card ── */}
        <div
          className="card"
          style={{ marginBottom: '20px', overflow: 'hidden' }}
        >
          {/* Accent top bar */}
          <div
            style={{
              height: '4px',
              background:
                band === 'Low'
                  ? 'var(--color-risk-low)'
                  : band === 'Medium'
                  ? 'var(--color-risk-medium)'
                  : 'var(--color-risk-high)',
            }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0',
            }}
          >
            {[
              { label: 'Verification ID',  value: <span className="mono">{verificationId}</span> },
              { label: 'Document Type',    value: documentType  || '—' },
              { label: 'Customer ID',      value: customerId    || '—' },
              { label: 'Pipeline Status',  value: <span className="badge badge-neutral">{status}</span> },
              {
                label: 'Risk Band',
                value: (
                  <span className={`badge badge-${riskClass(band)}`}>
                    {band} Risk
                  </span>
                ),
              },
              {
                label: 'Submitted',
                value: createdAt
                  ? new Date(createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—',
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '20px 24px',
                  borderRight: '1px solid var(--color-border)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two column layout below ── */}
        <div
          className="result-two-col"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          {/* ── LEFT COLUMN ── */}
          <div>

            {/* Section 2 — Extracted Fields */}
            <Section
              title="Extracted Fields"
              badge={
                <span className="badge badge-neutral">
                  {fieldRows.length} fields
                </span>
              }
            >
              {fieldRows.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <p>No fields were extracted.</p>
                </div>
              ) : (
                <div>
                  {fieldRows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '10px 0',
                        borderBottom:
                          i < fieldRows.length - 1
                            ? '1px solid var(--color-border)'
                            : 'none',
                        gap: '12px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--color-text-muted)',
                          minWidth: '120px',
                          flexShrink: 0,
                        }}
                      >
                        {row.label}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--color-text)',
                          textAlign: 'right',
                          fontFamily:
                            typeof row.value === 'string' &&
                            /^[A-Z0-9]{5,}$/.test(row.value)
                              ? 'var(--font-mono)'
                              : 'inherit',
                        }}
                      >
                        {String(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Section 3 — AML Screening */}
            <Section
              title="AML Watchlist Screening"
              badge={
                amlResult?.matched ? (
                  <span className="badge badge-high">⚠ Hit Found</span>
                ) : (
                  <span className="badge badge-low">✓ Clear</span>
                )
              }
            >
              {/* Screened status row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  background: amlResult?.matched
                    ? 'var(--color-fail-bg)'
                    : 'var(--color-pass-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  border: amlResult?.matched
                    ? '1px solid rgba(220,38,38,0.2)'
                    : '1px solid rgba(5,150,105,0.2)',
                }}
              >
                <span style={{ fontSize: '20px' }}>
                  {amlResult?.matched ? '🚨' : '✅'}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: amlResult?.matched
                        ? 'var(--color-fail)'
                        : 'var(--color-pass)',
                    }}
                  >
                    {amlResult?.matched
                      ? 'Watchlist Match Detected'
                      : 'No Watchlist Match Found'}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-muted)',
                      marginTop: '2px',
                    }}
                  >
                    {amlResult?.matched
                      ? `Matched on ${amlResult.listSource}`
                      : 'Screened against OFAC Consolidated and UN Security Council lists'}
                  </div>
                </div>
              </div>

              {/* Match details if hit */}
              {amlResult?.matched && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Matched Name',   value: amlResult.matchedName },
                    { label: 'List Source',    value: amlResult.listSource },
                    { label: 'Match Score',    value: amlResult.matchScore },
                    { label: 'Sanction Type',  value: amlResult.sanctionType },
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--color-border)',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        {row.label}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--color-fail)' }}>
                        {String(row.value ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div>

            {/* Section 3 — Validation Report */}
            <Section
              title="Validation Report"
              badge={
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="badge badge-low">{passCount} passed</span>
                  {failCount > 0 && (
                    <span className="badge badge-high">{failCount} failed</span>
                  )}
                </div>
              }
            >
              {/* Overall status bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background:
                    validationStatus === 'passed'
                      ? 'var(--color-pass-bg)'
                      : 'var(--color-fail-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  border:
                    validationStatus === 'passed'
                      ? '1px solid rgba(5,150,105,0.2)'
                      : '1px solid rgba(220,38,38,0.2)',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color:
                      validationStatus === 'passed'
                        ? 'var(--color-pass)'
                        : 'var(--color-fail)',
                  }}
                >
                  Overall: {validationStatus?.toUpperCase() || 'PENDING'}
                </span>
              </div>

              {/* Rules table */}
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationReport.map((rule, i) => (
                      <tr key={i}>
                        <td>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {rule.field}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-${
                              rule.status === 'pass' ? 'low' : 'high'
                            }`}
                          >
                            {rule.status.toUpperCase()}
                          </span>
                        </td>
                        <td
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            lineHeight: 1.5,
                          }}
                        >
                          {rule.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Section 4 — Risk Score */}
            <Section
              title="Risk Score"
              badge={
                <span
                  className={`badge badge-${riskClass(band)}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  {band} Risk
                </span>
              }
            >
              {/* Score widget */}
              <div className={`risk-score-widget ${riskClass(band)}`}>
                <div>
                  <div className="risk-score-number">{riskScore ?? '—'}</div>
                  <div className="risk-score-label">out of 100</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className={`risk-score-band`}
                    style={{
                      color:
                        band === 'Low'
                          ? 'var(--color-risk-low)'
                          : band === 'Medium'
                          ? 'var(--color-risk-medium)'
                          : 'var(--color-risk-high)',
                      fontWeight: 800,
                      fontSize: '18px',
                      marginBottom: '4px',
                    }}
                  >
                    {band} Risk
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.5,
                    }}
                  >
                    {riskRecommendation(band)}
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div style={{ margin: '16px 0' }}>
                <div
                  style={{
                    height: '6px',
                    background: 'var(--color-border)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${riskScore ?? 0}%`,
                      borderRadius: 'var(--radius-full)',
                      background:
                        band === 'Low'
                          ? 'var(--color-risk-low)'
                          : band === 'Medium'
                          ? 'var(--color-risk-medium)'
                          : 'var(--color-risk-high)',
                      transition: 'width 1s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                    fontSize: '10px',
                    color: 'var(--color-text-faint)',
                    fontWeight: 600,
                  }}
                >
                  <span>0 — Low</span>
                  <span>21 — Medium</span>
                  <span>51 — High</span>
                </div>
              </div>

              {/* Breakdown */}
              {riskBreakdown.length === 0 ? (
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'var(--color-pass-bg)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--color-pass)',
                    border: '1px solid rgba(5,150,105,0.15)',
                  }}
                >
                  ✓ No risk rules triggered — customer appears clean
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      marginBottom: '10px',
                    }}
                  >
                    Triggered Rules
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {riskBreakdown.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          padding: '10px 12px',
                          background: 'var(--color-fail-bg)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(220,38,38,0.12)',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--color-fail)',
                              marginBottom: '2px',
                            }}
                          >
                            {item.rule}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            {item.reason}
                          </div>
                        </div>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '14px',
                            color: 'var(--color-fail)',
                            flexShrink: 0,
                          }}
                        >
                          +{item.pointsAdded}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </div>
        </div>

        <div style={{ height: '48px' }} />
      </div>
    </div>
  );
}