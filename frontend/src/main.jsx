// main.jsx
// React entry point. Mounts the App component into the #root div.
// Imports the central index.css design system.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);