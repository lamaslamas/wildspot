// Percorsi escursionistici, MTB e bici da OpenStreetMap tramite Overpass API.
// Dati © OpenStreetMap contributors, licenza ODbL.
//
// Overpass è un servizio gratuito con limiti: usiamo richieste GET (così il
// service worker le può salvare per l'uso offline), una cache in memoria e un
// server di riserva se il principale è sovraccarico.

import { lunghezzaTotaleKm } from './geo.js';

const SERVER = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter', // riserva: più lento ma affidabile
];
const TIMEOUT_MS = 25000;
const MARGINE_KM = 2; // la geometria è ritagliata al raggio + questo margine

export const TIPI_PERCORSO = ['trekking', 'mtb', 'bici'];
export const COLORI_PERCORSO = { trekking: '#d9480f', mtb: '#7b2cbf', bici: '#1c7ed6' };

const cache = new Map(); // chiave -> percorsi

function tipoDaRoute(route) {
  if (route === 'mtb') return 'mtb';
  if (route === 'bicycle') return 'bici';
  return 'trekking'; // hiking, foot
}

// Difficoltà leggibile: scala CAI (in Italia), SAC (T1–T6) e MTB (0–6)
const SAC = {
  hiking: 'T1',
  mountain_hiking: 'T2',
  demanding_mountain_hiking: 'T3',
  alpine_hiking: 'T4',
  demanding_alpine_hiking: 'T5',
  difficult_alpine_hiking: 'T6',
};

function difficolta(tags) {
  const d = {};
  if (tags.cai_scale) d.cai = tags.cai_scale; // T, E, EE, EEA
  if (tags.sac_scale) d.sac = SAC[tags.sac_scale] || tags.sac_scale;
  if (tags['mtb:scale'] !== undefined) d.mtb = tags['mtb:scale'];
  if (tags['mtb:scale:uphill'] !== undefined) d.mtbSalita = tags['mtb:scale:uphill'];
  return d;
}

// Lunghezza dal tag "distance" (km, a volte con unità)
function distanzaDaTag(valore) {
  if (!valore) return null;
  const m = String(valore).replace(',', '.').match(/^\s*([\d.]+)\s*(km|m|mi)?\s*$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2]?.toLowerCase() === 'm') return n / 1000;
  if (m[2]?.toLowerCase() === 'mi') return n * 1.609;
  return n;
}

function riquadroAttorno({ lat, lng }, km) {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}

function normalizza(rel) {
  const tags = rel.tags || {};
  const tratti = [];
  let ritagliato = false;
  for (const m of rel.members || []) {
    if (m.type !== 'way') continue;
    if (!m.geometry) {
      ritagliato = true; // fuori dal riquadro richiesto
      continue;
    }
    // con il ritaglio, i punti fuori dal riquadro arrivano come null
    let corrente = [];
    for (const p of m.geometry) {
      if (p && Number.isFinite(p.lat)) corrente.push([p.lat, p.lon]);
      else {
        ritagliato = true;
        if (corrente.length > 1) tratti.push(corrente);
        corrente = [];
      }
    }
    if (corrente.length > 1) tratti.push(corrente);
  }
  if (!tratti.length) return null;
  const daTag = distanzaDaTag(tags.distance);
  return {
    id: rel.id,
    tipo: tipoDaRoute(tags.route),
    nome: tags.name || tags['name:it'] || '',
    ref: tags.ref || '',
    rete: tags.network || '',
    da: tags.from || '',
    a: tags.to || '',
    descrizione: tags['description:it'] || tags.description || '',
    simbolo: tags['osmc:symbol'] || '',
    difficolta: difficolta(tags),
    sitoWeb: tags.website || '',
    tratti,
    // lunghezza: dal tag se c'è (vale per tutto il percorso), altrimenti calcolata
    lunghezzaKm: daTag ?? lunghezzaTotaleKm(tratti),
    lunghezzaDaTag: daTag !== null,
    ritagliato,
    link: `https://www.openstreetmap.org/relation/${rel.id}`,
  };
}

async function chiedi(server, query, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    const r = await fetch(`${server}?data=${encodeURIComponent(query)}`, { signal: controller.signal });
    if (!r.ok) {
      const e = new Error(`HTTP ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return await r.json();
  } catch (err) {
    if (signal?.aborted) throw err; // annullata da noi
    if (err.name === 'AbortError') err.lento = true; // scaduto il tempo
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Percorsi entro `raggioKm` da un punto.
 * Errori: `err.lento` (nessuna risposta in tempo), `err.status` 429 (troppe richieste).
 */
export async function cercaPercorsi({ lat, lng }, raggioKm, signal) {
  const chiave = `${lat.toFixed(3)},${lng.toFixed(3)},${raggioKm}`;
  if (cache.has(chiave)) return cache.get(chiave);

  const bb = riquadroAttorno({ lat, lng }, raggioKm + MARGINE_KM).map((v) => v.toFixed(4)).join(',');
  const query =
    `[out:json][timeout:25];` +
    `relation["route"~"^(hiking|foot|mtb|bicycle)$"](around:${raggioKm * 1000},${lat.toFixed(5)},${lng.toFixed(5)});` +
    `out geom(${bb});`;

  let ultimoErrore;
  for (const server of SERVER) {
    try {
      const dati = await chiedi(server, query, signal);
      const percorsi = (dati.elements || []).map(normalizza).filter(Boolean);
      cache.set(chiave, percorsi);
      if (cache.size > 20) cache.delete(cache.keys().next().value);
      return percorsi;
    } catch (err) {
      if (signal?.aborted) throw err;
      ultimoErrore = err; // proviamo il server successivo
    }
  }
  throw ultimoErrore;
}
