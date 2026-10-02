// "Le mie specie": le specie che ho fotografato, con data e luogo di ogni volta.
// Salvate sul dispositivo (localStorage) e incluse nel backup del diario.
//
// Una voce è: { id, nomeSci, nomeComune, gruppo, data: 'AAAA-MM-GG', luogo, lat, lng, creata }

import { leggi, scrivi } from './storage.js';

const CHIAVE = 'specieFotografate';
const nuovoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function normalizza(v) {
  if (!v || typeof v !== 'object' || typeof v.nomeSci !== 'string' || !v.nomeSci) return null;
  const testo = (x, max = 200) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  return {
    id: typeof v.id === 'string' && v.id ? v.id : nuovoId(),
    nomeSci: testo(v.nomeSci, 120),
    nomeComune: testo(v.nomeComune, 120),
    gruppo: testo(v.gruppo, 30),
    data: /^\d{4}-\d{2}-\d{2}$/.test(v.data) ? v.data : new Date().toISOString().slice(0, 10),
    luogo: testo(v.luogo),
    lat: Number.isFinite(Number(v.lat)) ? Number(v.lat) : null,
    lng: Number.isFinite(Number(v.lng)) ? Number(v.lng) : null,
    creata: typeof v.creata === 'string' ? v.creata : new Date().toISOString(),
  };
}

export function leggiSpecieFotografate() {
  const lista = leggi(CHIAVE, []);
  return Array.isArray(lista) ? lista.map(normalizza).filter(Boolean) : [];
}

export function aggiungiFotografata(voce) {
  const lista = leggiSpecieFotografate();
  const nuova = normalizza(voce);
  lista.push(nuova);
  scrivi(CHIAVE, lista);
  return nuova;
}

export function eliminaFotografata(id) {
  scrivi(CHIAVE, leggiSpecieFotografate().filter((v) => v.id !== id));
}

// L'ho già fotografata almeno una volta?
export function giaFotografata(nomeSci) {
  return leggiSpecieFotografate().some((v) => v.nomeSci === nomeSci);
}

// Raggruppate per specie, dalla fotografata più di recente
export function perSpecie() {
  const gruppi = new Map();
  for (const v of leggiSpecieFotografate()) {
    if (!gruppi.has(v.nomeSci)) gruppi.set(v.nomeSci, { nomeSci: v.nomeSci, nomeComune: v.nomeComune, gruppo: v.gruppo, volte: [] });
    const g = gruppi.get(v.nomeSci);
    g.volte.push(v);
    if (!g.nomeComune && v.nomeComune) g.nomeComune = v.nomeComune;
  }
  for (const g of gruppi.values()) g.volte.sort((a, b) => b.data.localeCompare(a.data));
  return [...gruppi.values()].sort((a, b) => b.volte[0].data.localeCompare(a.volte[0].data));
}

// Unione con un backup: le voci con lo stesso id non vengono duplicate
export function importaSpecieFotografate(elenco) {
  if (!Array.isArray(elenco)) return 0;
  const lista = leggiSpecieFotografate();
  const ids = new Set(lista.map((v) => v.id));
  let n = 0;
  for (const grezza of elenco) {
    const v = normalizza(grezza);
    if (v && !ids.has(v.id)) {
      lista.push(v);
      ids.add(v.id);
      n++;
    }
  }
  scrivi(CHIAVE, lista);
  return n;
}
