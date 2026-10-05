import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-serif';
import '@fontsource-variable/noto-sans-mono';
import '@fontsource/caveat/latin-500.css';
import './styles.css';
import App from './App';
import { applyTheme } from './lib/theme';
import { track, trackView } from './lib/analytics';

applyTheme();
trackView();
// Opened from the home screen, or in a browser tab.
track('app_open', { standalone: window.matchMedia('(display-mode: standalone)').matches });
window.addEventListener('appinstalled', () => track('pwa_installed'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
