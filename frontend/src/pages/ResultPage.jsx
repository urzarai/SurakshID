// pages/ResultPage.jsx
// Placeholder — full implementation on Day 12.

import { useParams, useNavigate } from 'react-router-dom';

export default function ResultPage() {
  const { verificationId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="page-content">
      <div className="container">
        <div className="page-header">
          <h1>Verification Complete</h1>
          <p>
            ID: <span className="mono">{verificationId}</span>
          </p>
        </div>
        <div className="card card-padded">
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Results view is coming on Day 12.
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            ← Back to Upload
          </button>
        </div>
      </div>
    </div>
  );
}