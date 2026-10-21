import { setLocaleForTest } from '../src/lib/i18n';

// Node takes navigator.languages from the machine's LANG; tests read English.
setLocaleForTest('en');
