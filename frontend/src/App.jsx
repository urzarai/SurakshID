// App.jsx
// Root component. Sets up React Router with three routes:
//   /                    — UploadPage (document submission)
//   /result/:verificationId — ResultPage (verification outcome)
//   /audit               — AuditPage (audit log)
// Navbar is rendered on all routes.

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar     from './components/Navbar';
import UploadPage from './pages/UploadPage';
import ResultPage from './pages/ResultPage';
import AuditPage  from './pages/AuditPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Navbar />
        <Routes>
          <Route path="/"                        element={<UploadPage />} />
          <Route path="/result/:verificationId"  element={<ResultPage />} />
          <Route path="/audit"                   element={<AuditPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}