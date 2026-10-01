// Someone who already uses Gambit goes straight to the app. The app sets
// this flag once a working key is saved (App.tsx). A plain blocking script
// in <head>, so the landing page never flashes before the redirect.
try {
  if (localStorage.getItem('gambit:returning') === '1') location.replace('/app');
} catch {
  // Storage blocked: show the landing page.
}
