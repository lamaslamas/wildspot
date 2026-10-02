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
import { creaScheda, creaSchedaLuogo } from './card.js';
import { filtriIniziali, salvaFiltri, contaFiltriAttivi, creaPannelloFiltri } from './filters.js';
import { leggiImpostazioni, creaPannelloImpostazioni } from './settings.js';
import { creaInfo } from './info.js';
import { creaLegenda } from './legend.js';
import { creaPannelloLuce } from './light-panel.js';
import { creaLivelloSole } from './sun-layer.js';
import { apriSheet, chiudiSheet } from './sheet.js';
import { t, traduciPagina, alCambioLingua } from './i18n.js';
import { creaSelettoreLingua } from './language-switch.js';

// Testi dell'HTML nella lingua scelta e selettore di lingua nella presentazione
traduciPagina();
document.querySelector('[data-selettore-lingua]').append(creaSelettoreLingua());

// L'altezza della presentazione dipende dal testo e può risultare frazionaria
// (es. 634,7px): la mappa sotto finirebbe su mezzi pixel e tra le tile
// comparirebbero righe sottili. La arrotondiamo al pixel intero.
const elHero = document.querySelector('.hero');
function arrotondaAltezzaHero() {
  elHero.style.minHeight = '';
  elHero.style.minHeight = `${Math.ceil(elHero.getBoundingClientRect().height)}px`;
}
arrotondaAltezzaHero();
window.addEventListener('resize', debounce(arrotondaAltezzaHero, 150));
alCambioLingua(arrotondaAltezzaHero);

// Chi ha già raggiunto la mappa in una visita precedente la ritrova subito:
// la presentazione resta comunque sopra, basta scorrere in su
const elApp = document.getElementById('app');
if (leggi('mappaVista', false)) {
  window.scrollTo({ top: elApp.offsetTop, behavior: 'instant' });
} else {
  const osservatore = new IntersectionObserver(([voce]) => {
    if (!voce.isIntersecting) return;
    scrivi('mappaVista', true);
    osservatore.disconnect();
  }, { threshold: 0.9 });
  osservatore.observe(elApp);
}

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

// Toccando un punto vuoto della mappa: con il pannello luce aperto si sposta
// il punto; altrimenti si chiude il pannello aperto
mappa.on('click', (e) => {
  if (pannelloAperto === 'luce' && pannelloLuce) {
    pannelloLuce.impostaPunto({ lat: e.latlng.lat, lng: e.latlng.lng });
  } else {
    chiudiSheet();
  }
});

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
  const chiave = impostazioni.chiaveEbird;
  const vuoiInat = filtri.livelli.inat;
  // eBird riguarda solo gli uccelli: niente richiesta se sono esclusi dai filtri
  const uccelliInclusi = Boolean(filtri.taxon) || filtri.gruppi.includes('Aves');
  const vuoiAvvistamenti = Boolean(chiave) && filtri.livelli.ebirdAvvistamenti && uccelliInclusi;
  const vuoiHotspot = Boolean(chiave) && filtri.livelli.ebirdHotspot;
  const livelloEbirdAcceso = Boolean(chiave) && (filtri.livelli.ebirdAvvistamenti || vuoiHotspot);

  if (!vuoiInat && !livelloEbirdAcceso) {
    livelloInat.aggiorna([]);
    livelloEbird.aggiorna([], { avvistamenti: false, hotspot: false });
    mostraMessaggio('stato.nessunLivello');
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
      ? cercaOsservazioni({ ...area, giorni: filtri.giorni, gruppi: filtri.gruppi, taxonId: filtri.taxon?.id }, signal)
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
  livelloEbird.aggiorna(raggruppaPerLuogo(avvistamentiOk, hotspotOk), {
    avvistamenti: filtri.livelli.ebirdAvvistamenti,
    hotspot: filtri.livelli.ebirdHotspot,
  });

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
    onSoloSpecie: (oss) => {
      stato.filtri.taxon = { id: oss.taxonId, nomeComune: oss.nomeComune, nomeSci: oss.nomeSci };
      aggiornaBadge();
      chiudiSheet();
      caricaDati();
    },
  });
  apriPannello('scheda', o.nomeComune || o.nomeSci, scheda, livelloInat.togliEvidenziazione);
  mostraSopraAlPannello(o, 0.72);
}

function apriSchedaLuogo(luogo, opzioni) {
  apriPannello('scheda', luogo.nome, creaSchedaLuogo(luogo, { ...opzioni, onLuce: apriLuce }), livelloEbird.togliEvidenziazione);
  mostraSopraAlPannello(luogo, 0.72);
}

// --- Luce e meteo
let pannelloLuce = null;

function apriLuce(punto) {
  if (pannelloAperto === 'luce' && pannelloLuce) {
    pannelloLuce.impostaPunto(punto);
  } else {
    // Chiudiamo prima il pannello precedente: la sua chiusura non deve
    // cancellare il disegno del sole appena creato
    chiudiSheet();
    pannelloLuce = creaPannelloLuce({ punto, onSole: livelloSole.aggiorna });
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
// (come nel CSS: 0.72 normale, 0.55 per luce e meteo)
function mostraSopraAlPannello({ lat, lng }, altezzaMassima) {
  const contenitore = mappa.getContainer().getBoundingClientRect();
  let visibile; // area della mappa visibile, in coordinate del contenitore
  if (window.innerWidth >= 700) {
    // su schermi larghi il pannello sta a sinistra (420px + margine)
    visibile = { x1: Math.max(0, 436 - contenitore.left), x2: contenitore.width, y1: 0, y2: contenitore.height };
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
  const n = contaFiltriAttivi(stato.filtri, impostazioni);
  elBadge.hidden = n === 0;
  elBadge.textContent = n;
}

function apriFiltri() {
  const pannello = creaPannelloFiltri(
    stato.filtri,
    (filtri) => {
      salvaFiltri(filtri);
      aggiornaBadge();
      caricaConCalma();
    },
    { ebirdDisponibile: Boolean(impostazioni.chiaveEbird), onApriImpostazioni: apriImpostazioni, impostazioni },
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
  if (ultimoMessaggio) mostraMessaggio(ultimoMessaggio.chiave, ultimoMessaggio.parametri, ultimoMessaggio.tipo);
  // Impostazioni e informazioni si ridisegnano nella nuova lingua; gli altri pannelli si chiudono
  if (pannelloAperto === 'impostazioni') apriImpostazioni();
  else if (pannelloAperto === 'info') apriInfo();
  else if (pannelloAperto === 'legenda') apriLegenda();
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
centraSuDiMe();
