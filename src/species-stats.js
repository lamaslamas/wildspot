// Quando vedere una specie in una zona: mesi e ore del giorno in cui viene
// osservata più spesso su iNaturalist (solo osservazioni di grado "ricerca").
// - mesi: istogramma calcolato dal server su tutte le osservazioni
// - ore:  calcolate qui dall'ora locale delle ultime 200 osservazioni con orario
// Se nella zona ci sono poche osservazioni si allarga il raggio.

import { fetchJsonConCache } from './cache.js';

const API = 'https://api.inaturalist.org/v1';
const RAGGI_KM = [100, 300]; // prima vicino, poi più largo
const MINIMO = 15; // sotto questo numero i grafici dicono poco

async function istogrammaMesi(taxonId, centro, raggioKm, signal) {
  const p = new URLSearchParams({
    taxon_id: taxonId,
    date_field: 'observed',
    interval: 'month_of_year',
    quality_grade: 'research',
  });
  if (centro) {
    p.set('lat', centro.lat.toFixed(2));
    p.set('lng', centro.lng.toFixed(2));
    p.set('radius', raggioKm);
  }
  const dati = await fetchJsonConCache(`${API}/observations/histogram?${p}`, { signal });
  const perMese = dati.results?.month_of_year || {};
  return Array.from({ length: 12 }, (_, i) => perMese[i + 1] || 0);
}

async function distribuzioneOre(taxonId, centro, raggioKm, signal) {
  const p = new URLSearchParams({
    taxon_id: taxonId,
    quality_grade: 'research',
    per_page: 200,
    order_by: 'observed_on',
    fields: 'time_observed_at',
  });
  if (centro) {
    p.set('lat', centro.lat.toFixed(2));
    p.set('lng', centro.lng.toFixed(2));
    p.set('radius', raggioKm);
  }
  const dati = await fetchJsonConCache(`${API}/observations?${p}`, { signal });
  const ore = Array(24).fill(0);
  for (const o of dati.results || []) {
    // "2026-09-23T14:48:18+02:00": l'ora è già quella locale del luogo
    const ora = Number(o.time_observed_at?.slice(11, 13));
    if (Number.isInteger(ora) && ora >= 0 && ora < 24) ore[ora]++;
  }
  return ore;
}

const somma = (v) => v.reduce((a, b) => a + b, 0);

/**
 * @returns {Promise<{mesi:number[], ore:number[], raggioKm:number|null}>}
 *   raggioKm = null quando i dati sono di tutto il mondo
 */
export async function quandoVederla(taxonId, centro, signal) {
  for (const raggioKm of RAGGI_KM) {
    const mesi = await istogrammaMesi(taxonId, centro, raggioKm, signal);
    if (somma(mesi) >= MINIMO) {
      const ore = await distribuzioneOre(taxonId, centro, raggioKm, signal);
      return { mesi, ore, raggioKm };
    }
  }
  const [mesi, ore] = await Promise.all([
    istogrammaMesi(taxonId, null, null, signal),
    distribuzioneOre(taxonId, null, null, signal),
  ]);
  return { mesi, ore, raggioKm: null };
}

// Cerca l'id iNaturalist di una specie dal nome scientifico (per le specie eBird)
export async function taxonDaNomeScientifico(nomeSci, signal) {
  const p = new URLSearchParams({ q: nomeSci, per_page: 5, is_active: 'true' });
  const dati = await fetchJsonConCache(`${API}/taxa/autocomplete?${p}`, { signal });
  return dati.results?.find((t) => t.name.toLowerCase() === nomeSci.toLowerCase())?.id || null;
}
