// Indicatori della mappa: HTML degli indicatori (usato anche dalla legenda) e
// raggruppamento automatico dei punti vicini, condiviso da iNaturalist ed eBird.
//
// Forme diverse per fonti diverse:
// - iNaturalist: badge rotondo con l'icona del gruppo, del colore del gruppo
//   (posizione oscurata: badge chiaro con bordo tratteggiato)
// - eBird: etichetta rettangolare verde con binocolo e numero di specie
//   (stella e bordo ocra se ci sono specie notevoli)
// - hotspot eBird senza avvistamenti recenti: etichetta chiara più piccola

import L from './leaflet-global.js';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css'; // animazioni del raggruppamento
import { iconaGruppo, ICONA_BINOCOLO } from './icons.js';
import { gruppo } from './groups.js';

export function htmlOsservazione(idGruppo, oscurata = false) {
  const { colore } = gruppo(idGruppo);
  return `<span class="mk mk-inat${oscurata ? ' mk-oscurata' : ''}" style="--c:${colore}">${iconaGruppo(idGruppo)}</span>`;
}

export function htmlLuogoEbird(numeroSpecie, notevole = false) {
  return `<span class="mk mk-ebird${notevole ? ' mk-notevole' : ''}">${ICONA_BINOCOLO}<b>${notevole ? '★ ' : ''}${numeroSpecie}</b></span>`;
}

export function htmlHotspot() {
  return `<span class="mk mk-hotspot">${ICONA_BINOCOLO}</span>`;
}

// Indicatore Leaflet con l'HTML dato. L'involucro ha dimensione zero e il
// contenuto è centrato sul punto via CSS, così le etichette possono avere
// larghezza variabile.
export function creaIndicatore(latlng, html, { titolo, sopra = false } = {}) {
  return L.marker(latlng, {
    icon: L.divIcon({ className: 'mk-involucro', html, iconSize: null }),
    title: titolo, // suggerimento e nome per i lettori di schermo
    alt: titolo,
    zIndexOffset: sopra ? 100 : 0,
    riseOnHover: true,
  });
}

// Raggruppamento: i punti vicini diventano una bolla con il numero;
// toccandola si ingrandisce la zona. Da zoom 15 in su ogni punto è separato.
export function creaRaggruppamento(mappa) {
  return L.markerClusterGroup({
    maxClusterRadius: 44,
    disableClusteringAtZoom: 15,
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    chunkedLoading: true,
    iconCreateFunction(cluster) {
      const n = cluster.getChildCount();
      const misura = n < 10 ? 36 : n < 100 ? 42 : 48;
      return L.divIcon({
        className: 'mk-gruppo',
        html: `<span>${n}</span>`,
        iconSize: L.point(misura, misura),
      });
    },
  }).addTo(mappa);
}

// Evidenzia l'indicatore selezionato (se è visibile, cioè non dentro una bolla)
export function evidenziaIndicatore(indicatore, attivo) {
  indicatore?.getElement()?.querySelector('.mk')?.classList.toggle('mk-selezionato', attivo);
}
