// Punto di ingresso dell'app: collega mappa, GPS, raggio, filtri e osservazioni.

import './style.css';
import { creaMappa, mostraPosizione, mostraRaggio, CENTRO_PREDEFINITO } from './map.js';
import { leggiPosizione } from './geolocation.js';
import { creaSelettoreRaggio, RAGGI_KM } from './radius.js';
import { leggi, scrivi } from './storage.js';
import { debounce, distanzaKm } from './dom.js';
import { cercaOsservazioni } from './inaturalist.js';
import { creaLivelloOsservazioni } from './observations-layer.js';
import { creaScheda } from './card.js';
import { filtriIniziali, salvaFiltri, contaFiltriAttivi, creaPannelloFiltri } from './filters.js';
import { creaInfo } from './info.js';
import { apriSheet, chiudiSheet } from './sheet.js';

// Stato dell'app
const stato = {
  centro: leggi('ultimoCentro', CENTRO_PREDEFINITO), // centro della ricerca
  raggioKm: leggi('raggioKm', 10),
  filtri: filtriIniziali(),
};
if (!RAGGI_KM.includes(stato.raggioKm)) stato.raggioKm = 10;

const elStato = document.getElementById('status');
const btnPosizione = document.getElementById('locate');
const elBadge = document.getElementById('filters-badge');

function mostraMessaggio(testo, tipo = 'info') {
  elStato.textContent = testo;
  elStato.dataset.tipo = tipo;
}

// --- Mappa
const mappa = creaMappa('map');
mappa.attributionControl.addAttribution('<a href="https://www.inaturalist.org">iNaturalist</a>');
mostraRaggio(stato.centro, stato.raggioKm);

const livello = creaLivelloOsservazioni(mappa, apriScheda);

// Toccando un punto vuoto della mappa si chiude il pannello aperto
mappa.on('click', chiudiSheet);

// Quando l'utente sposta la mappa, la ricerca segue il nuovo centro.
// Ignoriamo i piccoli spostamenti per non fare richieste inutili.
mappa.on('moveend', () => {
  const c = mappa.getCenter();
  const nuovoCentro = { lat: c.lat, lng: c.lng };
  if (distanzaKm(nuovoCentro, stato.centro) < stato.raggioKm * 0.2) return;
  stato.centro = nuovoCentro;
  scrivi('ultimoCentro', nuovoCentro);
  mostraRaggio(nuovoCentro, stato.raggioKm, { adatta: false });
  caricaConCalma();
});

// --- Caricamento delle osservazioni
let richiestaInCorso = null;

async function caricaOsservazioni() {
  richiestaInCorso?.abort(); // una richiesta nuova rende inutile quella vecchia
  const controller = new AbortController();
  richiestaInCorso = controller;

  if (!navigator.onLine) {
    mostraMessaggio('Sei offline: osservazioni non disponibili', 'errore');
    return;
  }
  mostraMessaggio('Carico le osservazioni…');

  try {
    const { osservazioni, totale } = await cercaOsservazioni(
      {
        centro: stato.centro,
        raggioKm: stato.raggioKm,
        giorni: stato.filtri.giorni,
        gruppi: stato.filtri.gruppi,
        taxonId: stato.filtri.taxon?.id,
      },
      controller.signal,
    );
    livello.aggiorna(osservazioni);

    const periodo = `ultimi ${stato.filtri.giorni} giorni`;
    if (!osservazioni.length) {
      mostraMessaggio(`Nessuna osservazione negli ${periodo}`);
    } else if (totale > osservazioni.length) {
      mostraMessaggio(`Le ${osservazioni.length} più recenti su ${totale} · ${periodo}`);
    } else {
      mostraMessaggio(`${osservazioni.length} osservazioni · ${periodo}`);
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (err.status === 429) {
      mostraMessaggio('Troppe richieste a iNaturalist: attendi un minuto e riprova', 'errore');
    } else {
      mostraMessaggio('iNaturalist non risponde: controlla la connessione e riprova', 'errore');
    }
  }
}

// Versione con attesa, per raggruppare cambi ravvicinati (spostamenti, filtri)
const caricaConCalma = debounce(caricaOsservazioni, 700);

// Al ritorno della connessione ricarichiamo
window.addEventListener('online', caricaOsservazioni);

// --- Scheda dell'osservazione
function apriScheda(o) {
  const scheda = creaScheda(o, {
    onSoloSpecie: (oss) => {
      stato.filtri.taxon = { id: oss.taxonId, nomeIt: oss.nomeIt, nomeSci: oss.nomeSci };
      aggiornaBadge();
      chiudiSheet();
      caricaOsservazioni();
    },
  });
  apriSheet(o.nomeIt || o.nomeSci, scheda, { onChiudi: livello.togliEvidenziazione });
}

// --- Filtri
function aggiornaBadge() {
  const n = contaFiltriAttivi(stato.filtri);
  elBadge.hidden = n === 0;
  elBadge.textContent = n;
}

document.getElementById('open-filters').addEventListener('click', () => {
  apriSheet(
    'Filtri',
    creaPannelloFiltri(stato.filtri, (filtri) => {
      salvaFiltri(filtri);
      aggiornaBadge();
      caricaConCalma();
    }),
  );
});
aggiornaBadge();

// --- Informazioni
document.getElementById('info').addEventListener('click', () => {
  apriSheet('Informazioni', creaInfo());
});

// --- Raggio
creaSelettoreRaggio(document.querySelector('.radius'), stato.raggioKm, (km) => {
  stato.raggioKm = km;
  scrivi('raggioKm', km);
  mostraRaggio(stato.centro, km);
  caricaConCalma();
});

// --- Posizione GPS
async function centraSuDiMe() {
  btnPosizione.disabled = true;
  mostraMessaggio('Cerco la tua posizione…');
  try {
    const pos = await leggiPosizione();
    stato.centro = { lat: pos.lat, lng: pos.lng };
    scrivi('ultimoCentro', stato.centro); // alla prossima apertura partiamo da qui
    mostraPosizione(pos);
    mostraRaggio(stato.centro, stato.raggioKm);
    caricaOsservazioni();
  } catch (err) {
    mostraMessaggio(err.message, 'errore');
    // Senza GPS mostriamo comunque le osservazioni intorno all'ultimo centro noto,
    // lasciando il messaggio d'errore visibile per qualche secondo
    setTimeout(caricaOsservazioni, 3000);
  } finally {
    btnPosizione.disabled = false;
  }
}

btnPosizione.addEventListener('click', centraSuDiMe);
centraSuDiMe();
