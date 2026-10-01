import { inject } from '@vercel/analytics';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-serif';
import '@fontsource/caveat/latin-500.css';
import '../styles.css';
import './landing.css';
import { applyTheme } from '../lib/theme';

applyTheme();
inject();

// Each block settles onto the desk as it scrolls into view. Without the
// observer (or under reduced motion) everything is simply shown.
const blocks = document.querySelectorAll<HTMLElement>('[data-reveal]');
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (still || !('IntersectionObserver' in window)) {
  blocks.forEach((b) => b.classList.add('in'));
} else {
  document.documentElement.classList.add('reveal');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  blocks.forEach((b) => io.observe(b));
}
