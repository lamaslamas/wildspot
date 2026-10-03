// Calcoli geometrici su linee (percorsi e tracce GPX).
// Le linee sono array di punti [lat, lng]; un percorso può avere più tratti.

import { distanzaKm } from './dom.js';

// Lunghezza in km di una linea
export function lunghezzaKm(linea) {
  let km = 0;
  for (let i = 1; i < linea.length; i++) {
    km += distanzaKm({ lat: linea[i - 1][0], lng: linea[i - 1][1] }, { lat: linea[i][0], lng: linea[i][1] });
  }
  return km;
}

export function lunghezzaTotaleKm(tratti) {
  return tratti.reduce((a, l) => a + lunghezzaKm(l), 0);
}

// Distanza in metri da un punto a una linea. Proiezione equirettangolare
// locale: precisa a sufficienza per distanze di qualche km.
export function distanzaDaLineaM(punto, linea) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const cosLat = Math.cos(punto.lat * rad);
  const xy = ([lat, lng]) => [(lng - punto.lng) * rad * R * cosLat, (lat - punto.lat) * rad * R];
  let minimo = Infinity;
  for (let i = 1; i < linea.length; i++) {
    const [ax, ay] = xy(linea[i - 1]);
    const [bx, by] = xy(linea[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    // proiezione del punto (origine) sul segmento, limitata agli estremi
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < minimo) minimo = d;
  }
  if (linea.length === 1) {
    const [ax, ay] = xy(linea[0]);
    minimo = Math.hypot(ax, ay);
  }
  return minimo;
}

export function distanzaDaTrattiM(punto, tratti) {
  let minimo = Infinity;
  for (const l of tratti) minimo = Math.min(minimo, distanzaDaLineaM(punto, l));
  return minimo;
}

// Riquadro [sud, ovest, nord, est] che contiene tutti i tratti
export function riquadro(tratti) {
  let s = 90, o = 180, n = -90, e = -180;
  for (const l of tratti) for (const [lat, lng] of l) {
    s = Math.min(s, lat); n = Math.max(n, lat); o = Math.min(o, lng); e = Math.max(e, lng);
  }
  return [s, o, n, e];
}
