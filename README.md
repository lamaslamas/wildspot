# Wildspot

Web app per fotografi naturalisti: mostra intorno alla tua posizione i posti migliori per fotografare animali selvatici, con avvistamenti recenti (eBird, iNaturalist), luce, ora dorata e meteo. Pensata per il telefono e installabile su Android come PWA.

> Stato: **fase 1** — mappa, posizione GPS, scelta del raggio, deploy su GitHub Pages.

## Avvio in locale

Serve Node.js 20.19 o superiore (consigliato 22).

```bash
npm install
npm run dev
```

Apri l'indirizzo mostrato nel terminale (di solito `http://localhost:5173/wildspot/`).

Per provarla sul telefono nella stessa rete Wi-Fi usa `npm run dev -- --host`. Attenzione: il browser concede il GPS solo in HTTPS o su `localhost`, quindi da un indirizzo `http://192.168…` la posizione non funzionerà; per i test sul telefono usa la versione pubblicata.

## Build

```bash
npm run build     # crea la cartella dist/
npm run preview   # serve dist/ in locale per controllarla
```

## Pubblicazione su GitHub Pages

Il deploy è automatico tramite GitHub Actions (`.github/workflows/deploy.yml`) a ogni push su `main`.

Da fare una sola volta:

1. Su GitHub apri il repository → **Settings → Pages**
2. In **Build and deployment → Source** scegli **GitHub Actions**

L'app sarà disponibile su `https://<utente>.github.io/wildspot/`.

Se rinomini il repository, aggiorna `base` in `vite.config.js`.

## Struttura

```
index.html            pagina principale
src/main.js           avvio dell'app e stato
src/map.js            mappa Leaflet, posizione e cerchio del raggio
src/geolocation.js    lettura del GPS
src/radius.js         selettore del raggio
src/storage.js        salvataggio su localStorage
src/style.css         stile mobile first
```

## Attribuzioni

Mappa © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
