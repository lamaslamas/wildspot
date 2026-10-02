// Accesso all'API pubblica di iNaturalist (nessuna chiave richiesta).
// Documentazione: https://api.inaturalist.org/v1/docs/

import { fetchJsonConCache } from './cache.js';
import { GRUPPI } from './groups.js';

const API = 'https://api.inaturalist.org/v1';
const PER_PAGINA = 200; // massimo consentito dall'API in una sola richiesta

// Data di N giorni fa nel formato AAAA-MM-GG (ora locale)
function dataGiorniFa(giorni) {
  const d = new Date();
  d.setDate(d.getDate() - giorni);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const gg = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${gg}`;
}

/**
 * Osservazioni recenti intorno a un punto.
 * @param {object} p
 * @param {{lat:number,lng:number}} p.centro
 * @param {number} p.raggioKm
 * @param {number} p.giorni     periodo: ultimi N giorni
 * @param {string[]} p.gruppi   taxa iconici (Aves, Mammalia, …)
 * @param {number} [p.taxonId]  specie (o genere, famiglia…) scelta nella ricerca
 * @returns {Promise<{osservazioni: object[], totale: number}>}
 */
export async function cercaOsservazioni({ centro, raggioKm, giorni, gruppi, taxonId }, signal) {
  const parametri = new URLSearchParams({
    lat: centro.lat.toFixed(4),
    lng: centro.lng.toFixed(4),
    radius: raggioKm,
    quality_grade: 'research',
    photos: 'true',
    order_by: 'observed_on',
    order: 'desc',
    d1: dataGiorniFa(giorni),
    locale: 'it',
    per_page: PER_PAGINA,
  });
  // Con una specie scelta il gruppo è implicito: evitiamo che i due filtri si escludano
  if (taxonId) parametri.set('taxon_id', taxonId);
  else parametri.set('iconic_taxa', gruppi.join(','));

  const dati = await fetchJsonConCache(`${API}/observations?${parametri}`, { signal });
  return {
    osservazioni: dati.results.map(normalizza).filter(Boolean),
    totale: dati.total_results,
  };
}

// Suggerimenti per la ricerca di specie (nomi italiani e scientifici),
// limitati ai gruppi animali gestiti dall'app
export async function suggerisciTaxa(testo, signal) {
  const parametri = new URLSearchParams({ q: testo, locale: 'it', per_page: 15, is_active: 'true' });
  const dati = await fetchJsonConCache(`${API}/taxa/autocomplete?${parametri}`, { signal });
  const gruppiValidi = new Set(GRUPPI.map((g) => g.id));
  return dati.results
    .filter((t) => gruppiValidi.has(t.iconic_taxon_name))
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      nomeIt: t.preferred_common_name || '',
      nomeSci: t.name,
      rango: t.rank,
      foto: t.default_photo?.square_url || '',
    }));
}

// Converte un'osservazione dell'API nel formato usato dall'app
function normalizza(o) {
  if (!o.geojson?.coordinates) return null;
  const [lng, lat] = o.geojson.coordinates;
  const foto = o.photos?.[0];
  return {
    id: `inat-${o.id}`,
    fonte: 'iNaturalist',
    nomeIt: o.taxon?.preferred_common_name || o.species_guess || '',
    nomeSci: o.taxon?.name || '',
    taxonId: o.taxon?.id,
    gruppo: o.taxon?.iconic_taxon_name || '',
    data: o.observed_on,          // AAAA-MM-GG
    dataOra: o.time_observed_at,  // può mancare
    luogo: o.place_guess || '',
    lat,
    lng,
    // Posizione oscurata: le coordinate pubbliche sono casuali dentro un'area ampia.
    // Usiamo solo il raggio di incertezza dichiarato dall'API, senza cercare di
    // ricostruire la posizione reale.
    oscurata: Boolean(o.obscured),
    incertezzaM: o.public_positional_accuracy || 0,
    foto: foto
      ? {
          piccola: foto.url,
          media: foto.url.replace('/square.', '/medium.'),
          attribuzione: foto.attribution,
        }
      : null,
    osservatore: o.user?.name || o.user?.login || '',
    link: o.uri || `https://www.inaturalist.org/observations/${o.id}`,
  };
}
