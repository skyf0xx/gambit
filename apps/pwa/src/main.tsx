import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-serif';
import '@fontsource-variable/noto-sans-mono';
import '@fontsource/caveat/latin-500.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
