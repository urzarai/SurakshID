// components/Loader.jsx
// Reusable loading spinner with optional label text.
// Used during API calls throughout the app.

export default function Loader({ text = 'Processing...' }) {
  return (
    <div className="loader-overlay">
      <div className="spinner" />
      <p className="loader-text">{text}</p>
    </div>
  );
}