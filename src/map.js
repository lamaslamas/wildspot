// Creazione della mappa Leaflet e disegno di posizione e raggio di ricerca.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Centro di riserva se il GPS non è disponibile: il centro Italia
export const CENTRO_PREDEFINITO = { lat: 42.5, lng: 12.5 };

let mappa;
let indicatorePosizione; // pallino blu con la mia posizione
let cerchioPrecisione;   // alone della precisione GPS
let cerchioRaggio;       // area di ricerca

export function creaMappa(idElemento) {
  mappa = L.map(idElemento, {
    zoomControl: false, // lo zoom si fa con le dita; i pulsanti ingombrano su mobile
  }).setView([CENTRO_PREDEFINITO.lat, CENTRO_PREDEFINITO.lng], 6);

  // Tile di OpenStreetMap: l'attribuzione è obbligatoria
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mappa);

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

// Disegna il cerchio del raggio di ricerca e adatta lo zoom per contenerlo
export function mostraRaggio(centro, raggioKm) {
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
  mappa.fitBounds(cerchioRaggio.getBounds(), { padding: [16, 16] });
}
