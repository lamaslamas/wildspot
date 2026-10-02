// Cache in memoria delle risposte HTTP, per non ripetere le stesse richieste
// alle API (e restare nei loro limiti) quando si torna su una zona già vista.

const DURATA_MS = 10 * 60 * 1000; // 10 minuti
const MAX_VOCI = 40;

const voci = new Map(); // url -> { quando, dati }

// Scarica un JSON passando dalla cache. `signal` permette di annullare la richiesta.
export async function fetchJsonConCache(url, { signal, headers } = {}) {
  const voce = voci.get(url);
  if (voce && Date.now() - voce.quando < DURATA_MS) return voce.dati;

  const risposta = await fetch(url, { signal, headers });
  if (!risposta.ok) {
    const errore = new Error(`Errore HTTP ${risposta.status}`);
    errore.status = risposta.status;
    throw errore;
  }
  const dati = await risposta.json();

  voci.set(url, { quando: Date.now(), dati });
  // Eliminiamo la voce più vecchia (le Map mantengono l'ordine di inserimento)
  if (voci.size > MAX_VOCI) voci.delete(voci.keys().next().value);
  return dati;
}
