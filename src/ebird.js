// Accesso all'API di eBird (serve una chiave personale gratuita).
// Documentazione: https://documenter.getpostman.com/view/664302/S1ENwy59
//
// La chiave viene inserita dall'utente nelle Impostazioni e salvata solo nel
// localStorage del dispositivo: non è mai scritta nel codice.
// L'API accetta chiamate dal browser (CORS aperto), quindi non serve un proxy.
// eBird nasconde già le specie sensibili: l'app mostra solo ciò che l'API fornisce.

import { fetchJsonConCache } from './cache.js';
import { linguaAttuale } from './i18n.js';

const API = 'https://api.ebird.org/v2';

// Limiti dell'API
export const EBIRD_MAX_GIORNI = 30;
const EBIRD_MAX_KM = 50;

function intestazioni(chiave) {
  return { 'X-eBirdApiToken': chiave };
}

function parametriBase({ centro, raggioKm }) {
  return {
    lat: centro.lat.toFixed(4),
    lng: centro.lng.toFixed(4),
    dist: Math.min(raggioKm, EBIRD_MAX_KM),
  };
}

/**
 * Avvistamenti recenti (uno per specie, il più recente) più quelli "notevoli"
 * (specie rare per la zona), uniti in un'unica lista.
 * @returns {Promise<object[]>} avvistamenti normalizzati
 */
export async function cercaAvvistamenti({ centro, raggioKm, giorni, chiave }, signal) {
  const parametri = new URLSearchParams({
    ...parametriBase({ centro, raggioKm }),
    // eBird fornisce al massimo gli ultimi 30 giorni; "sempre" e "1 anno" diventano 30
    back: Math.min(giorni || EBIRD_MAX_GIORNI, EBIRD_MAX_GIORNI),
    sppLocale: linguaAttuale(),
  });
  const opzioni = { signal, headers: intestazioni(chiave) };
  const [recenti, notevoli] = await Promise.all([
    fetchJsonConCache(`${API}/data/obs/geo/recent?${parametri}`, opzioni),
    fetchJsonConCache(`${API}/data/obs/geo/recent/notable?${parametri}&detail=simple`, opzioni),
  ]);

  // Uniamo le due liste: stessa lista di controllo + stessa specie = stesso avvistamento
  const perChiave = new Map();
  for (const o of recenti) perChiave.set(`${o.subId}|${o.speciesCode}`, normalizza(o, false));
  for (const o of notevoli) {
    const k = `${o.subId}|${o.speciesCode}`;
    if (perChiave.has(k)) perChiave.get(k).notevole = true;
    else perChiave.set(k, normalizza(o, true));
  }
  return [...perChiave.values()];
}

// Hotspot eBird: luoghi pubblici frequentati dai birdwatcher
export async function cercaHotspot({ centro, raggioKm, chiave }, signal) {
  const parametri = new URLSearchParams({ ...parametriBase({ centro, raggioKm }), fmt: 'json' });
  const dati = await fetchJsonConCache(`${API}/ref/hotspot/geo?${parametri}`, {
    signal,
    headers: intestazioni(chiave),
  });
  return dati.map((h) => ({
    locId: h.locId,
    nome: h.locName,
    lat: h.lat,
    lng: h.lng,
    specieTotali: h.numSpeciesAllTime || 0,
    ultimaData: h.latestObsDt || '',
  }));
}

// Controlla che una chiave funzioni con una richiesta leggera.
// Restituisce true/false; lancia un errore solo se manca la connessione.
export async function verificaChiave(chiave) {
  const risposta = await fetch(`${API}/ref/hotspot/geo?lat=42.5&lng=12.5&dist=1&fmt=json`, {
    headers: intestazioni(chiave),
  });
  return risposta.ok;
}

export function normalizza(o, notevole) {
  return {
    id: `ebird-${o.subId}-${o.speciesCode}`,
    fonte: 'eBird',
    nomeComune: o.comName || '',
    nomeSci: o.sciName || '',
    codiceSpecie: o.speciesCode,
    gruppo: 'Aves',
    dataOra: o.obsDt || '', // "AAAA-MM-GG hh:mm" oppure solo "AAAA-MM-GG"
    numero: o.howMany || null,
    notevole,
    locId: o.locId,
    luogo: o.locName || '',
    lat: o.lat,
    lng: o.lng,
    luogoPrivato: Boolean(o.locationPrivate),
    link: `https://ebird.org/checklist/${o.subId}`,
  };
}

/**
 * Raggruppa avvistamenti e hotspot per luogo (locId): sulla mappa compare un
 * solo indicatore per luogo, con l'elenco delle specie viste lì.
 */
export function raggruppaPerLuogo(avvistamenti, hotspot) {
  const luoghi = new Map();
  for (const h of hotspot) {
    luoghi.set(h.locId, { ...h, hotspot: true, avvistamenti: [] });
  }
  for (const a of avvistamenti) {
    let luogo = luoghi.get(a.locId);
    if (!luogo) {
      luogo = { locId: a.locId, nome: a.luogo, lat: a.lat, lng: a.lng, hotspot: false, privato: a.luogoPrivato, avvistamenti: [] };
      luoghi.set(a.locId, luogo);
    }
    luogo.avvistamenti.push(a);
  }
  for (const luogo of luoghi.values()) {
    // dal più recente al più vecchio
    luogo.avvistamenti.sort((x, y) => y.dataOra.localeCompare(x.dataOra));
    luogo.notevole = luogo.avvistamenti.some((a) => a.notevole);
  }
  return [...luoghi.values()];
}
