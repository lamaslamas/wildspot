// Specie seguite e avvisi: controlla se le specie che segui sono state
// segnalate vicino a te da quando hai controllato l'ultima volta.
//
// Il controllo avviene quando l'app è aperta (all'avvio, ogni 30 minuti e
// quando torni sull'app). Senza un server non è possibile avvisare ad app
// chiusa: se hai dato il permesso, la notifica arriva quando l'app è aperta
// o in secondo piano.

import { leggi, scrivi } from './storage.js';
import { normalizza as normalizzaInat } from './inaturalist.js';
import { normalizza as normalizzaEbird } from './ebird.js';

const API_INAT = 'https://api.inaturalist.org/v1';
const API_EBIRD = 'https://api.ebird.org/v2';
const MAX_NOVITA = 60;

// --- Specie seguite: [{ taxonId, nomeSci, nomeComune, gruppo }]
export function leggiSeguite() {
  const l = leggi('specieSeguite', []);
  return Array.isArray(l) ? l.filter((s) => s && s.nomeSci) : [];
}

export function segue(nomeSci) {
  return leggiSeguite().some((s) => s.nomeSci === nomeSci);
}

export function segui(specie) {
  if (segue(specie.nomeSci)) return;
  scrivi('specieSeguite', [...leggiSeguite(), specie]);
}

export function smettiDiSeguire(nomeSci) {
  scrivi('specieSeguite', leggiSeguite().filter((s) => s.nomeSci !== nomeSci));
}

// --- Novità trovate: [{ id, fonte, dati, trovata, vista }]
export function leggiNovita() {
  const l = leggi('novita', []);
  return Array.isArray(l) ? l : [];
}

export function nonViste() {
  return leggiNovita().filter((n) => !n.vista).length;
}

export function segnaTutteViste() {
  scrivi('novita', leggiNovita().map((n) => ({ ...n, vista: true })));
}

export function svuotaNovita() {
  scrivi('novita', []);
}

/**
 * Cerca nuove segnalazioni delle specie seguite.
 * @returns {Promise<object[]>} le novità appena trovate
 */
export async function controllaNovita({ centro, raggioKm, chiaveEbird }) {
  const seguite = leggiSeguite();
  if (!seguite.length) return [];
  const settimanaFa = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const dal = leggi('ultimoControllo', null) || settimanaFa;
  const adesso = new Date().toISOString();
  const giaViste = new Set(leggiNovita().map((n) => n.id));
  const trovate = [];

  // iNaturalist: osservazioni caricate dopo l'ultimo controllo (anche da identificare)
  const conTaxon = seguite.filter((s) => s.taxonId);
  if (conTaxon.length) {
    const p = new URLSearchParams({
      taxon_id: conTaxon.map((s) => s.taxonId).join(','),
      lat: centro.lat.toFixed(3),
      lng: centro.lng.toFixed(3),
      radius: raggioKm,
      verifiable: 'true',
      created_d1: dal,
      order_by: 'created_at',
      per_page: 50,
      locale: document.documentElement.lang || 'it',
    });
    const r = await fetch(`${API_INAT}/observations?${p}`);
    if (r.ok) {
      for (const o of (await r.json()).results.map(normalizzaInat).filter(Boolean)) {
        if (!giaViste.has(o.id)) trovate.push({ id: o.id, fonte: 'iNaturalist', dati: o });
      }
    }
  }

  // eBird: avvistamenti recenti nella zona delle specie seguite (solo uccelli)
  if (chiaveEbird) {
    const nomi = new Set(seguite.map((s) => s.nomeSci));
    const p = new URLSearchParams({
      lat: centro.lat.toFixed(3),
      lng: centro.lng.toFixed(3),
      dist: Math.min(raggioKm, 50),
      back: 7,
      sppLocale: document.documentElement.lang || 'it',
    });
    const r = await fetch(`${API_EBIRD}/data/obs/geo/recent?${p}`, { headers: { 'X-eBirdApiToken': chiaveEbird } });
    if (r.ok) {
      const giornoDal = dal.slice(0, 10);
      for (const grezzo of await r.json()) {
        if (!nomi.has(grezzo.sciName) || grezzo.obsDt.slice(0, 10) < giornoDal) continue;
        const a = normalizzaEbird(grezzo, false);
        if (!giaViste.has(a.id)) trovate.push({ id: a.id, fonte: 'eBird', dati: a });
      }
    }
  }

  scrivi('ultimoControllo', adesso);
  if (trovate.length) {
    const nuove = trovate.map((n) => ({ ...n, trovata: adesso, vista: false }));
    scrivi('novita', [...nuove, ...leggiNovita()].slice(0, MAX_NOVITA));
  }
  return trovate;
}

// Notifica di sistema (se l'utente l'ha permessa)
export async function notifica(titolo, testo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opzioni = { body: testo, icon: 'icons/icona-192.png', badge: 'icons/icona-192.png', tag: 'wildspot-novita' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(titolo, opzioni);
    else new Notification(titolo, opzioni);
  } catch {
    // le notifiche non sono indispensabili
  }
}
