// Livello della mappa con i luoghi eBird: un indicatore per luogo.
//
// - Luogo con avvistamenti recenti: pallino del colore degli uccelli con bordo
//   verde scuro (quelli di iNaturalist hanno il bordo bianco), più grande se le
//   specie sono tante. Un anello ocra segnala specie notevoli (rare per la zona).
// - Hotspot senza avvistamenti recenti da mostrare: anello verde vuoto.

import L from 'leaflet';
import { gruppo } from './groups.js';

export function creaLivelloEbird(mappa, onSeleziona) {
  const renderer = L.canvas({ tolerance: 10 });
  const marcatori = L.layerGroup().addTo(mappa);
  let evidenziazione = null;

  /**
   * @param {object[]} luoghi   risultato di raggruppaPerLuogo
   * @param {{avvistamenti: boolean, hotspot: boolean}} visibili  livelli attivi
   */
  function aggiorna(luoghi, visibili) {
    marcatori.clearLayers();
    togliEvidenziazione();

    for (const luogo of luoghi) {
      const conAvvistamenti = visibili.avvistamenti && luogo.avvistamenti.length > 0;
      const comeHotspot = visibili.hotspot && luogo.hotspot;
      if (!conAvvistamenti && !comeHotspot) continue;

      const punto = [luogo.lat, luogo.lng];
      const marcatore = conAvvistamenti
        ? L.circleMarker(punto, {
            renderer,
            radius: Math.min(12, 6 + Math.sqrt(luogo.avvistamenti.length) * 1.2),
            color: luogo.notevole ? '#c98301' : '#1b3f26',
            weight: luogo.notevole ? 4 : 2,
            fillColor: gruppo('Aves').colore,
            fillOpacity: 0.95,
          })
        : L.circleMarker(punto, {
            renderer,
            radius: 6,
            color: '#275936',
            weight: 3,
            fillColor: '#faf7f0',
            fillOpacity: 1,
          });

      marcatore.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSeleziona(luogo, { conAvvistamenti });
        evidenzia(luogo);
      });
      marcatore.addTo(marcatori);
    }
  }

  function evidenzia(luogo) {
    togliEvidenziazione();
    evidenziazione = L.circleMarker([luogo.lat, luogo.lng], {
      radius: 16,
      color: '#111',
      weight: 3,
      fill: false,
      interactive: false,
    }).addTo(mappa);
  }

  function togliEvidenziazione() {
    if (evidenziazione) evidenziazione.remove();
    evidenziazione = null;
  }

  return { aggiorna, togliEvidenziazione };
}
