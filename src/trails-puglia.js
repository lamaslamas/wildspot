// Percorsi della Puglia da un file GeoJSON preparato in anticipo
// (public/data/percorsi-puglia.geojson, generato da scripts/percorsi-puglia.mjs).
// È la fonte principale in Puglia: veloce, senza limiti e disponibile offline.
// Se il file non c'è, o il punto è fuori dalla Puglia, si restituisce null e
// l'app usa Overpass.

import { distanzaDaTrattiM } from './geo.js';

const URL_FILE = `${import.meta.env.BASE_URL}data/percorsi-puglia.geojson`;

let caricamento = null; // Promise<{confine, percorsi} | null>

async function carica() {
  caricamento ??= (async () => {
    const r = await fetch(URL_FILE);
    if (!r.ok) return null; // file non ancora generato
    const dati = await r.json();
    if (!Array.isArray(dati.features) || !dati.confine) return null;
    // per ogni percorso: tratti [lat, lng] e riquadro, per scartare in fretta quelli lontani
    const percorsi = dati.features
      .map((f) => {
        const g = f.geometry;
        const linee = g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? g.coordinates : [];
        const tratti = linee.map((l) => l.map(([lng, lat]) => [lat, lng])).filter((l) => l.length > 1);
        if (!tratti.length) return null;
        let s = 90, o = 180, n = -90, e = -180;
        for (const l of tratti) for (const [lat, lng] of l) {
          s = Math.min(s, lat); n = Math.max(n, lat); o = Math.min(o, lng); e = Math.max(e, lng);
        }
        return { properties: f.properties, tratti, riquadro: [s, o, n, e] };
      })
      .filter(Boolean);
    return { confine: dati.confine, percorsi };
  })().catch(() => null);
  return caricamento;
}

// Punto dentro un poligono (anelli di [lng, lat]; il primo è il contorno, gli altri i buchi)
function dentroPoligono([lng, lat], anelli) {
  let dentro = false;
  for (const anello of anelli) {
    for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
      const [xi, yi] = anello[i];
      const [xj, yj] = anello[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

// Il confine è un MultiPolygon: array di poligoni
export function dentroConfine(punto, confine) {
  return confine.some((poligono) => dentroPoligono([punto.lng, punto.lat], poligono));
}

// Ritaglia i tratti al riquadro [s, o, n, e], come fa Overpass con out geom(bbox)
function ritaglia(tratti, [s, o, n, e]) {
  const dentro = ([lat, lng]) => lat >= s && lat <= n && lng >= o && lng <= e;
  const risultato = [];
  let tagliato = false;
  for (const linea of tratti) {
    let corrente = [];
    for (const p of linea) {
      if (dentro(p)) corrente.push(p);
      else {
        tagliato = true;
        if (corrente.length > 1) risultato.push(corrente);
        corrente = [];
      }
    }
    if (corrente.length > 1) risultato.push(corrente);
  }
  return { tratti: risultato, tagliato };
}

/**
 * Percorsi entro `raggioKm` dal punto, in formato GeoJSON Feature.
 * @returns {Promise<object[] | null>} null se il punto è fuori dalla Puglia o il file manca
 */
export async function percorsiPuglia(punto, raggioKm, margineKm) {
  const dati = await carica();
  if (!dati || !dentroConfine(punto, dati.confine)) return null;

  const dLat = (raggioKm + margineKm) / 111.32;
  const dLng = (raggioKm + margineKm) / (111.32 * Math.cos((punto.lat * Math.PI) / 180));
  const riquadro = [punto.lat - dLat, punto.lng - dLng, punto.lat + dLat, punto.lng + dLng];
  const raggioM = raggioKm * 1000;

  const trovati = [];
  for (const p of dati.percorsi) {
    const [s, o, n, e] = p.riquadro;
    // scarto veloce: riquadro del percorso lontano dal punto
    if (n < riquadro[0] || s > riquadro[2] || e < riquadro[1] || o > riquadro[3]) continue;
    if (distanzaDaTrattiM(punto, p.tratti) > raggioM) continue;
    const { tratti, tagliato } = ritaglia(p.tratti, riquadro);
    if (!tratti.length) continue;
    trovati.push({
      type: 'Feature',
      properties: p.properties,
      ritagliato: tagliato,
      geometry: { type: 'MultiLineString', coordinates: tratti.map((l) => l.map(([lat, lng]) => [lng, lat])) },
    });
  }
  return trovati;
}
