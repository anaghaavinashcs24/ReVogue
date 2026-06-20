import React from 'react';
import ReactDOM from 'react-dom/client';
import Revogue from './Revogue.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Revogue />
  </React.StrictMode>
);

// Register the service worker so the app is installable as a PWA / APK.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
