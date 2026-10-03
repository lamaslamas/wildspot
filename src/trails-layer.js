// Percorsi OpenStreetMap e tracce GPX sulla mappa.
// Ogni linea ha un bordo bianco per staccarsi dallo sfondo; il percorso
// selezionato diventa più spesso e gli altri si attenuano.

import L from './leaflet-global.js';
import { COLORI_PERCORSO } from './trails.js';

const COLORE_TRACCIA = '#212529';

export function creaLivelloPercorsi(mappa, { onPercorso, onTraccia }) {
  // sopra le aree protette e la heatmap, sotto gli indicatori
  mappa.createPane('percorsi').style.zIndex = 390;
  const renderer = L.svg({ pane: 'percorsi', padding: 0.5 });
  const gruppoPercorsi = L.layerGroup().addTo(mappa);
  const gruppoTracce = L.layerGroup().addTo(mappa);
  let linee = new Map(); // chiave -> { bordo, linea, colore }
  let selezionato = null;

  function disegna(gruppo, chiave, tratti, colore, onClick, tratteggio) {
    const opzioni = { renderer, interactive: true, lineCap: 'round', lineJoin: 'round' };
    const bordo = L.polyline(tratti, { ...opzioni, color: '#fff', weight: 8, opacity: 0.9 });
    const linea = L.polyline(tratti, { ...opzioni, color: colore, weight: 4, opacity: 0.95, dashArray: tratteggio });
    for (const l of [bordo, linea]) {
      l.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onClick();
      });
      l.addTo(gruppo);
    }
    linee.set(chiave, { bordo, linea, colore });
  }

  function aggiornaStile() {
    for (const [chiave, { bordo, linea }] of linee) {
      const attivo = chiave === selezionato;
      const attenuato = selezionato && !attivo;
      linea.setStyle({ weight: attivo ? 7 : 4, opacity: attenuato ? 0.35 : 0.95 });
      bordo.setStyle({ weight: attivo ? 12 : 8, opacity: attenuato ? 0.3 : 0.9 });
      if (attivo) {
        bordo.bringToFront();
        linea.bringToFront();
      }
    }
  }

  function rimuovi(prefisso) {
    for (const chiave of [...linee.keys()]) if (chiave.startsWith(prefisso)) linee.delete(chiave);
  }

  return {
    // Percorsi trovati, già filtrati per tipo
    mostraPercorsi(percorsi) {
      gruppoPercorsi.clearLayers();
      rimuovi('p-');
      for (const p of percorsi) {
        disegna(gruppoPercorsi, `p-${p.id}`, p.tratti, COLORI_PERCORSO[p.tipo], () => onPercorso(p), p.tipo === 'bici' ? '1 7' : null);
      }
      aggiornaStile();
    },
    nascondiPercorsi() {
      gruppoPercorsi.clearLayers();
      rimuovi('p-');
    },
    // Tracce GPX visibili
    mostraTracce(tracce) {
      gruppoTracce.clearLayers();
      rimuovi('t-');
      for (const t of tracce) disegna(gruppoTracce, `t-${t.id}`, t.tratti, COLORE_TRACCIA, () => onTraccia(t));
      aggiornaStile();
    },
    seleziona(chiave) {
      selezionato = chiave;
      aggiornaStile();
    },
    togliSelezione() {
      selezionato = null;
      aggiornaStile();
    },
  };
}
