// Punto di ingresso dell'app: collega mappa, GPS, raggio, filtri, impostazioni
// e i dati di iNaturalist ed eBird.

import './style.css';
import L from './leaflet-global.js';
import './pwa.js';
import { creaBloccoInstalla } from './install-ui.js';
import { creaMappa, mostraPosizione, mostraRaggio, CENTRO_PREDEFINITO } from './map.js';
import { leggiPosizione } from './geolocation.js';
import { creaSelettoreRaggio } from './radius.js';
import { leggi, scrivi } from './storage.js';
import { el, debounce, distanzaKm } from './dom.js';
import { cercaOsservazioni } from './inaturalist.js';
import { cercaAvvistamenti, cercaHotspot, raggruppaPerLuogo } from './ebird.js';
import { creaLivelloOsservazioni } from './observations-layer.js';
import { creaLivelloEbird } from './ebird-layer.js';
import { creaRaggruppamento } from './markers.js';
import { creaElenco } from './list-view.js';
import { creaScheda, creaSchedaLuogo } from './card.js';
import { filtriIniziali, salvaFiltri, contaFiltriAttivi, creaPannelloFiltri, effettivi } from './filters.js';
import { leggiImpostazioni, creaPannelloImpostazioni } from './settings.js';
import { creaInfo } from './info.js';
import { creaLegenda } from './legend.js';
import { creaPannelloLuce } from './light-panel.js';
import { creaLivelloSole } from './sun-layer.js';
import { leggiSpot, trovaSpot, salvaSpot, eliminaSpot, aggiungiVisita, togliVisita, esportaJson, importaJson } from './spots.js';
import { creaDiario, creaSchedaSpot, creaModuloSpot } from './spots-ui.js';
import { eliminaFotografata } from './photographed.js';
import { condividiSpot } from './share.js';
import { leggiSeguite, leggiNovita, nonViste, segnaTutteViste, svuotaNovita, controllaNovita, notifica } from './follow.js';
import { creaPannelloNovita } from './alerts-ui.js';
import { creaLivelloSpot } from './spots-layer.js';
import { creaLivelloHeatmap } from './heatmap-layer.js';
import { creaSfondi, areeNelPunto } from './basemaps.js';
import { creaPannelloSfondi, creaSchedaAree } from './basemaps-ui.js';
import { creaQuandoAndare } from './best-times-ui.js';
import { cercaPercorsi } from './trails.js';
import { creaLivelloPercorsi } from './trails-layer.js';
import { creaPannelloPercorsi, creaSchedaPercorso, creaSchedaTraccia, creaMenuPunto, RAGGI_PERCORSI } from './trails-ui.js';
import { importaTraccia, leggiTracce, rinominaTraccia, eliminaTraccia } from './tracks.js';
import { distanzaDaTrattiM } from './geo.js';
import { dataIso } from './weather.js';
import { apriSheet, chiudiSheet } from './sheet.js';
import { t, traduciPagina, alCambioLingua } from './i18n.js';
import { creaSelettoreLingua } from './language-switch.js';

// Testi dell'HTML nella lingua scelta e selettore di lingua nella presentazione
traduciPagina();
document.querySelector('[data-selettore-lingua]').append(creaSelettoreLingua());
// Nella presentazione, sotto "Apri la mappa": invito a installare l'app
document.getElementById('close-intro').after(creaBloccoInstalla({ compatto: true }));

// --- Presentazione: schermata introduttiva mostrata alla prima apertura;
// si riapre toccando il logo in alto a sinistra
const elIntro = document.getElementById('intro');
const btnChiudiIntro = document.getElementById('close-intro');

function mostraIntro() {
  elIntro.hidden = false;
  elIntro.scrollTop = 0;
  btnChiudiIntro.focus();
}

function chiudiIntro() {
  elIntro.hidden = true;
  scrivi('introVista', true);
  mappa.invalidateSize(); // la mappa ricalcola le sue dimensioni
}

btnChiudiIntro.addEventListener('click', chiudiIntro);
document.getElementById('open-intro').addEventListener('click', mostraIntro);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !elIntro.hidden) chiudiIntro();
});
// "mappaVista" è il nome usato dalle versioni precedenti
if (!leggi('introVista', false) && !leggi('mappaVista', false)) mostraIntro();

// Altezze delle barre in alto e in basso, usate dal CSS per il pannello laterale su desktop
const osservaAltezze = new ResizeObserver(() => {
  const radice = document.documentElement.style;
  radice.setProperty('--alto-topbar', `${document.querySelector('.topbar').offsetHeight}px`);
  radice.setProperty('--alto-controlli', `${document.querySelector('.controls').offsetHeight}px`);
});
osservaAltezze.observe(document.querySelector('.topbar'));
osservaAltezze.observe(document.querySelector('.controls'));

// Stato dell'app
const impostazioni = leggiImpostazioni();
const stato = {
  centro: leggi('ultimoCentro', CENTRO_PREDEFINITO), // centro della ricerca
  raggioKm: impostazioni.raggioPredefinito,
  filtri: filtriIniziali(impostazioni),
  posizioneGps: null, // ultima posizione nota dell'utente
};

const elStato = document.getElementById('status');
const btnPosizione = document.getElementById('locate');
const elBadge = document.getElementById('filters-badge');

// Il messaggio viene ricordato come chiave di traduzione, così al cambio di
// lingua si può ridisegnare
let ultimoMessaggio = null;

function mostraMessaggio(chiave, parametri = {}, tipo = 'info') {
  ultimoMessaggio = { chiave, parametri, tipo };
  elStato.textContent = t(chiave, parametri);
  elStato.dataset.tipo = tipo;
}

// --- Mappa
const mappa = creaMappa('map');
mappa.attributionControl.addAttribution('<a href="https://www.inaturalist.org">iNaturalist</a>');
const ATTRIBUZIONE_EBIRD = '<a href="https://ebird.org">eBird</a>';
mostraRaggio(stato.centro, stato.raggioKm);

// iNaturalist ed eBird condividono il raggruppamento dei punti vicini
const raggruppamento = creaRaggruppamento(mappa);
const livelloEbird = creaLivelloEbird(raggruppamento, apriSchedaLuogo);
const livelloInat = creaLivelloOsservazioni(mappa, raggruppamento, apriScheda);
const livelloSole = creaLivelloSole(mappa);
const livelloHeatmap = creaLivelloHeatmap(mappa);
const sfondi = creaSfondi(mappa);
const livelloSpot = creaLivelloSpot(mappa, apriSpot);
const livelloPercorsi = creaLivelloPercorsi(mappa, { onPercorso: (p) => apriPercorso(p), onTraccia: (tr) => apriTraccia(tr) });

// Toccando un punto vuoto della mappa: con il pannello luce o il modulo di uno
// spot aperti si sposta il punto; altrimenti si chiude il pannello aperto
mappa.on('click', (e) => {
  const punto = { lat: e.latlng.lat, lng: e.latlng.lng };
  if (pannelloAperto === 'luce' && pannelloLuce) pannelloLuce.impostaPunto(punto);
  else if (pannelloAperto === 'moduloSpot' && moduloSpot) moduloSpot.impostaPosizione(punto);
  else if (pannelloAperto) chiudiSheet();
  // con le aree protette accese, un tocco su un punto vuoto mostra in quali aree cade
  else if (sfondi.areeAccese()) mostraAree(punto);
});

// Tenendo premuto sulla mappa si apre un piccolo menu: percorsi, nuovo spot, luce
mappa.on('contextmenu', (e) => apriMenuPunto({ lat: e.latlng.lat, lng: e.latlng.lng }));

// Gli spostamenti fatti dal codice (per mostrare il punto sopra al pannello)
// non devono spostare l'area di ricerca
let ignoraProssimoSpostamento = false;

// Quando l'utente sposta la mappa, la ricerca segue il nuovo centro.
// Non ricarichiamo se la zona visibile sta tutta dentro il cerchio di ricerca
// (per esempio dopo aver ingrandito una bolla: i dati ci sono già) né per
// piccoli spostamenti, per non fare richieste inutili.
mappa.on('moveend', () => {
  if (ignoraProssimoSpostamento) {
    ignoraProssimoSpostamento = false;
    return;
  }
  const b = mappa.getBounds();
  const angoli = [b.getNorthWest(), b.getNorthEast(), b.getSouthWest(), b.getSouthEast()];
  if (angoli.every((a) => distanzaKm(a, stato.centro) <= stato.raggioKm)) return;
  const c = mappa.getCenter();
  const nuovoCentro = { lat: c.lat, lng: c.lng };
  if (distanzaKm(nuovoCentro, stato.centro) < stato.raggioKm * 0.2) return;
  stato.centro = nuovoCentro;
  scrivi('ultimoCentro', nuovoCentro);
  mostraRaggio(nuovoCentro, stato.raggioKm, { adatta: false });
  caricaConCalma();
});

// --- Vista Mappa / Elenco
const elElenco = document.getElementById('elenco');
const elMappaWrap = document.querySelector('.map-wrap');
const elenco = creaElenco(elElenco, {
  onApriOsservazione: (o) => apriScheda(o),
  onApriLuogo: (luogo, opzioni) => apriSchedaLuogo(luogo, opzioni),
});
let vista = leggi('vista', 'mappa') === 'elenco' ? 'elenco' : 'mappa';
let ultimiDati = { osservazioni: [], luoghi: [], visibili: { avvistamenti: false, hotspot: false } };

function aggiornaElenco() {
  if (vista !== 'elenco') return; // si disegna quando lo si apre
  elenco.aggiorna({ ...ultimiDati, riferimento: stato.posizioneGps || stato.centro });
}

function impostaVista(nuova) {
  vista = nuova;
  scrivi('vista', nuova);
  const inElenco = nuova === 'elenco';
  elMappaWrap.hidden = inElenco;
  elElenco.hidden = !inElenco;
  document.getElementById('vista-mappa').setAttribute('aria-selected', String(!inElenco));
  document.getElementById('vista-elenco').setAttribute('aria-selected', String(inElenco));
  if (inElenco) aggiornaElenco();
  else mappa.invalidateSize(); // la mappa era nascosta: ricalcola le dimensioni
}
document.getElementById('vista-mappa').addEventListener('click', () => impostaVista('mappa'));
document.getElementById('vista-elenco').addEventListener('click', () => impostaVista('elenco'));

// Dall'elenco: passa alla mappa, ingrandisce sul punto, riapre la scheda
// (ora senza il pulsante "Mostra sulla mappa") e seleziona il punto
function mostraSullaMappa(punto, seleziona, riapri) {
  impostaVista('mappa');
  ignoraProssimoSpostamento = true;
  mappa.setView([punto.lat, punto.lng], Math.max(mappa.getZoom(), 15), { animate: false });
  // da zoom 14 i punti non sono più raggruppati: aspettiamo che compaiano
  setTimeout(() => {
    riapri?.(); // prima la scheda: aprendola si toglie l'evidenziazione precedente
    seleziona?.();
    mostraSopraAlPannello(punto, 0.55);
  }, 350);
}

// --- Caricamento dei dati
let richiestaInCorso = null;

// Con una specie scelta nei filtri teniamo solo gli avvistamenti eBird con lo
// stesso nome scientifico (o, per un genere, i nomi che iniziano con esso)
function corrispondeAllaSpecie(nomeSci, taxon) {
  if (!taxon) return true;
  return nomeSci === taxon.nomeSci || nomeSci.startsWith(`${taxon.nomeSci} `);
}

async function caricaDati() {
  richiestaInCorso?.abort(); // una richiesta nuova rende inutile quella vecchia
  const controller = new AbortController();
  richiestaInCorso = controller;
  const { signal } = controller;

  const { filtri } = stato;
  const eff = effettivi(filtri); // cosa mostrare, partendo dalle selezioni
  const chiave = impostazioni.chiaveEbird;
  const vuoiInat = eff.livelli.inat;
  // eBird riguarda solo gli uccelli: niente richiesta se sono esclusi dai filtri
  const uccelliInclusi = Boolean(filtri.taxon) || eff.gruppi.includes('Aves');
  const vuoiAvvistamenti = Boolean(chiave) && eff.livelli.ebirdAvvistamenti && uccelliInclusi;
  const vuoiHotspot = Boolean(chiave) && eff.livelli.ebirdHotspot;
  const livelloEbirdAcceso = Boolean(chiave) && (eff.livelli.ebirdAvvistamenti || vuoiHotspot);

  // La heatmap ha tile proprie: si aggiorna subito, anche offline mostra ciò che è in cache
  livelloHeatmap.aggiorna(eff.livelli.heatmap, { ...filtri, gruppi: eff.gruppi });

  if (!vuoiInat && !livelloEbirdAcceso) {
    livelloInat.aggiorna([]);
    livelloEbird.aggiorna([], { avvistamenti: false, hotspot: false });
    ultimiDati = { osservazioni: [], luoghi: [], visibili: { avvistamenti: false, hotspot: false } };
    aggiornaElenco();
    mostraMessaggio(eff.livelli.heatmap ? 'stato.soloHeatmap' : 'stato.nessunLivello');
    return;
  }
  // Senza rete proviamo lo stesso: il service worker risponde con i dati salvati
  const offline = !navigator.onLine;
  mostraMessaggio('stato.carico');

  const area = { centro: stato.centro, raggioKm: stato.raggioKm };
  const [inat, avvistamenti, hotspot] = await Promise.allSettled([
    vuoiInat
      ? cercaOsservazioni({ ...area, giorni: filtri.giorni, gruppi: eff.gruppi, taxonId: filtri.taxon?.id }, signal)
      : null,
    vuoiAvvistamenti ? cercaAvvistamenti({ ...area, giorni: filtri.giorni, chiave }, signal) : [],
    vuoiHotspot ? cercaHotspot({ ...area, chiave }, signal) : [],
  ]);
  if (signal.aborted) return;

  // iNaturalist
  const osservazioni = inat.status === 'fulfilled' && inat.value ? inat.value.osservazioni : [];
  livelloInat.aggiorna(osservazioni);

  // eBird: avvistamenti filtrati per specie e raggruppati per luogo insieme agli hotspot
  const avvistamentiOk =
    avvistamenti.status === 'fulfilled'
      ? avvistamenti.value.filter((a) => corrispondeAllaSpecie(a.nomeSci, filtri.taxon))
      : [];
  const hotspotOk = hotspot.status === 'fulfilled' ? hotspot.value : [];
  const luoghi = raggruppaPerLuogo(avvistamentiOk, hotspotOk);
  const visibili = { avvistamenti: eff.livelli.ebirdAvvistamenti, hotspot: eff.livelli.ebirdHotspot };
  livelloEbird.aggiorna(luoghi, visibili);
  ultimiDati = { osservazioni, luoghi, visibili };
  aggiornaElenco();

  // Messaggio: prima gli errori (quelli di eBird hanno la precedenza se la
  // chiave è sbagliata, perché si risolvono dalle impostazioni), poi il conteggio
  const erroreInat = inat.status === 'rejected' ? inat.reason : null;
  const erroreEbird = [avvistamenti, hotspot].find((r) => r.status === 'rejected')?.reason;
  const chiaveRifiutata = erroreEbird && [401, 403].includes(erroreEbird.status);

  if (chiaveRifiutata) {
    mostraMessaggio('stato.ebirdChiave', {}, 'errore');
  } else if (erroreInat && offline) {
    mostraMessaggio('stato.offline', {}, 'errore');
  } else if (erroreInat) {
    mostraMessaggio(erroreInat.status === 429 ? 'stato.troppeRichieste' : 'stato.erroreRete', {}, 'errore');
  } else if (erroreEbird) {
    mostraMessaggio('stato.ebirdErrore', {}, 'errore');
  } else {
    const n = osservazioni.length + avvistamentiOk.length;
    const totaleInat = inat.value?.totale ?? 0;
    const parametri = {
      n,
      totale: totaleInat + avvistamentiOk.length,
      periodo: t(`periodoStato.${filtri.giorni}`),
    };
    if (offline) mostraMessaggio('stato.offlineSalvati', parametri);
    else if (!n) mostraMessaggio('stato.nessuna', parametri);
    else if (totaleInat > osservazioni.length) mostraMessaggio('stato.parziale', parametri);
    else mostraMessaggio(n === 1 ? 'stato.conteggio1' : 'stato.conteggio', parametri);
  }
}

// Versione con attesa, per raggruppare cambi ravvicinati (spostamenti, filtri)
const caricaConCalma = debounce(caricaDati, 700);

// Al ritorno della connessione ricarichiamo
window.addEventListener('online', caricaDati);

// --- Pannelli: ne è aperto uno alla volta. Ricordiamo quale, per poterlo
// ridisegnare quando cambia la lingua.
let pannelloAperto = null;

function apriPannello(nome, titolo, contenuto, onChiudi, classe) {
  apriSheet(titolo, contenuto, {
    classe,
    onChiudi: () => {
      pannelloAperto = null;
      onChiudi?.();
    },
  });
  pannelloAperto = nome; // dopo apriSheet, che chiama l'onChiudi del pannello precedente
}

// --- Schede
function apriScheda(o) {
  const scheda = creaScheda(o, {
    onLuce: apriLuce,
    onSalvaSpot: nuovoSpot,
    onMappa: vista === 'elenco' ? () => mostraSullaMappa(o, () => livelloInat.seleziona(o.id), () => apriScheda(o)) : null,
    onSoloSpecie: (oss) => {
      stato.filtri.taxon = { id: oss.taxonId, nomeComune: oss.nomeComune, nomeSci: oss.nomeSci };
      aggiornaBadge();
      chiudiSheet();
      caricaDati();
    },
  });
  apriPannello('scheda', o.nomeComune || o.nomeSci, scheda, livelloInat.togliEvidenziazione);
  if (vista === 'mappa') mostraSopraAlPannello(o, 0.55);
}

function apriSchedaLuogo(luogo, opzioni) {
  const onMappa =
    vista === 'elenco'
      ? () => mostraSullaMappa(luogo, () => livelloEbird.seleziona(luogo.locId), () => apriSchedaLuogo(luogo, opzioni))
      : null;
  apriPannello(
    'scheda',
    luogo.nome,
    creaSchedaLuogo(luogo, { ...opzioni, onLuce: apriLuce, onSalvaSpot: nuovoSpot, onMappa }),
    livelloEbird.togliEvidenziazione,
  );
  if (vista === 'mappa') mostraSopraAlPannello(luogo, 0.55);
}

// --- Luce e meteo
let pannelloLuce = null;

function apriLuce(punto, quando) {
  if (vista === 'elenco') impostaVista('mappa'); // la direzione del sole si vede sulla mappa
  if (pannelloAperto === 'luce' && pannelloLuce && !quando) {
    pannelloLuce.impostaPunto(punto);
  } else {
    // Chiudiamo prima il pannello precedente: la sua chiusura non deve
    // cancellare il disegno del sole appena creato
    chiudiSheet();
    pannelloLuce = creaPannelloLuce({ punto, quando, onSole: livelloSole.aggiorna, onSalvaSpot: nuovoSpot, onQuandoAndare: apriQuandoAndare });
    apriPannello(
      'luce',
      t('luce.titolo'),
      pannelloLuce.elemento,
      () => {
        livelloSole.nascondi();
        pannelloLuce = null;
      },
      'sheet-basso',
    );
  }
  mostraSopraAlPannello(punto, 0.55);
}

// "Quando andare": le migliori ore dorate dei prossimi giorni in un punto;
// toccando una finestra si apre il pannello luce su quel giorno e quell'ora
function apriQuandoAndare(punto, titolo) {
  apriPannello(
    'andare',
    titolo ? `${t('andare.titolo')} · ${titolo}` : t('andare.titolo'),
    creaQuandoAndare(punto, { onApri: (f) => apriLuce(punto, f.inizio) }),
  );
}

// Sposta la mappa in modo che il punto stia al centro della parte non coperta dal pannello.
// `altezzaMassima` è l'altezza massima del pannello in frazione dello schermo
// (come nel CSS: 0.55, cioè il pannello aperto a metà)
function mostraSopraAlPannello({ lat, lng }, altezzaMassima) {
  const contenitore = mappa.getContainer().getBoundingClientRect();
  let visibile; // area della mappa visibile, in coordinate del contenitore
  if (window.innerWidth >= 700) {
    // su schermi larghi il pannello è una colonna a sinistra
    const pannello = document.getElementById('sheet');
    const bordoDestro = pannello.offsetLeft + pannello.offsetWidth + 16;
    visibile = { x1: Math.max(0, bordoDestro - contenitore.left), x2: contenitore.width, y1: 0, y2: contenitore.height };
  } else {
    // il pannello può essere più basso del massimo se il contenuto è breve
    const altoPannello = Math.min(document.getElementById('sheet').offsetHeight, window.innerHeight * altezzaMassima);
    const fondo = Math.min(contenitore.height, window.innerHeight - altoPannello - contenitore.top);
    visibile = { x1: 0, x2: contenitore.width, y1: 0, y2: fondo };
  }
  if (visibile.y2 - visibile.y1 < 120) return; // troppo poco spazio: lasciamo stare
  const attuale = mappa.latLngToContainerPoint([lat, lng]);
  const dx = attuale.x - (visibile.x1 + visibile.x2) / 2;
  const dy = attuale.y - (visibile.y1 + visibile.y2) / 2;
  if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
  ignoraProssimoSpostamento = true;
  mappa.panBy([dx, dy]);
}

// Il pulsante apre luce e meteo sulla mia posizione (o sul centro della mappa)
document.getElementById('light').addEventListener('click', () => {
  const c = mappa.getCenter();
  apriLuce(stato.posizioneGps || { lat: c.lat, lng: c.lng });
});

// --- Filtri
function aggiornaBadge() {
  const n = contaFiltriAttivi(stato.filtri);
  elBadge.hidden = n === 0;
  elBadge.textContent = n;
}

function apriFiltri() {
  const pannello = creaPannelloFiltri(
    stato.filtri,
    (filtri) => {
      salvaFiltri(filtri);
      aggiornaBadge();
      aggiornaSpotSullaMappa();
      caricaConCalma();
    },
    { ebirdDisponibile: Boolean(impostazioni.chiaveEbird), onApriImpostazioni: apriImpostazioni },
  );
  apriPannello('filtri', t('filtri'), pannello);
}
document.getElementById('open-filters').addEventListener('click', apriFiltri);
aggiornaBadge();

// --- Impostazioni
function aggiornaAttribuzioneEbird() {
  mappa.attributionControl.removeAttribution(ATTRIBUZIONE_EBIRD);
  if (impostazioni.chiaveEbird) mappa.attributionControl.addAttribution(ATTRIBUZIONE_EBIRD);
}
aggiornaAttribuzioneEbird();

function apriImpostazioni() {
  const pannello = creaPannelloImpostazioni((nuove, cosa) => {
    Object.assign(impostazioni, nuove);
    // Raggio e gruppi predefiniti valgono dalla prossima apertura;
    // la chiave eBird invece cambia subito i dati
    if (cosa === 'chiave') {
      aggiornaAttribuzioneEbird();
      caricaDati();
    }
    aggiornaBadge();
  }, { onApriInfo: apriInfo });
  apriPannello('impostazioni', t('impostazioni'), pannello);
}
document.getElementById('settings').addEventListener('click', apriImpostazioni);

// --- Diario degli spot
let spotAperto = null; // id dello spot mostrato nella scheda
let moduloSpot = null; // modulo di creazione/modifica aperto

function aggiornaSpotSullaMappa() {
  livelloSpot.aggiorna(leggiSpot(), effettivi(stato.filtri).livelli.spot);
}
aggiornaSpotSullaMappa();

function puntoDiRiferimento() {
  const c = mappa.getCenter();
  return stato.posizioneGps || { lat: c.lat, lng: c.lng };
}

let schedaDiario = 'spot';
function apriDiario(messaggio) {
  const diario = creaDiario({
    spot: leggiSpot(),
    riferimento: puntoDiRiferimento(),
    messaggio,
    scheda: schedaDiario,
    onScheda: (s) => {
      schedaDiario = s;
      apriDiario();
    },
    onEliminaFotografata: (id) => {
      eliminaFotografata(id);
      apriDiario();
    },
    onApri: apriSpot,
    onNuovo: () => nuovoSpot(puntoDiRiferimento()),
    onEsporta: scaricaBackup,
    onImporta: async (testo) => {
      try {
        const esito = await importaJson(testo);
        aggiornaSpotSullaMappa();
        await caricaTracce(); // il backup può contenere tracce GPX
        apriDiario({ testo: `${t('spot.importati', esito)} ${t('foto.importate', esito)}`, tipo: 'ok' });
      } catch {
        apriDiario({ testo: t('spot.importaErrore'), tipo: 'errore' });
      }
    },
  });
  apriPannello('diario', t('spot.titolo'), diario);
}
document.getElementById('diary').addEventListener('click', () => apriDiario());

async function scaricaBackup() {
  const url = URL.createObjectURL(new Blob([await esportaJson()], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `wildspot-spot-${dataIso(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function apriSpot(s) {
  const ricarica = (aggiornato) => {
    aggiornaSpotSullaMappa();
    apriSpot(aggiornato);
  };
  const scheda = creaSchedaSpot(s, {
    onVisitaOggi: () => ricarica(aggiungiVisita(s.id, dataIso(new Date()))),
    onTogliVisita: (data) => ricarica(togliVisita(s.id, data)),
    onModifica: () => apriModuloSpot(s),
    onLuce: () => apriLuce(s),
    onQuandoAndare: () => apriQuandoAndare(s, s.nome),
    onCondividi: () => condividiSpot(s),
    onMappa: vista === 'elenco' ? () => mostraSullaMappa(s, () => livelloSpot.evidenzia(s.id), () => apriSpot(s)) : null,
    onElimina: () => {
      if (!window.confirm(t('spot.confermaElimina', { nome: s.nome }))) return;
      eliminaSpot(s.id);
      aggiornaSpotSullaMappa();
      apriDiario();
    },
  });
  apriPannello('spot', s.nome, scheda, () => {
    spotAperto = null;
    livelloSpot.togliEvidenziazione();
  });
  spotAperto = s.id;
  livelloSpot.evidenzia(s.id);
  if (vista === 'mappa') mostraSopraAlPannello(s, 0.55);
}

// Nuovo spot: `bozza` ha la posizione ed eventuali campi precompilati (nome, specie)
function nuovoSpot(bozza) {
  apriModuloSpot(bozza);
}

function apriModuloSpot(bozza) {
  const modulo = creaModuloSpot(bozza, {
    posizioneGps: stato.posizioneGps,
    onPosizione: livelloSpot.mostraAnteprima,
    onSalva: (dati) => {
      const salvato = salvaSpot(dati);
      // se il livello degli spot era spento lo riaccendiamo, altrimenti non si vedrebbe
      if (!effettivi(stato.filtri).livelli.spot) {
        stato.filtri.livelli.spot = true; // aggiunto alle selezioni
        salvaFiltri(stato.filtri);
        aggiornaBadge();
      }
      aggiornaSpotSullaMappa();
      apriSpot(salvato);
    },
    onAnnulla: () => {
      const esistente = bozza.id && trovaSpot(bozza.id);
      if (esistente) apriSpot(esistente);
      else chiudiSheet();
    },
  });
  apriPannello('moduloSpot', t(bozza.id ? 'spot.modificaTitolo' : 'spot.nuovoTitolo'), modulo, () => {
    moduloSpot = null;
    livelloSpot.nascondiAnteprima();
  });
  moduloSpot = modulo; // dopo apriPannello, che chiama l'onChiudi del pannello precedente
  // il punto del nuovo spot va mostrato sulla mappa
  if (vista === 'elenco') impostaVista('mappa');
  livelloSpot.mostraAnteprima(bozza);
  mostraSopraAlPannello(bozza, 0.55);
}

// --- Sfondo della mappa e aree protette
function apriSfondi() {
  apriPannello('sfondi', t('sfondo.titolo'), creaPannelloSfondi(sfondi));
}
document.getElementById('basemap').addEventListener('click', apriSfondi);

let segnoAree = null; // piccolo segno sul punto toccato
async function mostraAree(punto) {
  segnoAree?.remove();
  segnoAree = L.circleMarker([punto.lat, punto.lng], { radius: 6, className: 'segno-aree', interactive: false }).addTo(mappa);
  apriPannello('aree', t('aree.titolo'), el('p', { class: 'nota' }, t('aree.cerco')), () => {
    segnoAree?.remove();
    segnoAree = null;
  });
  try {
    const aree = await areeNelPunto(punto, mappa);
    if (pannelloAperto === 'aree') apriPannello('aree', t('aree.titolo'), creaSchedaAree(aree), () => segnoAree?.remove());
  } catch {
    if (pannelloAperto === 'aree') apriPannello('aree', t('aree.titolo'), el('p', { class: 'nota' }, t('aree.errore')));
  }
}

// --- Menu del tocco prolungato
let segnoPunto = null;
function apriMenuPunto(punto) {
  segnoPunto?.remove();
  segnoPunto = L.circleMarker([punto.lat, punto.lng], { radius: 7, className: 'segno-punto', interactive: false }).addTo(mappa);
  const togliSegno = () => {
    segnoPunto?.remove();
    segnoPunto = null;
  };
  apriPannello(
    'menuPunto',
    t('menu.titolo'),
    creaMenuPunto(punto, {
      onSpot: () => nuovoSpot(punto),
      onPercorsi: () => cercaPercorsiIn(punto),
      onLuce: () => apriLuce(punto),
    }),
    togliSegno,
  );
}

// --- Percorsi (OpenStreetMap) e tracce GPX
const statoPercorsi = {
  raggioKm: RAGGI_PERCORSI.includes(leggi('raggioPercorsi', 3)) ? leggi('raggioPercorsi', 3) : 3,
  tipi: [],
  centro: null,
  raggioUsato: null,
  percorsi: [],
  stato: 'vuoto', // vuoto | carico | ok | errore
  errore: '',
  tracce: [],
  tracceVisibili: leggi('tracceVisibili', []),
  messaggioGpx: null,
};
let richiestaPercorsi = null;
let cerchioPercorsi = null;
const ATTRIBUZIONE_PERCORSI = 'Percorsi <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> (ODbL)';

function percorsiVisibili() {
  return statoPercorsi.percorsi.filter((p) => !statoPercorsi.tipi.length || statoPercorsi.tipi.includes(p.tipo));
}

function ridisegnaPercorsi() {
  if (statoPercorsi.percorsi.length) livelloPercorsi.mostraPercorsi(percorsiVisibili());
  else livelloPercorsi.nascondiPercorsi();
  livelloPercorsi.mostraTracce(statoPercorsi.tracce.filter((tr) => statoPercorsi.tracceVisibili.includes(tr.id)));
  mappa.attributionControl.removeAttribution(ATTRIBUZIONE_PERCORSI);
  if (statoPercorsi.percorsi.length) mappa.attributionControl.addAttribution(ATTRIBUZIONE_PERCORSI);
}

async function caricaTracce() {
  try {
    statoPercorsi.tracce = await leggiTracce();
  } catch {
    statoPercorsi.tracce = [];
  }
  ridisegnaPercorsi();
}
caricaTracce();

function apriPercorsi() {
  if (vista === 'elenco') impostaVista('mappa');
  apriPannello(
    'percorsi',
    t('percorsi.titolo'),
    creaPannelloPercorsi(statoPercorsi, {
      onRaggio: (km) => {
        statoPercorsi.raggioKm = km;
        scrivi('raggioPercorsi', km);
        apriPercorsi();
      },
      onTipo: (tipo) => {
        const tipi = statoPercorsi.tipi;
        statoPercorsi.tipi = tipi.includes(tipo) ? tipi.filter((x) => x !== tipo) : [...tipi, tipo];
        if (statoPercorsi.tipi.length === 3) statoPercorsi.tipi = []; // tutti = nessun filtro
        ridisegnaPercorsi();
        apriPercorsi();
      },
      onCercaQui: () => {
        const c = mappa.getCenter();
        cercaPercorsiIn({ lat: c.lat, lng: c.lng });
      },
      onApriPercorso: (p) => apriPercorso(p, { inquadra: true }),
      onNascondi: () => {
        richiestaPercorsi?.abort();
        Object.assign(statoPercorsi, { percorsi: [], stato: 'vuoto', centro: null });
        cerchioPercorsi?.remove();
        cerchioPercorsi = null;
        ridisegnaPercorsi();
        apriPercorsi();
      },
      onImportaGpx: async (file) => {
        let ok = 0;
        let ultima = null;
        for (const f of file) {
          try {
            ultima = await importaTraccia(f);
            ok++;
          } catch {
            // continua con gli altri file
          }
        }
        if (ultima) statoPercorsi.tracceVisibili = [...new Set([...statoPercorsi.tracceVisibili, ultima.id])];
        scrivi('tracceVisibili', statoPercorsi.tracceVisibili);
        statoPercorsi.messaggioGpx =
          ok === file.length
            ? { testo: t('gpx.importate', { n: ok }), tipo: 'ok' }
            : { testo: t('gpx.erroreFile', { n: file.length - ok }), tipo: 'errore' };
        await caricaTracce();
        if (ultima) inquadraTratti(ultima.tratti);
        apriPercorsi();
      },
      onApriTraccia: (tr) => apriTraccia(tr, { inquadra: true }),
      onMostraTraccia: (tr) => {
        const v = statoPercorsi.tracceVisibili;
        statoPercorsi.tracceVisibili = v.includes(tr.id) ? v.filter((id) => id !== tr.id) : [...v, tr.id];
        scrivi('tracceVisibili', statoPercorsi.tracceVisibili);
        ridisegnaPercorsi();
        apriPercorsi();
      },
    }),
    () => {
      statoPercorsi.messaggioGpx = null;
    },
  );
}
document.getElementById('trails').addEventListener('click', apriPercorsi);

// Cerca i percorsi intorno a un punto (con un'attesa minima tra ricerche ravvicinate)
let ultimaRicercaPercorsi = 0;
async function cercaPercorsiIn(punto) {
  if (Date.now() - ultimaRicercaPercorsi < 1500) return;
  ultimaRicercaPercorsi = Date.now();
  richiestaPercorsi?.abort();
  const controller = new AbortController();
  richiestaPercorsi = controller;
  const raggioKm = statoPercorsi.raggioKm;
  Object.assign(statoPercorsi, { centro: punto, stato: 'carico', errore: '' });

  // cerchio leggero che mostra l'area della ricerca
  cerchioPercorsi?.remove();
  cerchioPercorsi = L.circle([punto.lat, punto.lng], { radius: raggioKm * 1000, className: 'raggio-percorsi', interactive: false }).addTo(mappa);
  apriPercorsi();
  try {
    const percorsi = await cercaPercorsi(punto, raggioKm, controller.signal);
    if (controller.signal.aborted) return;
    Object.assign(statoPercorsi, { percorsi, stato: 'ok', raggioUsato: raggioKm });
    ridisegnaPercorsi();
    // inquadra l'area cercata (il punto del tocco prolungato può essere lontano dal centro)
    const b = cerchioPercorsi.getBounds();
    inquadraTratti([[[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]]);
  } catch (err) {
    if (controller.signal.aborted) return;
    statoPercorsi.stato = 'errore';
    statoPercorsi.errore = !navigator.onLine
      ? 'percorsi.offline'
      : err.status === 429
        ? 'percorsi.troppe'
        : err.lento || err.status === 504
          ? 'percorsi.lento'
          : 'percorsi.errore';
  }
  if (pannelloAperto === 'percorsi') apriPercorsi();
}

// Inquadra un tracciato nella parte di mappa non coperta dal pannello
function inquadraTratti(tratti) {
  const pannello = document.getElementById('sheet');
  const aperto = pannello.classList.contains('aperto');
  let alto = [30, 30];
  let basso = [30, 30];
  if (aperto && window.innerWidth >= 700) alto = [pannello.offsetLeft + pannello.offsetWidth + 30, 30];
  else if (aperto) basso = [30, Math.min(pannello.offsetHeight, window.innerHeight * 0.55) + 20];
  ignoraProssimoSpostamento = true;
  mappa.fitBounds(L.latLngBounds(tratti.flat()), { paddingTopLeft: alto, paddingBottomRight: basso, maxZoom: 16 });
}

// Osservazioni caricate entro 500 m da un tracciato (le oscurate non contano)
const DISTANZA_VICINI_M = 500;
function avvistamentiVicini(tratti) {
  const voci = [];
  const idInat = new Set();
  const idEbird = new Set();
  for (const o of ultimiDati.osservazioni) {
    if (o.oscurata) continue;
    const d = distanzaDaTrattiM(o, tratti);
    if (d <= DISTANZA_VICINI_M) {
      idInat.add(o.id);
      voci.push({ tipo: 'inat', gruppo: o.gruppo, titolo: o.nomeComune || o.nomeSci, fonte: 'iNaturalist', distanzaM: d, apri: () => apriScheda(o) });
    }
  }
  if (ultimiDati.visibili.avvistamenti) {
    for (const luogo of ultimiDati.luoghi) {
      if (!luogo.avvistamenti.length) continue;
      const d = distanzaDaTrattiM(luogo, tratti);
      if (d <= DISTANZA_VICINI_M) {
        idEbird.add(luogo.locId);
        const specie = new Set(luogo.avvistamenti.map((a) => a.codiceSpecie)).size;
        voci.push({
          tipo: 'ebird', specie, notevole: luogo.notevole, titolo: luogo.nome, fonte: 'eBird', distanzaM: d,
          apri: () => apriSchedaLuogo(luogo, { conAvvistamenti: true }),
        });
      }
    }
  }
  voci.sort((a, b) => a.distanzaM - b.distanzaM);
  return { voci, idInat, idEbird };
}

function evidenziaVicini(vicini) {
  livelloInat.evidenziaVicini(vicini ? vicini.idInat : null);
  livelloEbird.evidenziaVicini(vicini ? vicini.idEbird : null);
}

function chiudiTracciato() {
  livelloPercorsi.togliSelezione();
  evidenziaVicini(null);
}

function apriPercorso(p, { inquadra = false } = {}) {
  const vicini = avvistamentiVicini(p.tratti);
  const scheda = creaSchedaPercorso(p, {
    vicini,
    onLuce: () => apriLuce({ lat: p.tratti[0][0][0], lng: p.tratti[0][0][1] }),
    onInquadra: () => inquadraTratti(p.tratti),
  });
  const titolo = p.nome || (p.ref ? `${t('percorsi.sentiero')} ${p.ref}` : t(`percorsi.tipo.${p.tipo}`));
  apriPannello('percorso', titolo, scheda, chiudiTracciato);
  livelloPercorsi.seleziona(`p-${p.id}`);
  evidenziaVicini(vicini);
  if (inquadra) inquadraTratti(p.tratti);
}

function apriTraccia(tr, { inquadra = false } = {}) {
  // una traccia aperta dall'elenco va mostrata anche se era nascosta
  if (!statoPercorsi.tracceVisibili.includes(tr.id)) {
    statoPercorsi.tracceVisibili = [...statoPercorsi.tracceVisibili, tr.id];
    scrivi('tracceVisibili', statoPercorsi.tracceVisibili);
    ridisegnaPercorsi();
  }
  const vicini = avvistamentiVicini(tr.tratti);
  const scheda = creaSchedaTraccia(tr, {
    vicini,
    onInquadra: () => inquadraTratti(tr.tratti),
    onLuce: () => apriLuce({ lat: tr.tratti[0][0][0], lng: tr.tratti[0][0][1] }),
    onRinomina: async () => {
      const nome = window.prompt(t('gpx.nuovoNome'), tr.nome);
      if (!nome?.trim()) return;
      await rinominaTraccia(tr.id, nome);
      await caricaTracce();
      apriTraccia(statoPercorsi.tracce.find((x) => x.id === tr.id) || tr);
    },
    onElimina: async () => {
      if (!window.confirm(t('gpx.confermaElimina', { nome: tr.nome }))) return;
      await eliminaTraccia(tr.id);
      statoPercorsi.tracceVisibili = statoPercorsi.tracceVisibili.filter((id) => id !== tr.id);
      scrivi('tracceVisibili', statoPercorsi.tracceVisibili);
      await caricaTracce();
      apriPercorsi();
    },
  });
  apriPannello('traccia', tr.nome, scheda, chiudiTracciato);
  livelloPercorsi.seleziona(`t-${tr.id}`);
  evidenziaVicini(vicini);
  if (inquadra) inquadraTratti(tr.tratti);
}

// --- Legenda
function apriLegenda() {
  apriPannello('legenda', t('legenda'), creaLegenda({ ebirdDisponibile: Boolean(impostazioni.chiaveEbird), onApriInfo: apriInfo }));
}
document.getElementById('legend').addEventListener('click', apriLegenda);

// --- Informazioni
function apriInfo() {
  apriPannello('info', t('informazioni'), creaInfo());
}
// (il pulsante delle informazioni sta nelle Impostazioni e nella Legenda)

// --- Specie seguite: novità e avvisi
const elBadgeNovita = document.getElementById('alerts-badge');
function aggiornaBadgeNovita() {
  const n = nonViste();
  elBadgeNovita.hidden = n === 0;
  elBadgeNovita.textContent = n > 9 ? '9+' : n;
}
aggiornaBadgeNovita();

function apriNovita() {
  const pannello = creaPannelloNovita(leggiNovita(), {
    riferimento: stato.posizioneGps || stato.centro,
    haSeguite: leggiSeguite().length > 0,
    ultimoControllo: leggi('ultimoControllo', null),
    onApri: apriNovitaSingola,
    onSvuota: () => {
      svuotaNovita();
      aggiornaBadgeNovita();
      apriNovita();
    },
    onControlla: async () => {
      await controlla({ forzato: true });
      apriNovita();
    },
  });
  apriPannello('novita', t('segui.novita'), pannello);
  segnaTutteViste();
  aggiornaBadgeNovita();
}
document.getElementById('alerts').addEventListener('click', apriNovita);

// Apre una novità: centra la mappa e mostra la scheda
function apriNovitaSingola(n) {
  impostaVista('mappa');
  ignoraProssimoSpostamento = true;
  mappa.setView([n.dati.lat, n.dati.lng], Math.max(mappa.getZoom(), 14), { animate: false });
  if (n.fonte === 'iNaturalist') apriScheda(n.dati);
  else apriSchedaLuogo({ nome: n.dati.luogo, lat: n.dati.lat, lng: n.dati.lng, hotspot: false, avvistamenti: [n.dati], notevole: false }, { conAvvistamenti: true });
}

let ultimoControlloLocale = 0;
async function controlla({ forzato = false } = {}) {
  if (!leggiSeguite().length || !navigator.onLine) return;
  if (!forzato && Date.now() - ultimoControlloLocale < 15 * 60 * 1000) return;
  ultimoControlloLocale = Date.now();
  try {
    const nuove = await controllaNovita({
      centro: stato.posizioneGps || stato.centro,
      raggioKm: impostazioni.raggioAvvisi,
      chiaveEbird: impostazioni.chiaveEbird,
    });
    aggiornaBadgeNovita();
    if (nuove.length) {
      const prima = nuove[0].dati;
      notifica(
        t('segui.notificaTitolo', { n: nuove.length }),
        `${prima.nomeComune || prima.nomeSci} · ${prima.luogo || ''}${nuove.length > 1 ? ` (+${nuove.length - 1})` : ''}`,
      );
    }
  } catch {
    // riproveremo al prossimo controllo
  }
}
// Controlli: dopo l'avvio, ogni 30 minuti e quando si torna sull'app
setTimeout(() => controlla(), 8000);
setInterval(() => controlla(), 30 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') controlla();
});

// --- Cambio di lingua
alCambioLingua(() => {
  // titoli dei pulsanti di zoom
  document.querySelector('.leaflet-control-zoom-in')?.setAttribute('title', t('mappa.ingrandisci'));
  document.querySelector('.leaflet-control-zoom-out')?.setAttribute('title', t('mappa.riduci'));
  if (ultimoMessaggio) mostraMessaggio(ultimoMessaggio.chiave, ultimoMessaggio.parametri, ultimoMessaggio.tipo);
  // Impostazioni e informazioni si ridisegnano nella nuova lingua; gli altri pannelli si chiudono
  if (pannelloAperto === 'impostazioni') apriImpostazioni();
  else if (pannelloAperto === 'info') apriInfo();
  else if (pannelloAperto === 'legenda') apriLegenda();
  else if (pannelloAperto === 'sfondi') apriSfondi();
  else if (pannelloAperto === 'novita') apriNovita();
  else if (pannelloAperto === 'percorsi') apriPercorsi();
  else if (pannelloAperto === 'diario') apriDiario();
  else if (pannelloAperto === 'spot' && spotAperto) apriSpot(trovaSpot(spotAperto));
  else if (pannelloAperto === 'moduloSpot') {
    // il modulo resta aperto: chiuderlo farebbe perdere ciò che si sta scrivendo
  }
  else if (pannelloAperto === 'luce' && pannelloLuce) {
    // ricreiamo il pannello luce nella nuova lingua, sullo stesso punto
    const punto = pannelloLuce.punto();
    chiudiSheet();
    apriLuce(punto);
  } else chiudiSheet();
  // I nomi delle specie arrivano dalle API nella lingua scelta
  caricaDati();
});

// --- Raggio (la scelta vale per la sessione; il predefinito sta nelle impostazioni)
creaSelettoreRaggio(document.querySelector('.radius'), stato.raggioKm, (km) => {
  stato.raggioKm = km;
  mostraRaggio(stato.centro, km);
  caricaConCalma();
});

// --- Posizione GPS
async function centraSuDiMe() {
  btnPosizione.disabled = true;
  mostraMessaggio('stato.cercoPosizione');
  try {
    const pos = await leggiPosizione();
    stato.centro = { lat: pos.lat, lng: pos.lng };
    stato.posizioneGps = { lat: pos.lat, lng: pos.lng };
    scrivi('ultimoCentro', stato.centro); // alla prossima apertura partiamo da qui
    mostraPosizione(pos);
    mostraRaggio(stato.centro, stato.raggioKm);
    caricaDati();
  } catch (err) {
    mostraMessaggio(err.chiave || 'gps.errore', {}, 'errore');
    // Senza GPS mostriamo comunque i dati intorno all'ultimo centro noto,
    // lasciando il messaggio d'errore visibile per qualche secondo
    setTimeout(caricaDati, 3000);
  } finally {
    btnPosizione.disabled = false;
  }
}

btnPosizione.addEventListener('click', centraSuDiMe);
impostaVista(vista);
centraSuDiMe();
