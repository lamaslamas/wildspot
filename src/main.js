// Punto di ingresso dell'app: collega mappa, GPS e selettore del raggio.

import './style.css';
import { creaMappa, mostraPosizione, mostraRaggio, CENTRO_PREDEFINITO } from './map.js';
import { leggiPosizione } from './geolocation.js';
import { creaSelettoreRaggio, RAGGI_KM } from './radius.js';
import { leggi, scrivi } from './storage.js';

// Stato dell'app: centro della ricerca e raggio in km
const stato = {
  centro: leggi('ultimoCentro', CENTRO_PREDEFINITO),
  raggioKm: leggi('raggioKm', 10),
};
if (!RAGGI_KM.includes(stato.raggioKm)) stato.raggioKm = 10;

const elStato = document.getElementById('status');
const btnPosizione = document.getElementById('locate');

function mostraMessaggio(testo, tipo = 'info') {
  elStato.textContent = testo;
  elStato.dataset.tipo = tipo;
}

creaMappa('map');
mostraRaggio(stato.centro, stato.raggioKm);

creaSelettoreRaggio(document.querySelector('.radius'), stato.raggioKm, (km) => {
  stato.raggioKm = km;
  scrivi('raggioKm', km);
  mostraRaggio(stato.centro, km);
});

async function centraSuDiMe() {
  btnPosizione.disabled = true;
  mostraMessaggio('Cerco la tua posizione…');
  try {
    const pos = await leggiPosizione();
    stato.centro = { lat: pos.lat, lng: pos.lng };
    scrivi('ultimoCentro', stato.centro); // alla prossima apertura partiamo da qui
    mostraPosizione(pos);
    mostraRaggio(stato.centro, stato.raggioKm);
    mostraMessaggio(`Posizione trovata (±${Math.round(pos.precisione)} m)`);
  } catch (err) {
    mostraMessaggio(err.message, 'errore');
  } finally {
    btnPosizione.disabled = false;
  }
}

btnPosizione.addEventListener('click', centraSuDiMe);
centraSuDiMe();
