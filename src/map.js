// Creazione della mappa Leaflet e disegno di posizione e raggio di ricerca.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from './i18n.js';

// Centro di riserva se il GPS non è disponibile: il centro Italia
export const CENTRO_PREDEFINITO = { lat: 42.5, lng: 12.5 };

let mappa;
let indicatorePosizione; // pallino blu con la mia posizione
let cerchioPrecisione;   // alone della precisione GPS
let cerchioRaggio;       // area di ricerca

export function creaMappa(idElemento) {
  mappa = L.map(idElemento, {
    zoomControl: false, // aggiunto sotto, con etichette tradotte
    maxZoom: 19, // serve al raggruppamento dei punti; lo sfondo arriva dopo (basemaps.js)
  }).setView([CENTRO_PREDEFINITO.lat, CENTRO_PREDEFINITO.lng], 6);


  // Pulsanti + e −: utili col mouse e per zoomare con una mano sola
  L.control.zoom({ position: 'topleft', zoomInTitle: t('mappa.ingrandisci'), zoomOutTitle: t('mappa.riduci') }).addTo(mappa);
  L.control.scale({ imperial: false, position: 'topleft' }).addTo(mappa);

  return mappa;
}

// Mostra (o sposta) l'indicatore della mia posizione
export function mostraPosizione({ lat, lng, precisione }) {
  const punto = [lat, lng];
  if (!indicatorePosizione) {
    cerchioPrecisione = L.circle(punto, {
      radius: precisione,
      className: 'gps-precisione',
      interactive: false,
    }).addTo(mappa);
    indicatorePosizione = L.circleMarker(punto, {
      radius: 8,
      className: 'gps-punto',
      interactive: false,
    }).addTo(mappa);
  } else {
    indicatorePosizione.setLatLng(punto);
    cerchioPrecisione.setLatLng(punto).setRadius(precisione);
  }
}

// Disegna il cerchio del raggio di ricerca.
// Con `adatta` (predefinito) lo zoom cambia per contenere tutto il cerchio;
// quando è l'utente a spostare la mappa, invece, la vista resta com'è.
export function mostraRaggio(centro, raggioKm, { adatta = true } = {}) {
  const punto = [centro.lat, centro.lng];
  if (!cerchioRaggio) {
    cerchioRaggio = L.circle(punto, {
      radius: raggioKm * 1000,
      className: 'raggio-ricerca',
      interactive: false,
    }).addTo(mappa);
  } else {
    cerchioRaggio.setLatLng(punto).setRadius(raggioKm * 1000);
  }
  if (adatta) mappa.fitBounds(cerchioRaggio.getBounds(), { padding: [16, 16] });
}
