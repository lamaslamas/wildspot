// Percorsi escursionistici, MTB e bici da OpenStreetMap.
// Dati © OpenStreetMap contributors, licenza ODbL.
//
// Fonti, in ordine:
// 1. in Puglia, il file preparato in anticipo public/data/percorsi-puglia.geojson
//    (vedi scripts/percorsi-puglia.mjs): niente richieste a server esterni
// 2. fuori dalla Puglia, Overpass API con richieste POST a più server: il
//    principale parte subito, le riserve partono sfalsate se non risponde,
//    vince il primo che risponde e gli altri vengono annullati
// 3. se nessun server risponde, l'ultima risposta salvata per quella zona (IndexedDB)

import { lunghezzaTotaleKm } from './geo.js';
import { transazione } from './db.js';
import { percorsiPuglia } from './trails-puglia.js';

// [indirizzo, dopo quanti ms partire, tempo massimo di attesa in ms]
const SERVER = [
  ['https://overpass-api.de/api/interpreter', 0, 25000],
  ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 6000, 25000], // lento ma affidabile
  ['https://overpass.kumi.systems/api/interpreter', 12000, 15000],
  ['https://overpass.private.coffee/api/interpreter', 12000, 15000],
];
const MARGINE_KM = 2; // la geometria è ritagliata al raggio + questo margine
const CACHE_FRESCA_MS = 7 * 24 * 3600 * 1000; // entro una settimana la cache vale come una risposta nuova

export const TIPI_PERCORSO = ['trekking', 'mtb', 'bici'];
// Colori scelti per non confondersi con le aree protette (viola, magenta, arancio)
export const COLORI_PERCORSO = { trekking: '#c92a2a', mtb: '#0b7285', bici: '#1864ab' };

const cache = new Map(); // chiave -> risultato (in memoria, per la sessione)

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
  let ritagliato = Boolean(rel.ritagliato);
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

const nomeServer = (url) => new URL(url).hostname;

// Una richiesta POST a un server, con tempo massimo; l'errore dice cosa è successo
async function chiedi(server, query, attesaMax, segnale) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('tempo'), attesaMax);
  const annulla = () => controller.abort('annullata');
  segnale.addEventListener('abort', annulla);
  try {
    const r = await fetch(server, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
    if (!r.ok) {
      const e = new Error(`HTTP ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return await r.json();
  } catch (err) {
    if (controller.signal.aborted && controller.signal.reason === 'tempo') {
      const e = new Error(`nessuna risposta in ${Math.round(attesaMax / 1000)} s`);
      e.lento = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    segnale.removeEventListener('abort', annulla);
  }
}

// Server sfalsati: vince il primo che risponde, gli altri vengono annullati
function chiediAiServer(query, signal, onProgresso) {
  const tutti = new AbortController();
  signal?.addEventListener('abort', () => tutti.abort());
  const tentativi = [];
  const prove = SERVER.map(([url, ritardo, attesaMax]) =>
    new Promise((resolve, reject) => {
      const avvio = setTimeout(async () => {
        if (tutti.signal.aborted) return reject(new Error('annullata'));
        if (ritardo) onProgresso?.(nomeServer(url));
        try {
          resolve({ dati: await chiedi(url, query, attesaMax, tutti.signal), server: nomeServer(url) });
        } catch (err) {
          tentativi.push({ server: nomeServer(url), motivo: err.message, status: err.status, lento: err.lento });
          reject(err);
        }
      }, ritardo);
      tutti.signal.addEventListener('abort', () => clearTimeout(avvio));
    }),
  );
  return Promise.any(prove)
    .then((risultato) => {
      tutti.abort(); // ferma le richieste ancora in corso
      return risultato;
    })
    .catch(() => {
      const e = new Error('Nessun server Overpass ha risposto');
      e.tentativi = tentativi;
      e.lento = tentativi.some((t) => t.lento || t.status === 504);
      e.status = tentativi.find((t) => t.status === 429)?.status;
      throw e;
    });
}

// --- Cache su IndexedDB (le richieste POST non passano dal service worker)
async function leggiCache(chiave) {
  try {
    return await transazione('cachePercorsi', 'readonly', (s) => s.get(chiave));
  } catch {
    return null;
  }
}

async function scriviCache(chiave, percorsi) {
  try {
    await transazione('cachePercorsi', 'readwrite', (s) => s.put({ chiave, percorsi, salvato: Date.now() }));
    // al massimo 40 zone salvate: togliamo le più vecchie
    const tutte = await transazione('cachePercorsi', 'readonly', (s) => s.getAll());
    if (tutte.length > 40) {
      const vecchie = tutte.sort((a, b) => a.salvato - b.salvato).slice(0, tutte.length - 40);
      await transazione('cachePercorsi', 'readwrite', (s) => vecchie.forEach((v) => s.delete(v.chiave)));
    }
  } catch {
    // la cache non è indispensabile
  }
}

/**
 * Percorsi entro `raggioKm` da un punto.
 * @param {(server: string) => void} [onProgresso] avvisa quando si prova un server di riserva
 * @returns {Promise<{percorsi: object[], fonte: 'puglia'|'overpass'|'cache', server?: string, salvato?: number}>}
 * Errori: `err.lento` (nessuna risposta in tempo), `err.status` 429, `err.tentativi` (dettaglio per server)
 */
export async function cercaPercorsi({ lat, lng }, raggioKm, signal, onProgresso) {
  const chiave = `${lat.toFixed(3)},${lng.toFixed(3)},${raggioKm}`;
  if (cache.has(chiave)) return cache.get(chiave);

  // 1. Puglia: file locale (null se il punto è fuori o il file non c'è)
  const locali = await percorsiPuglia({ lat, lng }, raggioKm, MARGINE_KM).catch(() => null);
  if (locali) {
    const risultato = { percorsi: locali.map(normalizzaFeature).filter(Boolean), fonte: 'puglia' };
    cache.set(chiave, risultato);
    return risultato;
  }

  // 2. Cache recente
  const salvata = await leggiCache(chiave);
  if (salvata && Date.now() - salvata.salvato < CACHE_FRESCA_MS) {
    return { percorsi: salvata.percorsi, fonte: 'cache', salvato: salvata.salvato };
  }

  // 3. Overpass
  const bb = riquadroAttorno({ lat, lng }, raggioKm + MARGINE_KM).map((v) => v.toFixed(4)).join(',');
  const query =
    `[out:json][timeout:25];` +
    `relation["route"~"^(hiking|foot|mtb|bicycle)$"](around:${raggioKm * 1000},${lat.toFixed(5)},${lng.toFixed(5)});` +
    `out geom(${bb});`;
  try {
    const { dati, server } = await chiediAiServer(query, signal, onProgresso);
    const percorsi = (dati.elements || []).map(normalizza).filter(Boolean);
    const risultato = { percorsi, fonte: 'overpass', server };
    cache.set(chiave, risultato);
    if (cache.size > 20) cache.delete(cache.keys().next().value);
    scriviCache(chiave, percorsi);
    return risultato;
  } catch (err) {
    if (signal?.aborted) throw err;
    // 4. nessuna risposta: meglio i dati vecchi che niente
    if (salvata) return { percorsi: salvata.percorsi, fonte: 'cache', salvato: salvata.salvato, errore: err };
    throw err;
  }
}

// --- Percorsi dal file GeoJSON della Puglia (stesso formato di normalizza)
function normalizzaFeature(f) {
  const g = f.geometry;
  if (!g) return null;
  const linee = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  const tratti = linee.map((l) => l.map(([lng, lat]) => [lat, lng])).filter((l) => l.length > 1);
  if (!tratti.length) return null;
  const tags = f.properties || {};
  return normalizza({
    id: tags.id,
    tags,
    // riusiamo normalizza() passando i tratti come membri già "ritagliati"
    members: tratti.map((t) => ({ type: 'way', geometry: t.map(([lat, lon]) => ({ lat, lon })) })),
    ritagliato: Boolean(f.ritagliato),
  });
}
