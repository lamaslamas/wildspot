// Diario dei miei spot: dati salvati solo sul dispositivo (localStorage),
// con esportazione e importazione in JSON per non perderli.
//
// Uno spot è:
// {
//   id, nome, lat, lng,
//   capanno, accesso, luce, specie,   // note libere
//   visite: ['AAAA-MM-GG', ...],      // date delle visite, dalla più recente
//   creato, modificato                // date ISO
// }

import { leggi, scrivi } from './storage.js';
import { esportaFoto, importaFoto, eliminaFotoDiSpot } from './photos.js';
import { leggiSpecieFotografate, importaSpecieFotografate } from './photographed.js';

const CHIAVE = 'spot';
export const CAMPI_NOTE = ['capanno', 'accesso', 'luce', 'specie'];

function nuovoId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function leggiSpot() {
  const lista = leggi(CHIAVE, []);
  return Array.isArray(lista) ? lista.map(normalizza).filter(Boolean) : [];
}

function salvaTutti(lista) {
  scrivi(CHIAVE, lista);
}

export function trovaSpot(id) {
  return leggiSpot().find((s) => s.id === id) || null;
}

// Crea o aggiorna uno spot; restituisce lo spot salvato
export function salvaSpot(dati) {
  const lista = leggiSpot();
  const adesso = new Date().toISOString();
  const indice = lista.findIndex((s) => s.id === dati.id);
  const spot = normalizza({
    ...(indice >= 0 ? lista[indice] : { id: nuovoId(), creato: adesso }),
    ...dati,
    modificato: adesso,
  });
  if (indice >= 0) lista[indice] = spot;
  else lista.push(spot);
  salvaTutti(lista);
  return spot;
}

export function eliminaSpot(id) {
  salvaTutti(leggiSpot().filter((s) => s.id !== id));
  eliminaFotoDiSpot(id).catch(() => {}); // anche le sue foto
}

// Aggiunge una data di visita (se non c'è già) e la tiene in ordine
export function aggiungiVisita(id, data) {
  const spot = trovaSpot(id);
  if (!spot || spot.visite.includes(data)) return spot;
  return salvaSpot({ id, visite: [...spot.visite, data] });
}

export function togliVisita(id, data) {
  const spot = trovaSpot(id);
  if (!spot) return null;
  return salvaSpot({ id, visite: spot.visite.filter((v) => v !== data) });
}

// Controlla e ripulisce uno spot (anche se arriva da un file importato)
function normalizza(s) {
  if (!s || typeof s !== 'object') return null;
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const testo = (v) => (typeof v === 'string' ? v.trim().slice(0, 2000) : '');
  const visite = Array.isArray(s.visite) ? s.visite.filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)) : [];
  return {
    id: typeof s.id === 'string' && s.id ? s.id : nuovoId(),
    nome: testo(s.nome).slice(0, 120) || 'Spot',
    lat,
    lng,
    ...Object.fromEntries(CAMPI_NOTE.map((c) => [c, testo(s[c])])),
    visite: [...new Set(visite)].sort().reverse(),
    creato: typeof s.creato === 'string' ? s.creato : new Date().toISOString(),
    modificato: typeof s.modificato === 'string' ? s.modificato : new Date().toISOString(),
  };
}

// --- Esportazione e importazione

// Il backup contiene spot, foto degli spot e specie fotografate
export async function esportaJson() {
  const dati = {
    app: 'WildSpot',
    versione: 2,
    esportato: new Date().toISOString(),
    spot: leggiSpot(),
    specieFotografate: leggiSpecieFotografate(),
    foto: await esportaFoto().catch(() => []),
  };
  return JSON.stringify(dati);
}

/**
 * Unisce gli spot di un file a quelli esistenti. Se uno spot con lo stesso id
 * c'è già, vince la versione modificata più di recente.
 * Importa anche foto e specie fotografate, se presenti (backup versione 2).
 * @returns {Promise<{nuovi: number, aggiornati: number, invariati: number, foto: number, specie: number}>}
 * @throws se il file non è un'esportazione valida
 */
export async function importaJson(testo) {
  let dati;
  try {
    dati = JSON.parse(testo);
  } catch {
    throw new Error('formato');
  }
  const ingresso = Array.isArray(dati) ? dati : dati?.spot;
  if (!Array.isArray(ingresso)) throw new Error('formato');

  const lista = leggiSpot();
  const perId = new Map(lista.map((s) => [s.id, s]));
  const esito = { nuovi: 0, aggiornati: 0, invariati: 0, foto: 0, specie: 0 };

  for (const grezzo of ingresso) {
    const spot = normalizza(grezzo);
    if (!spot) continue;
    const esistente = perId.get(spot.id);
    if (!esistente) {
      perId.set(spot.id, spot);
      esito.nuovi++;
    } else if (spot.modificato > esistente.modificato) {
      perId.set(spot.id, spot);
      esito.aggiornati++;
    } else {
      esito.invariati++;
    }
  }
  salvaTutti([...perId.values()]);
  esito.specie = importaSpecieFotografate(dati?.specieFotografate);
  esito.foto = await importaFoto(dati?.foto, new Set(perId.keys())).catch(() => 0);
  return esito;
}
