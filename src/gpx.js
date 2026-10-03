// Lettura dei file GPX (tracce di Wikiloc, Komoot, Strava…) con DOMParser.
// Si leggono le tracce (<trk><trkseg><trkpt>) e, se mancano, i percorsi (<rte><rtept>).

import { lunghezzaKm } from './geo.js';

const SOGLIA_DISLIVELLO_M = 3; // ignora le piccole oscillazioni del GPS

/**
 * @returns {{nome: string, tratti: number[][][], quote: (number|null)[][], tempo: string|null}}
 * @throws se il file non è un GPX valido o non contiene punti
 */
export function leggiGpx(testo, nomeFile = '') {
  const doc = new DOMParser().parseFromString(testo, 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'gpx') throw new Error('formato');

  // getElementsByTagNameNS('*', …) ignora i prefissi dei namespace
  const tutti = (radice, nome) => [...radice.getElementsByTagNameNS('*', nome)];
  const testoDi = (radice, nome) => tutti(radice, nome)[0]?.textContent?.trim() || '';

  const leggiPunti = (punti) => {
    const linea = [];
    const quote = [];
    for (const p of punti) {
      const lat = Number(p.getAttribute('lat'));
      const lng = Number(p.getAttribute('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      linea.push([lat, lng]);
      const ele = Number(testoDi(p, 'ele'));
      quote.push(testoDi(p, 'ele') !== '' && Number.isFinite(ele) ? ele : null);
    }
    return { linea, quote };
  };

  const tratti = [];
  const quote = [];
  for (const seg of tutti(doc, 'trkseg')) {
    const { linea, quote: q } = leggiPunti(tutti(seg, 'trkpt'));
    if (linea.length > 1) {
      tratti.push(linea);
      quote.push(q);
    }
  }
  if (!tratti.length) {
    for (const rte of tutti(doc, 'rte')) {
      const { linea, quote: q } = leggiPunti(tutti(rte, 'rtept'));
      if (linea.length > 1) {
        tratti.push(linea);
        quote.push(q);
      }
    }
  }
  if (!tratti.length) throw new Error('vuoto');

  const nome =
    testoDi(tutti(doc, 'trk')[0] || doc, 'name') ||
    testoDi(tutti(doc, 'metadata')[0] || doc, 'name') ||
    nomeFile.replace(/\.gpx$/i, '') ||
    'Traccia';
  return { nome: nome.slice(0, 120), tratti, quote, tempo: testoDi(tutti(doc, 'metadata')[0] || doc, 'time') || null };
}

/**
 * Statistiche: lunghezza, dislivelli, quote minima e massima, profilo.
 * Il profilo è un array di [km progressivi, quota] (solo se ci sono le quote).
 */
export function statisticheTraccia({ tratti, quote }) {
  let km = 0;
  let salita = 0;
  let discesa = 0;
  let min = Infinity;
  let max = -Infinity;
  const profilo = [];
  tratti.forEach((linea, t) => {
    let riferimento = null; // ultima quota "stabile" per il dislivello
    linea.forEach((p, i) => {
      if (i > 0) km += lunghezzaKm([linea[i - 1], p]);
      const q = quote[t]?.[i];
      if (q === null || q === undefined) return;
      min = Math.min(min, q);
      max = Math.max(max, q);
      profilo.push([km, q]);
      if (riferimento === null) riferimento = q;
      else if (Math.abs(q - riferimento) >= SOGLIA_DISLIVELLO_M) {
        if (q > riferimento) salita += q - riferimento;
        else discesa += riferimento - q;
        riferimento = q;
      }
    });
  });
  const conQuote = profilo.length > 1;
  return {
    lunghezzaKm: km,
    salita: conQuote ? Math.round(salita) : null,
    discesa: conQuote ? Math.round(discesa) : null,
    quotaMin: conQuote ? Math.round(min) : null,
    quotaMax: conQuote ? Math.round(max) : null,
    profilo: conQuote ? profilo : [],
  };
}
