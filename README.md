# Wildspot

Web app per fotografi naturalisti: mostra intorno alla tua posizione i posti migliori per fotografare animali selvatici, con avvistamenti recenti (eBird, iNaturalist), luce, ora dorata e meteo. Pensata per il telefono e installabile su Android come PWA.

> Stato: **fase 2** — mappa, posizione GPS, raggio, osservazioni iNaturalist con filtri e schede.

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
index.html                 pagina principale
src/main.js                avvio dell'app, stato e collegamenti tra i moduli
src/map.js                 mappa Leaflet, posizione e cerchio del raggio
src/geolocation.js         lettura del GPS
src/radius.js              selettore del raggio
src/inaturalist.js         chiamate all'API di iNaturalist
src/observations-layer.js  osservazioni sulla mappa (con aree di incertezza)
src/card.js                scheda di dettaglio di un'osservazione
src/filters.js             filtri: periodo, gruppi, ricerca specie
src/groups.js              gruppi di animali e colori
src/sheet.js               pannello a scomparsa dal basso
src/info.js                comportamento corretto e fonti dei dati
src/cache.js               cache delle risposte delle API
src/dom.js                 utilità (creazione elementi, debounce, distanze)
src/storage.js             salvataggio su localStorage
src/style.css              stile mobile first
```

## Note sui dati

- **iNaturalist**: solo osservazioni di grado "ricerca" con foto, al massimo le 200 più recenti per area. Le risposte restano in cache 10 minuti e le richieste partono solo quando smetti di muovere la mappa, per rispettare i limiti dell'API.
- **Posizioni oscurate**: alcune osservazioni (specie sensibili o scelta dell'autore) hanno coordinate pubbliche volutamente imprecise. L'app le mostra come un anello tratteggiato con un'area di incertezza sfumata e non tenta mai di ricostruire il punto reale.

## Attribuzioni

Mappa © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Osservazioni e foto da [iNaturalist](https://www.inaturalist.org); i diritti delle foto restano ai rispettivi autori.
