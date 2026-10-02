// Punto di ingresso dell'app: collega mappa, GPS, raggio, filtri, impostazioni
// e i dati di iNaturalist ed eBird.

import './style.css';
import { creaMappa, mostraPosizione, mostraRaggio, CENTRO_PREDEFINITO } from './map.js';
import { leggiPosizione } from './geolocation.js';
import { creaSelettoreRaggio } from './radius.js';
import { leggi, scrivi } from './storage.js';
import { debounce, distanzaKm } from './dom.js';
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
import { creaLivelloSpot } from './spots-layer.js';
import { creaLivelloHeatmap } from './heatmap-layer.js';
import { dataIso } from './weather.js';
import { apriSheet, chiudiSheet } from './sheet.js';
import { t, traduciPagina, alCambioLingua } from './i18n.js';
import { creaSelettoreLingua } from './language-switch.js';

// Testi dell'HTML nella lingua scelta e selettore di lingua nella presentazione
traduciPagina();
document.querySelector('[data-selettore-lingua]').append(creaSelettoreLingua());

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
const livelloSpot = creaLivelloSpot(mappa, apriSpot);

// Toccando un punto vuoto della mappa: con il pannello luce o il modulo di uno
// spot aperti si sposta il punto; altrimenti si chiude il pannello aperto
mappa.on('click', (e) => {
  const punto = { lat: e.latlng.lat, lng: e.latlng.lng };
  if (pannelloAperto === 'luce' && pannelloLuce) pannelloLuce.impostaPunto(punto);
  else if (pannelloAperto === 'moduloSpot' && moduloSpot) moduloSpot.impostaPosizione(punto);
  else chiudiSheet();
});

// Tenendo premuto sulla mappa si crea un nuovo spot in quel punto
mappa.on('contextmenu', (e) => nuovoSpot({ lat: e.latlng.lat, lng: e.latlng.lng }));

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
  if (!navigator.onLine) {
    mostraMessaggio('stato.offline', {}, 'errore');
    return;
  }
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
    if (!n) mostraMessaggio('stato.nessuna', parametri);
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

function apriLuce(punto) {
  if (vista === 'elenco') impostaVista('mappa'); // la direzione del sole si vede sulla mappa
  if (pannelloAperto === 'luce' && pannelloLuce) {
    pannelloLuce.impostaPunto(punto);
  } else {
    // Chiudiamo prima il pannello precedente: la sua chiusura non deve
    // cancellare il disegno del sole appena creato
    chiudiSheet();
    pannelloLuce = creaPannelloLuce({ punto, onSole: livelloSole.aggiorna, onSalvaSpot: nuovoSpot });
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
  });
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

function apriDiario(messaggio) {
  const diario = creaDiario({
    spot: leggiSpot(),
    riferimento: puntoDiRiferimento(),
    messaggio,
    onApri: apriSpot,
    onNuovo: () => nuovoSpot(puntoDiRiferimento()),
    onEsporta: scaricaBackup,
    onImporta: (testo) => {
      try {
        const esito = importaJson(testo);
        aggiornaSpotSullaMappa();
        apriDiario({ testo: t('spot.importati', esito), tipo: 'ok' });
      } catch {
        apriDiario({ testo: t('spot.importaErrore'), tipo: 'errore' });
      }
    },
  });
  apriPannello('diario', t('spot.titolo'), diario);
}
document.getElementById('diary').addEventListener('click', () => apriDiario());

function scaricaBackup() {
  const url = URL.createObjectURL(new Blob([esportaJson()], { type: 'application/json' }));
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

// --- Legenda
function apriLegenda() {
  apriPannello('legenda', t('legenda'), creaLegenda({ ebirdDisponibile: Boolean(impostazioni.chiaveEbird) }));
}
document.getElementById('legend').addEventListener('click', apriLegenda);

// --- Informazioni
function apriInfo() {
  apriPannello('info', t('informazioni'), creaInfo());
}
document.getElementById('info').addEventListener('click', apriInfo);

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
