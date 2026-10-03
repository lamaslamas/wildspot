# WildSpot — web app per fotografi naturalisti

> Il nome dell'app è **WildSpot**: usalo per il titolo, il manifest PWA, il README e il nome del repository (`wildspot`). Questo documento descrive il progetto per Claude Code: leggilo tutto prima di iniziare e lavora una fase alla volta, aspettando la mia conferma prima di passare alla successiva.

## Obiettivo

Una web app installabile su Android (PWA) che mostra, intorno alla mia posizione, i posti migliori per fotografare animali selvatici, uccelli compresi. Unisce gli avvistamenti recenti di eBird e iNaturalist con le informazioni utili a un fotografo: luce, ora dorata, direzione del sole e meteo. Include un diario personale dei miei spot.

Interfaccia in italiano, pensata prima di tutto per il telefono.

## Stack tecnico

- **Vite + JavaScript vanilla** (niente framework pesanti, il progetto deve restare semplice da capire e modificare)
- **Leaflet** per la mappa, con tile di OpenStreetMap (attribuzione obbligatoria)
- **SunCalc** per posizione del sole, alba, tramonto, ora dorata e ora blu
- **vite-plugin-pwa** per manifest, service worker e installazione sulla schermata home
- **Deploy su GitHub Pages** tramite GitHub Actions (ricordati di impostare `base` in `vite.config.js` con il nome del repository)
- Dati salvati sul dispositivo con `localStorage`, nessun backend

## Fonti dati

### iNaturalist (nessuna chiave richiesta)
- Endpoint: `https://api.inaturalist.org/v1/observations`
- Parametri utili: `lat`, `lng`, `radius` (in km), `iconic_taxa` (Aves, Mammalia, Reptilia, Amphibia, Insecta), `quality_grade=research`, `photos=true`, `order_by=observed_on`, `d1` (data minima), `locale=it`
- Rispettare i limiti di richieste dell'API: debounce sugli spostamenti della mappa e cache dei risultati

### eBird (chiave API personale)
- Header: `X-eBirdApiToken`
- Avvistamenti recenti: `GET https://api.ebird.org/v2/data/obs/geo/recent?lat=&lng=&dist=&back=&sppLocale=it`
- Avvistamenti notevoli: `GET https://api.ebird.org/v2/data/obs/geo/recent/notable?...`
- Hotspot: `GET https://api.ebird.org/v2/ref/hotspot/geo?lat=&lng=&dist=&fmt=json`
- **La chiave non va mai scritta nel codice né committata.** L'utente la inserisce nelle Impostazioni dell'app e viene salvata solo in `localStorage`.
- **Da verificare all'inizio della fase 3:** se l'API di eBird accetta chiamate dal browser (CORS). Se le blocca, proporre una soluzione minima (per esempio un piccolo proxy su Cloudflare Workers) e spiegarmela prima di implementarla.

### Open-Meteo (nessuna chiave richiesta)
- Previsioni orarie: copertura nuvolosa, precipitazioni, vento, visibilità
- Endpoint: `https://api.open-meteo.com/v1/forecast`

## Funzionalità (MVP)

1. **Mappa centrata sulla mia posizione** (GPS del browser), con scelta del raggio: 5, 10, 25, 50 km
2. **Livelli attivabili**: hotspot eBird, avvistamenti recenti eBird, osservazioni iNaturalist, i miei spot
3. **Filtri**: periodo (ultimi 7, 14, 30 giorni), gruppo di animali, ricerca per specie
4. **Scheda dell'avvistamento**: specie (nome italiano e scientifico), data, numero di individui se presente, foto (da iNaturalist), link alla fonte originale
5. **Pannello luce** per il giorno scelto: alba, tramonto, ora dorata, ora blu. Su un punto selezionato della mappa, una freccia indica la direzione del sole all'ora scelta tramite un cursore temporale
6. **Meteo** delle prossime ore per il punto selezionato
7. **Diario dei miei spot**: salvo un punto con nome, note (capanno, accesso, luce migliore, specie viste), data delle visite. Esportazione e importazione in JSON per non perdere i dati
8. **Impostazioni**: chiave eBird, raggio predefinito, gruppi di animali predefiniti

## Etica e tutela delle specie

- **Non tentare mai di ricostruire la posizione esatta** di osservazioni oscurate. Su iNaturalist le osservazioni con posizione oscurata vanno mostrate con un cerchio di incertezza, non come punto preciso
- eBird nasconde già le specie sensibili: non aggirare questo comportamento
- Inserire nell'app una breve nota sul comportamento corretto: distanza dagli animali, attenzione ai siti di nidificazione, niente richiami registrati in periodo riproduttivo

## Requisiti generali

- Mobile first, utilizzabile con una mano, testo leggibile all'aperto
- Funziona anche con connessione scarsa: la struttura dell'app resta disponibile offline grazie al service worker, i dati mostrano un messaggio chiaro se non si caricano
- Attribuzioni visibili per OpenStreetMap, eBird, iNaturalist e Open-Meteo
- Codice commentato in italiano, con un README che spiega come avviarlo e pubblicarlo

## Fasi di lavoro

1. **Base**: progetto Vite, mappa Leaflet, posizione GPS, scelta del raggio, deploy funzionante su GitHub Pages
2. **iNaturalist**: osservazioni sulla mappa, filtri, schede con foto
3. **eBird**: impostazioni con chiave, hotspot e avvistamenti (con verifica CORS)
4. **Luce e meteo**: pannello SunCalc, freccia del sole, cursore orario, Open-Meteo
5. **Diario**: spot personali, note, esportazione e importazione
6. **PWA e rifinitura**: installazione su Android, icone, comportamento offline, revisione grafica
7. **Percorsi e tracce GPX**: percorsi escursionistici, MTB e bici da OpenStreetMap; import di tracce GPX (dettagli sotto)

## Fase 7: percorsi escursionistici e MTB

### Percorsi da OpenStreetMap (Overpass API)
- Ricerca dal pulsante **"Percorsi"** sulla mappa (centro della mappa) o dal **menu del tocco prolungato** ("Percorsi qui"; lo stesso menu offre "Nuovo spot qui" e "Luce e meteo qui"). Raggio selezionabile: 1, 3, 5 km (massimo 5 km: oltre, Overpass diventa troppo lento)
- **Fonti**, in ordine:
  1. **in Puglia** il file `public/data/percorsi-puglia.geojson`, generato a mano con `npm run percorsi:puglia` (script `scripts/percorsi-puglia.mjs`: estratto del Sud Italia da Geofabrik, ritaglio sul confine regionale con osmium, relazioni route=hiking/foot/mtb/bicycle, geometria ricomposta in Node). Il file contiene anche il confine semplificato, usato per decidere quando leggerlo
  2. **fuori dalla Puglia** Overpass con richieste **POST** e `[timeout:25]`, su più server sfalsati (overpass-api.de subito, maps.mail.ru dopo 6 s, overpass.kumi.systems e overpass.private.coffee dopo 12 s): vince il primo che risponde
  3. se nessun server risponde, l'ultima risposta salvata per quella zona (IndexedDB, perché il service worker non salva le POST)
  `[out:json][timeout:25];relation["route"~"^(hiking|foot|mtb|bicycle)$"](around:RAGGIO,LAT,LON);out geom(BBOX);`
  La geometria è ritagliata a un riquadro poco più grande del raggio per non scaricare interi percorsi regionali (senza ritaglio: circa 2 MB per 5 km)
- Colore per tipo: trekking/a piedi rosso-arancio, MTB viola, bici blu
- Scheda del percorso: nome o numero, tipo, lunghezza (tag `distance` se presente, altrimenti calcolata dalla geometria; se il percorso è ritagliato si indica "almeno"), partenza e arrivo, difficoltà (`cai_scale`, `sac_scale`, `mtb:scale`), segnavia disegnato da `osmc:symbol`, link alla relazione su openstreetmap.org
- Filtro per tipo (trekking, MTB, bici): nessuna selezione = tutti
- Avvistamenti vicini: le osservazioni iNaturalist ed eBird caricate entro 500 m dal tracciato vengono evidenziate sulla mappa ed elencate nella scheda. Le osservazioni con posizione oscurata non vengono mai considerate "sul percorso"
- Cache dei risultati, attesa tra ricerche ravvicinate, messaggi chiari se Overpass è lento, sovraccarico o non risponde, con il dettaglio di cosa è successo a ogni server
- **Livello Waymarked Trails** (escursionismo, MTB, ciclabili) attivabile da "Sfondo": tile sovrapposte, sempre disponibili anche quando Overpass non risponde, con attribuzione
- Attribuzione OpenStreetMap (licenza ODbL)

### Import GPX
- Pulsante "Importa GPX" per tracce di altre app (Wikiloc, Komoot…): parsing con `DOMParser` di `trk` e `rte`
- Traccia disegnata sulla mappa con lunghezza, dislivello positivo e negativo, quota minima e massima e profilo altimetrico, se il file ha le quote
- Salvataggio in IndexedDB, con elenco, rinomina, eliminazione e "mostra sulla mappa"; anche per le tracce si possono vedere gli avvistamenti entro 500 m
- Le tracce restano solo sul dispositivo e sono incluse nel backup del diario

## Idee per dopo (non ora)

- Orari di maggiore attività per specie, ricavati dagli orari degli avvistamenti
- Avvisi quando una specie che seguo viene segnalata vicino a me
- Versione nativa Android
