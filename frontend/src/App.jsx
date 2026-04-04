// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar     from './components/Navbar';
import UploadPage from './pages/UploadPage';
import ResultPage from './pages/ResultPage';
import AuditPage  from './pages/AuditPage';
import { pingBackend } from './services/api';

export default function App() {
  useEffect(() => {
    // Wake up Render backend on app load
    pingBackend();
  }, []);

  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Navbar />
        <Routes>
          <Route path="/"                       element={<UploadPage />} />
          <Route path="/result/:verificationId" element={<ResultPage />} />
          <Route path="/audit"                  element={<AuditPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}