// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar     from './components/Navbar';
import UploadPage from './pages/UploadPage';
import ResultPage from './pages/ResultPage';
import AuditPage  from './pages/AuditPage';
import { pingBackend } from './services/api';

export default function App() {
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    const wakeUp = async () => {
      try {
        await pingBackend();
      } catch (e) {
        // ignore
      } finally {
        setBackendReady(true);
      }
    };
    wakeUp();
  }, []);

  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Navbar />
        {!backendReady && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              background: 'var(--color-primary)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 999,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              className="spinner"
              style={{
                width: '12px',
                height: '12px',
                borderWidth: '2px',
                borderTopColor: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            />
            Waking up server...
          </div>
        )}
        <Routes>
          <Route path="/"                       element={<UploadPage />} />
          <Route path="/result/:verificationId" element={<ResultPage />} />
          <Route path="/audit"                  element={<AuditPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}