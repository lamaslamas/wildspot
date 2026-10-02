import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// `base` deve coincidere con il nome del repository GitHub,
// perché GitHub Pages pubblica il sito su https://<utente>.github.io/wildspot/
const BASE = '/wildspot/';

const GIORNO = 24 * 60 * 60;

export default defineConfig({
  base: BASE,
  plugins: [
    // App installabile (manifest) e funzionamento offline (service worker).
    // La struttura dell'app viene salvata all'installazione; mappe, dati e foto
    // vengono salvati man mano che si usano, così restano disponibili senza rete.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg', 'logo-simbolo.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'WildSpot',
        short_name: 'WildSpot',
        description: 'I posti migliori per fotografare animali selvatici intorno a te: avvistamenti, luce e meteo.',
        lang: 'it',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf7f0',
        theme_color: '#faf7f0',
        categories: ['photo', 'travel', 'navigation'],
        icons: [
          { src: 'icons/icona-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icona-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icona-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            // Tile delle mappe: prima la cache (le policy di OSM chiedono di non riscaricarle)
            urlPattern: /^https:\/\/(tile\.openstreetmap\.org|[abc]\.tile\.opentopomap\.org|server\.arcgisonline\.com)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tile-mappe',
              expiration: { maxEntries: 1500, maxAgeSeconds: 30 * GIORNO },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Heatmap e aree protette (immagini a tile)
            urlPattern: /^https:\/\/(api\.inaturalist\.org\/v1\/heatmap|bio\.discomap\.eea\.europa\.eu)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tile-livelli',
              expiration: { maxEntries: 800, maxAgeSeconds: 7 * GIORNO },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Dati: prima la rete; senza rete (o se è troppo lenta) l'ultima risposta salvata
            urlPattern: /^https:\/\/(api\.inaturalist\.org\/v1\/(observations|taxa)|api\.ebird\.org\/v2|api\.open-meteo\.com)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dati',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * GIORNO },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Foto delle osservazioni
            urlPattern: /^https:\/\/(inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'foto',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * GIORNO },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
