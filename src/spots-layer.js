// I miei spot sulla mappa: segnaposto ocra a goccia (come nel logo).
// Non vengono raggruppati: sono pochi e importanti, devono restare sempre visibili.

import L from './leaflet-global.js';

// HTML del segnaposto (usato anche nella legenda e nei filtri)
export const HTML_SPOT =
  '<span class="mk-spot"><svg viewBox="0 0 28 38" aria-hidden="true">' +
  '<path d="M14 1.5C7.1 1.5 1.8 6.8 1.8 13.5c0 8.8 12.2 22.8 12.2 22.8s12.2-14 12.2-22.8C26.2 6.8 20.9 1.5 14 1.5z"/>' +
  '<circle cx="14" cy="13.5" r="4.8"/></svg></span>';

export function creaLivelloSpot(mappa, onSeleziona) {
  const gruppo = L.layerGroup().addTo(mappa);
  let indicatori = new Map(); // id -> marker
  let idSelezionato = null;

  function aggiorna(spot, visibile) {
    gruppo.clearLayers();
    indicatori = new Map();
    if (!visibile) return;
    for (const s of spot) {
      const indicatore = L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: 'mk-involucro-spot', html: HTML_SPOT, iconSize: [28, 38], iconAnchor: [14, 37] }),
        title: s.nome,
        alt: s.nome,
        zIndexOffset: 1000, // sopra a osservazioni e luoghi eBird
        riseOnHover: true,
      });
      indicatore.on('click', () => onSeleziona(s));
      indicatore.addTo(gruppo);
      indicatori.set(s.id, indicatore);
    }
    evidenzia(idSelezionato);
  }

  function evidenzia(id) {
    for (const [chiave, indicatore] of indicatori) {
      indicatore.getElement()?.querySelector('.mk-spot')?.classList.toggle('mk-selezionato', chiave === id);
    }
    idSelezionato = id;
  }

  // Anteprima semitrasparente dello spot che si sta creando o modificando
  let anteprima = null;
  function mostraAnteprima({ lat, lng }) {
    if (!anteprima) {
      anteprima = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'mk-involucro-spot anteprima', html: HTML_SPOT, iconSize: [28, 38], iconAnchor: [14, 37] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
      }).addTo(mappa);
    } else {
      anteprima.setLatLng([lat, lng]);
    }
  }
  function nascondiAnteprima() {
    anteprima?.remove();
    anteprima = null;
  }

  return { aggiorna, evidenzia, togliEvidenziazione: () => evidenzia(null), mostraAnteprima, nascondiAnteprima };
}
