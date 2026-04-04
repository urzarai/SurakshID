// components/Navbar.jsx
// Top navigation bar for SurakshID.
// Fixed at the top, glassmorphism background.
// Shows active route via NavLink className.
// Collapses to hamburger on mobile.

import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="container">
        {/* Brand */}
        <NavLink to="/" className="navbar-brand">
          <div className="navbar-logo-mark">
            <span>S</span>
          </div>
          <div className="navbar-brand-text">
            <span className="navbar-brand-name">SurakshID</span>
            <span className="navbar-brand-tag">KYC · AML · Compliance</span>
          </div>
        </NavLink>

        {/* Nav Links */}
        <ul className={`navbar-nav${menuOpen ? ' open' : ''}`}>
          <li>
            <NavLink
              to="/"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              end
              onClick={() => setMenuOpen(false)}
            >
              Verify Document
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/audit"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              Audit Log
            </NavLink>
          </li>
        </ul>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="navbar-badge">
            <span className="navbar-badge-dot" />
            System Operational
          </div>

          {/* Hamburger */}
          <button
            className="navbar-menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6"  x2="21" y2="6"  />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}