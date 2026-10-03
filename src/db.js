// Database IndexedDB dell'app: foto degli spot e tracce GPX.
// (localStorage è troppo piccolo per immagini e tracce)

const NOME = 'wildspot';
const VERSIONE = 3; // 1: foto · 2: + tracce GPX · 3: + cache dei percorsi Overpass

let dbPromessa = null;

export function apriDb() {
  dbPromessa ??= new Promise((resolve, reject) => {
    const richiesta = indexedDB.open(NOME, VERSIONE);
    richiesta.onupgradeneeded = () => {
      const db = richiesta.result;
      if (!db.objectStoreNames.contains('foto')) {
        db.createObjectStore('foto', { keyPath: 'id' }).createIndex('spotId', 'spotId');
      }
      if (!db.objectStoreNames.contains('tracce')) db.createObjectStore('tracce', { keyPath: 'id' });
      // risposte Overpass già elaborate: le richieste POST non passano dalla cache del service worker
      if (!db.objectStoreNames.contains('cachePercorsi')) db.createObjectStore('cachePercorsi', { keyPath: 'chiave' });
    };
    richiesta.onsuccess = () => resolve(richiesta.result);
    richiesta.onerror = () => reject(richiesta.error);
  });
  return dbPromessa;
}

// Esegue un'operazione su un archivio e restituisce il risultato a transazione finita
export async function transazione(archivio, modo, operazione) {
  const db = await apriDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(archivio, modo);
    const risultato = operazione(tx.objectStore(archivio));
    // per le richieste (get, getAll…) il valore è in .result, che può essere
    // undefined quando non c'è niente: in quel caso va restituito undefined
    tx.oncomplete = () => resolve(risultato instanceof IDBRequest ? risultato.result : risultato);
    tx.onerror = () => reject(tx.error);
  });
}
