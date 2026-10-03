// Tracce GPX importate, salvate solo sul dispositivo (IndexedDB).
// Una traccia è: { id, nome, gpx (testo originale), tratti, quote, stats, importata }

import { transazione } from './db.js';
import { leggiGpx, statisticheTraccia } from './gpx.js';

const STORE = 'tracce';
const nuovoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function daGpx(gpx, nomeFile, extra = {}) {
  const letta = leggiGpx(gpx, nomeFile);
  return {
    id: nuovoId(),
    nome: letta.nome,
    gpx,
    tratti: letta.tratti,
    quote: letta.quote,
    stats: statisticheTraccia(letta),
    importata: new Date().toISOString(),
    ...extra,
  };
}

// Importa un file GPX; lancia un errore se il file non è valido
export async function importaTraccia(file) {
  const traccia = daGpx(await file.text(), file.name);
  await transazione(STORE, 'readwrite', (s) => s.put(traccia));
  return traccia;
}

export async function leggiTracce() {
  const tutte = (await transazione(STORE, 'readonly', (s) => s.getAll())) || [];
  return tutte.sort((a, b) => b.importata.localeCompare(a.importata));
}

export async function rinominaTraccia(id, nome) {
  const t = await transazione(STORE, 'readonly', (s) => s.get(id));
  if (!t) return;
  t.nome = nome.trim().slice(0, 120) || t.nome;
  await transazione(STORE, 'readwrite', (s) => s.put(t));
}

export async function eliminaTraccia(id) {
  await transazione(STORE, 'readwrite', (s) => s.delete(id));
}

// --- Backup: si salva il testo GPX originale, le statistiche si ricalcolano
export async function esportaTracce() {
  return (await leggiTracce()).map((t) => ({ id: t.id, nome: t.nome, gpx: t.gpx, importata: t.importata }));
}

export async function importaTracce(elenco) {
  if (!Array.isArray(elenco)) return 0;
  const esistenti = new Set((await leggiTracce()).map((t) => t.id));
  let n = 0;
  for (const v of elenco) {
    if (!v?.id || esistenti.has(v.id) || typeof v.gpx !== 'string') continue;
    try {
      const t = daGpx(v.gpx, v.nome || '', { id: v.id, importata: v.importata || new Date().toISOString() });
      if (v.nome) t.nome = String(v.nome).slice(0, 120);
      await transazione(STORE, 'readwrite', (s) => s.put(t));
      n++;
    } catch {
      // file nel backup non leggibile: lo saltiamo
    }
  }
  return n;
}
