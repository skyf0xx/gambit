// Lucide, per identity.md §07: 1.5px stroke, rounded caps, currentColor.
// The app itself would use lucide-react; the mockups load the UMD build.
(function () {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/lucide@0.469.0/dist/umd/lucide.min.js";
  s.onload = () => lucide.createIcons({ attrs: { "stroke-width": 1.5, width: 20, height: 20 } });
  document.head.appendChild(s);
})();
