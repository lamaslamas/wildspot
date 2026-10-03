// Percorsi OpenStreetMap e tracce GPX sulla mappa.
//
// Ogni linea è disegnata "incamiciata": bordo scuro, filetto bianco e colore
// al centro, così non si confonde con i contorni colorati delle aree protette.
// Sopra c'è una linea trasparente molto larga che rende facile cliccarla anche
// col mouse. Se nel punto cliccato passano più percorsi (capita spesso: un
// sentiero CAI e un cammino sullo stesso tratto) si chiede quale aprire.

import L from './leaflet-global.js';
import { COLORI_PERCORSO } from './trails.js';
import { distanzaDaTrattiM } from './geo.js';

export const COLORE_TRACCIA = '#ffd43b'; // giallo: le tracce GPX sono "tue" e devono risaltare
const TOLLERANZA_PX = 14; // distanza dal clic entro cui un percorso è "toccato"

export function creaLivelloPercorsi(mappa, { onPercorso, onTraccia, onScelta }) {
  // sopra le aree protette e la heatmap, sotto gli indicatori
  mappa.createPane('percorsi').style.zIndex = 390;
  const renderer = L.svg({ pane: 'percorsi', padding: 0.5 });
  const gruppo = L.layerGroup().addTo(mappa);
  let elementi = new Map(); // chiave -> { strati, dati, tipo: 'percorso'|'traccia' }
  let percorsi = [];
  let tracce = [];
  let selezionato = null;

  // metri corrispondenti a un pixel alla latitudine e allo zoom attuali
  function metriPerPixel(lat) {
    return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (mappa.getZoom() + 8);
  }

  // Clic su una linea: cerca tutti i percorsi e le tracce vicini al punto
  function cliccato(e) {
    L.DomEvent.stopPropagation(e);
    const punto = { lat: e.latlng.lat, lng: e.latlng.lng };
    const soglia = TOLLERANZA_PX * metriPerPixel(punto.lat);
    const vicini = [];
    for (const { dati, tipo } of elementi.values()) {
      const d = distanzaDaTrattiM(punto, dati.tratti);
      if (d <= soglia) vicini.push({ dati, tipo, d });
    }
    vicini.sort((a, b) => a.d - b.d);
    if (vicini.length <= 1) {
      const v = vicini[0];
      if (!v) return;
      if (v.tipo === 'traccia') onTraccia(v.dati);
      else onPercorso(v.dati);
    } else {
      onScelta(vicini.map(({ dati, tipo }) => ({ dati, tipo })));
    }
  }

  function aggiungi(chiave, dati, tipo, colore, tratteggio) {
    const base = { renderer, lineCap: 'round', lineJoin: 'round' };
    const strati = {
      scuro: L.polyline(dati.tratti, { ...base, interactive: false, color: '#1a1a1a', weight: 9, opacity: 0.85 }),
      bianco: L.polyline(dati.tratti, { ...base, interactive: false, color: '#fff', weight: 7, opacity: 1 }),
      colore: L.polyline(dati.tratti, { ...base, interactive: false, color: colore, weight: 4, opacity: 1, dashArray: tratteggio }),
      // linea invisibile larga: l'area cliccabile
      tocco: L.polyline(dati.tratti, { ...base, interactive: true, color: '#000', weight: 24, opacity: 0, className: 'linea-tocco' }),
    };
    strati.tocco.on('click', cliccato);
    strati.tocco.bindTooltip(dati.nome || dati.ref || '', { sticky: true, direction: 'top', className: 'suggerimento-percorso' });
    for (const s of Object.values(strati)) s.addTo(gruppo);
    elementi.set(chiave, { strati, dati, tipo });
  }

  function ridisegna() {
    gruppo.clearLayers();
    elementi = new Map();
    for (const p of percorsi) aggiungi(`p-${p.id}`, p, 'percorso', COLORI_PERCORSO[p.tipo], p.tipo === 'bici' ? '2 8' : null);
    for (const t of tracce) aggiungi(`t-${t.id}`, t, 'traccia', COLORE_TRACCIA);
    aggiornaStile();
  }

  function aggiornaStile() {
    for (const [chiave, { strati }] of elementi) {
      const attivo = chiave === selezionato;
      const opaco = selezionato && !attivo ? 0.3 : 1;
      strati.scuro.setStyle({ weight: attivo ? 13 : 9, opacity: 0.85 * opaco });
      strati.bianco.setStyle({ weight: attivo ? 11 : 7, opacity: opaco });
      strati.colore.setStyle({ weight: attivo ? 7 : 4, opacity: opaco });
    }
    // il selezionato sopra gli altri (la linea di tocco sempre in cima)
    const sel = elementi.get(selezionato);
    if (sel) ['scuro', 'bianco', 'colore', 'tocco'].forEach((k) => sel.strati[k].bringToFront());
  }

  return {
    // Mostra percorsi (già filtrati per tipo) e tracce; liste vuote = niente
    mostra(nuoviPercorsi, nuoveTracce) {
      percorsi = nuoviPercorsi;
      tracce = nuoveTracce;
      ridisegna();
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
