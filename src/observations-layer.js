// Livello della mappa con le osservazioni (per ora da iNaturalist).
//
// - Osservazione con posizione precisa: pallino pieno del colore del gruppo.
// - Osservazione con posizione oscurata: cerchio sfumato grande quanto l'area di
//   incertezza dichiarata dall'API, più un anello tratteggiato al centro su cui
//   toccare. Il centro NON è la posizione reale: è solo il punto pubblico casuale.

import L from 'leaflet';
import { gruppo } from './groups.js';

export function creaLivelloOsservazioni(mappa, onSeleziona) {
  // Pannello sotto ai marcatori per le aree di incertezza
  mappa.createPane('incertezza').style.zIndex = 350;

  // Il renderer canvas con "tolerance" allarga l'area toccabile dei pallini:
  // sul telefono si centrano anche con il pollice
  const renderer = L.canvas({ tolerance: 10 });

  const aree = L.layerGroup().addTo(mappa);
  const marcatori = L.layerGroup().addTo(mappa);
  let evidenziazione = null; // anello attorno all'osservazione selezionata

  function aggiorna(osservazioni) {
    aree.clearLayers();
    marcatori.clearLayers();
    togliEvidenziazione();

    for (const o of osservazioni) {
      const { colore } = gruppo(o.gruppo);
      const punto = [o.lat, o.lng];
      let marcatore;

      if (o.oscurata) {
        L.circle(punto, {
          pane: 'incertezza',
          radius: o.incertezzaM,
          stroke: false,
          fillColor: colore,
          fillOpacity: 0.06,
          interactive: false,
        }).addTo(aree);
        marcatore = L.circleMarker(punto, {
          renderer,
          radius: 7,
          color: colore,
          weight: 3,
          dashArray: '3 3',
          fillColor: '#fff',
          fillOpacity: 0.9,
        });
      } else {
        marcatore = L.circleMarker(punto, {
          renderer,
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: colore,
          fillOpacity: 0.95,
        });
      }

      marcatore.on('click', (e) => {
        L.DomEvent.stopPropagation(e); // non far arrivare il tocco alla mappa
        onSeleziona(o); // prima la scheda: aprendola si toglie l'evidenziazione precedente
        evidenzia(o);
      });
      marcatore.addTo(marcatori);
    }
  }

  function evidenzia(o) {
    togliEvidenziazione();
    const punto = [o.lat, o.lng];
    evidenziazione = L.layerGroup().addTo(mappa);
    if (o.oscurata) {
      // Mostriamo il bordo dell'area entro cui si trova davvero l'osservazione
      L.circle(punto, {
        pane: 'incertezza',
        radius: o.incertezzaM,
        color: gruppo(o.gruppo).colore,
        weight: 2,
        dashArray: '6 6',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(evidenziazione);
    }
    L.circleMarker(punto, {
      radius: 13,
      color: '#111',
      weight: 3,
      fill: false,
      interactive: false,
    }).addTo(evidenziazione);
  }

  function togliEvidenziazione() {
    if (evidenziazione) evidenziazione.remove();
    evidenziazione = null;
  }

  return { aggiorna, togliEvidenziazione };
}
