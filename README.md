# WildSpot

Web app per fotografi naturalisti: mostra intorno alla tua posizione i posti migliori per fotografare animali selvatici, con avvistamenti recenti (eBird, iNaturalist), luce, ora dorata e meteo. Pensata per il telefono e installabile su Android come PWA. Disponibile in italiano e in inglese.

> Stato: **fase 5** — mappa, posizione GPS, raggio, osservazioni iNaturalist, hotspot e avvistamenti eBird, filtri, impostazioni, luce (alba, tramonto, ora dorata e blu, direzione del sole), meteo orario e diario dei miei spot.

## Avvio in locale

Serve Node.js 20.19 o superiore (consigliato 22).

```bash
npm install
npm run dev
```

Apri l'indirizzo mostrato nel terminale (di solito `http://localhost:5173/wildspot/`).

Per provarla sul telefono nella stessa rete Wi-Fi usa `npm run dev -- --host`. Attenzione: il browser concede il GPS solo in HTTPS o su `localhost`, quindi da un indirizzo `http://192.168…` la posizione non funzionerà; per i test sul telefono usa la versione pubblicata.

## Installazione sul telefono (PWA)

Apri l'app pubblicata in Chrome su Android e tocca **Installa l'app** (nella presentazione o nelle Impostazioni), oppure menu ⋮ → "Installa app". Su iPhone: Condividi → "Aggiungi alla schermata Home".

Il service worker (generato da `vite-plugin-pwa`, configurato in `vite.config.js`) salva la struttura dell'app all'installazione e, man mano che la usi, tile delle mappe, risposte delle API e foto. Senza rete l'app si apre e mostra gli ultimi dati scaricati per le zone già viste; diario, luce e ora dorata funzionano sempre. Le icone stanno in `public/icons/` (generate dal simbolo del logo).

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
src/i18n.js                traduzioni italiano/inglese
src/language-switch.js     selettore della lingua
src/map.js                 mappa Leaflet, posizione e cerchio del raggio
src/geolocation.js         lettura del GPS
src/radius.js              selettore del raggio
src/inaturalist.js         chiamate all'API di iNaturalist
src/ebird.js               chiamate all'API di eBird e raggruppamento per luogo
src/ebird-layer.js         luoghi eBird sulla mappa
src/settings.js            impostazioni: chiave eBird, raggio e gruppi predefiniti, lingua
src/sun.js                 calcoli sul sole con SunCalc (orari, posizione, fasi della luce)
src/sun-layer.js           punto scelto e direzione del sole sulla mappa
src/light-panel.js         pannello luce e meteo con cursore orario
src/weather.js             previsioni orarie da Open-Meteo
src/spots.js               diario degli spot: salvataggio, esportazione e importazione JSON
src/spots-ui.js            elenco, scheda e modulo degli spot
src/spots-layer.js         segnaposto degli spot sulla mappa
src/photos.js              foto degli spot (IndexedDB, ridimensionate a 1600 px)
src/photographed.js        specie fotografate
src/share.js               condivisione di uno spot
src/observations-layer.js  osservazioni iNaturalist sulla mappa (con aree di incertezza)
src/markers.js             forme degli indicatori e raggruppamento dei punti vicini
src/icons.js               icone SVG dei gruppi di animali e del binocolo
src/legend.js              legenda dei simboli
src/best-times.js          "Quando andare": punteggio delle ore dorate dei prossimi 7 giorni
src/best-times-ui.js       pannello "Quando andare"
src/species-stats.js       mesi e ore in cui una specie si osserva di più (iNaturalist)
src/species-stats-ui.js    grafici "Quando vederla"
src/basemaps.js            sfondi (stradale, topografica, satellitare) e aree protette EEA
src/basemaps-ui.js         pannello Sfondo e scheda delle aree protette
src/heatmap-layer.js       heatmap delle osservazioni (tile di iNaturalist)
src/list-view.js           vista Elenco (stessi dati della mappa, per distanza o data)
src/leaflet-global.js      espone Leaflet come `L` globale per il plugin di raggruppamento
src/card.js                schede: osservazione iNaturalist e luogo eBird
src/filters.js             filtri: livelli, periodo, gruppi, ricerca specie
src/groups.js              gruppi di animali e colori
src/sheet.js               pannello a scomparsa dal basso
src/info.js                comportamento corretto e fonti dei dati
src/cache.js               cache delle risposte delle API
src/dom.js                 utilità (creazione elementi, debounce, distanze)
src/storage.js             salvataggio su localStorage
src/style.css              stile mobile first
```

## Lingue

All'avvio l'app usa la lingua del telefono (italiano se è italiano, altrimenti inglese); la scelta si cambia dal selettore IT/EN nella presentazione o nel pannello informazioni e viene ricordata. Tutti i testi stanno in `src/i18n.js`: per aggiungerne uno inserisci la stessa chiave in entrambe le lingue. Nell'HTML si usano gli attributi `data-i18n` (testo) e `data-i18n-aria` (etichetta per i lettori di schermo).

## Note sui dati

- **iNaturalist**: solo osservazioni di grado "ricerca" con foto, al massimo le 200 più recenti per area. Le risposte restano in cache 10 minuti e le richieste partono solo quando smetti di muovere la mappa, per rispettare i limiti dell'API.
- **eBird**: serve una chiave personale gratuita, da chiedere su <https://ebird.org/api/keygen> e da inserire nelle **Impostazioni** dell'app (icona a ingranaggio). La chiave viene salvata solo nel `localStorage` del dispositivo e inviata solo a eBird: **non va mai scritta nel codice né committata**. L'API di eBird accetta chiamate dal browser (CORS aperto), quindi non serve un proxy. eBird fornisce al massimo gli ultimi 30 giorni e un raggio di 50 km; gli avvistamenti sono raggruppati per luogo (un indicatore per hotspot o località, con l'elenco delle specie). eBird nasconde già le specie sensibili e l'app non aggira questo comportamento.
- **Luce**: calcolata sul telefono con SunCalc, senza connessione. Ora blu = sole tra −6° e −4°, ora dorata = tra −4° e +6°. Gli orari sono mostrati nel fuso orario del telefono.
- **Meteo**: Open-Meteo, nessuna chiave; copre circa gli ultimi tre mesi e i prossimi 15 giorni.
- **Interfaccia**: l'app occupa sempre tutto lo schermo e la pagina non scorre, così i gesti sulla mappa muovono solo la mappa. La presentazione compare alla prima apertura e si riapre toccando il logo. In alto un interruttore passa da **Mappa** a **Elenco**; dalle schede aperte nell'elenco, "Mostra sulla mappa" porta al punto. I pannelli si aprono a metà schermo e si allargano con la maniglia (o trascinando la testata); su schermi larghi diventano una colonna laterale.
- **Simboli sulla mappa**: iNaturalist = badge rotondo con l'icona del gruppo; eBird = etichetta verde con binocolo e numero di specie (stella se ci sono specie notevoli); hotspot senza avvistamenti recenti = etichetta chiara. I punti vicini si raggruppano in bolle con il numero (plugin Leaflet.markercluster). Il pulsante **Legenda** sulla mappa spiega tutti i simboli.
- **Diario degli spot**: salvato solo nel `localStorage` del dispositivo. Da "I miei spot" si esporta un file JSON (`wildspot-spot-AAAA-MM-GG.json`) e lo si reimporta su un altro dispositivo o dopo aver svuotato il browser; all'importazione gli spot con lo stesso identificativo non vengono duplicati e vince la versione modificata più di recente. Uno spot si crea dal diario (nella tua posizione), tenendo premuto sulla mappa, o con "Salva come spot" nelle schede e nel pannello luce (non per le osservazioni con posizione oscurata).
- **Heatmap**: livello attivabile dai filtri. Usa le tile `/v1/heatmap` di iNaturalist con gli stessi filtri (gruppi o specie, periodo, solo grado ricerca), quindi conta tutte le osservazioni e non solo le 200 scaricate. eBird non fornisce un servizio simile. Rende meglio con periodi lunghi.
- **Sfondi e aree protette**: pulsante **Sfondo** sulla mappa. Topografica da OpenTopoMap, satellite da Esri World Imagery. Aree protette dai servizi dell'Agenzia europea dell'ambiente (Natura 2000 e aree nazionali CDDA); con le aree accese, un tocco su un punto vuoto della mappa mostra in quali aree si trova.
- **Quando vederla**: nelle schede, grafici dei mesi (istogramma `month_of_year` di iNaturalist) e delle ore (dall'orario locale delle ultime 200 osservazioni) entro 100 km, allargati a 300 km o al mondo se i dati sono pochi. Per le specie eBird si cerca la specie su iNaturalist dal nome scientifico.
- **Luna**: fase, percentuale illuminata, sorgere e tramonto nel pannello Luce e meteo (SunCalc).
- **Quando andare**: per uno spot o un punto, le ore dorate dei prossimi 7 giorni (Open-Meteo) con un giudizio da pioggia, nuvole (anche basse), vento e visibilità, più la direzione del sole.
- **Foto e specie fotografate**: le foto degli spot stanno in IndexedDB, le specie fotografate ("L'ho fotografata" nelle schede) in `localStorage`. Il backup JSON (versione 2) contiene spot, foto (come data URL) e specie fotografate.
- **Posizioni oscurate**: alcune osservazioni (specie sensibili o scelta dell'autore) hanno coordinate pubbliche volutamente imprecise. L'app le mostra con un badge chiaro dal bordo tratteggiato; toccandole compare l'area di incertezza. L'app non tenta mai di ricostruire il punto reale.

## Attribuzioni

Mappa © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Osservazioni e foto da [iNaturalist](https://www.inaturalist.org); i diritti delle foto restano ai rispettivi autori. Avvistamenti e hotspot da [eBird](https://ebird.org) (Cornell Lab of Ornithology). Previsioni meteo da [Open-Meteo](https://open-meteo.com) (CC BY 4.0).
