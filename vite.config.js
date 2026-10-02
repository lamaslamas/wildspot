import { defineConfig } from 'vite';

// `base` deve coincidere con il nome del repository GitHub,
// perché GitHub Pages pubblica il sito su https://<utente>.github.io/wildspot/
export default defineConfig({
  base: '/wildspot/',
});
