// Database IndexedDB dell'app: foto degli spot e tracce GPX.
// (localStorage è troppo piccolo per immagini e tracce)

const NOME = 'wildspot';
const VERSIONE = 2; // 1: foto · 2: + tracce GPX

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
    tx.oncomplete = () => resolve(risultato?.result ?? risultato);
    tx.onerror = () => reject(tx.error);
  });
}
