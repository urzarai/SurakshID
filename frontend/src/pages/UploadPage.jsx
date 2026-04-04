// pages/UploadPage.jsx
// Main document upload and verification page.
// Allows users to upload a document image or PDF,
// select the document type, enter a customer ID,
// and submit — which runs the full 6-step pipeline automatically.
// Shows a step-by-step progress indicator during processing.
// On completion, navigates to /result/:verificationId.

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  uploadDocument,
  classifyDocument,
  extractFields,
  validateDocument,
  screenDocument,
  scoreDocument,
} from '../services/api';

// Pipeline steps definition
const PIPELINE_STEPS = [
  { id: 'upload',   label: 'Upload'   },
  { id: 'classify', label: 'Classify' },
  { id: 'extract',  label: 'Extract'  },
  { id: 'validate', label: 'Validate' },
  { id: 'screen',   label: 'Screen'   },
  { id: 'score',    label: 'Score'    },
];

const DOCUMENT_TYPES = [
  'Passport',
  'National ID',
  'PAN Card',
  'Utility Bill',
  'Company Registration Certificate',
  'Bank Statement',
];

export default function UploadPage() {
  const navigate   = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile]               = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const [customerId, setCustomerId]   = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);  // index of active step
  const [completedSteps, setCompletedSteps] = useState([]);
  const [failedStep, setFailedStep]   = useState(null);
  const [error, setError]             = useState('');
  const [stepMessage, setStepMessage] = useState('');

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (selectedFile) => {
    if (!selectedFile) return;
    const allowed = ['image/jpeg','image/png','image/jpg','image/tiff','application/pdf'];
    if (!allowed.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, TIFF, or PDF file.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }
    setFile(selectedFile);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    handleFile(dropped);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  // ── Pipeline runner ────────────────────────────────────────────────────────
  const runPipeline = async () => {
    if (!file) {
      setError('Please select a document to upload.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setCompletedSteps([]);
    setFailedStep(null);

    let verificationId = null;

    try {
      // Step 0 — Upload + OCR
      setCurrentStep(0);
      setStepMessage('Uploading document and running OCR...');
      const formData = new FormData();
      formData.append('document', file);
      if (customerId.trim()) formData.append('customerId', customerId.trim());
      const uploadRes = await uploadDocument(formData);
      verificationId = uploadRes.data.data.verificationId;
      setCompletedSteps(['upload']);

      // Step 1 — Classify
      setCurrentStep(1);
      setStepMessage('Identifying document type with AI...');
      await classifyDocument(verificationId);
      setCompletedSteps((p) => [...p, 'classify']);

      // Step 2 — Extract
      setCurrentStep(2);
      setStepMessage('Extracting structured fields...');
      await extractFields(verificationId);
      setCompletedSteps((p) => [...p, 'extract']);

      // Step 3 — Validate
      setCurrentStep(3);
      setStepMessage('Running KYC validation rules...');
      await validateDocument(verificationId);
      setCompletedSteps((p) => [...p, 'validate']);

      // Step 4 — Screen
      setCurrentStep(4);
      setStepMessage('Screening against OFAC and UN sanctions lists...');
      await screenDocument(verificationId);
      setCompletedSteps((p) => [...p, 'screen']);

      // Step 5 — Score
      setCurrentStep(5);
      setStepMessage('Computing risk score...');
      await scoreDocument(verificationId);
      setCompletedSteps((p) => [...p, 'score']);

      // All done — navigate to result
      navigate(`/result/${verificationId}`);

    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'An unexpected error occurred.';
      setError(msg);
      setFailedStep(currentStep);
      setCurrentStep(-1);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Step status helper ─────────────────────────────────────────────────────
  const getStepStatus = (index) => {
    const stepId = PIPELINE_STEPS[index].id;
    if (completedSteps.includes(stepId)) return 'completed';
    if (currentStep === index)           return 'active';
    if (failedStep === index)            return 'failed';
    return 'pending';
  };

  // ── Step icon ──────────────────────────────────────────────────────────────
  const stepIcon = (index) => {
    const status = getStepStatus(index);
    if (status === 'completed') return '✓';
    if (status === 'failed')    return '✕';
    return index + 1;
  };

  return (
    <div className="page-content">
      <div className="bg-glow" />
      <div className="container">

        {/* Page Header */}
        <div className="page-header">
          <div className="page-header-eyebrow">
            <span className="page-header-eyebrow-dot" />
            Identity Verification
          </div>
          <h1>Verify a KYC Document</h1>
          <p>
            Upload an identity document to run the full verification pipeline —
            OCR extraction, field validation, AML sanctions screening, and risk scoring.
          </p>
        </div>

        {/* Pipeline Progress — shown during processing */}
        {isProcessing && (
          <div className="card card-padded" style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              Verification Pipeline
            </div>
            <div className="pipeline-steps">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={step.id} className={`pipeline-step ${getStepStatus(i)}`}>
                  <div className="step-circle">{stepIcon(i)}</div>
                  <span className="step-label">{step.label}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginTop: '8px',
                padding: '10px 14px',
                background: 'var(--color-accent-light)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-accent)' }}>
                {stepMessage}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Main Layout */}
        <div className="upload-layout">

          {/* Left — Form */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Document Upload</span>
              <span className="badge badge-neutral">Step 1 of 1</span>
            </div>
            <div className="card-body">
              <div className="upload-form-stack">

                {/* Drop Zone */}
                <div
                  className={`upload-zone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.tiff,.pdf"
                    onChange={(e) => handleFile(e.target.files[0])}
                    disabled={isProcessing}
                    style={{ display: 'none' }}
                  />

                  <div className="upload-zone-icon">
                    {file ? '📄' : '⬆️'}
                  </div>

                  {file ? (
                    <>
                      <h3>Document Selected</h3>
                      <p>Drop a new file to replace it</p>
                      <div className="file-name">
                        📎 {file.name}
                        <span style={{ color: 'var(--color-text-faint)' }}>
                          &nbsp;· {(file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>Drop your document here</h3>
                      <p>or click to browse — JPEG, PNG, TIFF, PDF · Max 10MB</p>
                    </>
                  )}
                </div>

                {/* Customer ID */}
                <div className="form-group">
                  <label className="form-label">
                    Customer ID
                    <span>(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CUST-001"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>

                <div className="divider" />

                {/* Submit */}
                <button
                  className="btn btn-primary btn-lg btn-full"
                  onClick={runPipeline}
                  disabled={isProcessing || !file}
                >
                  {isProcessing ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                      Running Verification...
                    </>
                  ) : (
                    <>
                      ▶ &nbsp;Run Full Verification
                    </>
                  )}
                </button>

                {!file && (
                  <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-faint)' }}>
                    Upload a document to begin
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right — Sidebar info */}
          <div className="upload-sidebar">

            {/* What we check */}
            <div className="info-card">
              <div className="info-card-title">What We Verify</div>
              {[
                { icon: '🔍', title: 'OCR Extraction',     desc: 'Reads text from your document using Tesseract' },
                { icon: '🤖', title: 'AI Classification',  desc: 'Identifies document type using Groq LLM' },
                { icon: '✅', title: 'Field Validation',   desc: 'Checks expiry, age, PAN format, completeness' },
                { icon: '🛡️', title: 'Sanctions Screening', desc: 'Screens against OFAC and UN watchlists' },
                { icon: '📊', title: 'Risk Scoring',       desc: 'Computes 0–100 risk score with breakdown' },
              ].map((item) => (
                <div className="info-item" key={item.title}>
                  <div className="info-item-icon">{item.icon}</div>
                  <div className="info-item-text">
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Accepted documents */}
            <div className="info-card">
              <div className="info-card-title">Accepted Documents</div>
              {DOCUMENT_TYPES.map((type) => (
                <div
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  <span style={{ color: 'var(--color-pass)' }}>✓</span>
                  {type}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Bottom padding */}
        <div style={{ height: '48px' }} />
      </div>
    </div>
  );
}