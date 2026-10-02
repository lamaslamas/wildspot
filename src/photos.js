// Foto degli spot, salvate sul dispositivo in IndexedDB (localStorage è troppo
// piccolo per le immagini). Ogni foto viene ridimensionata a 1600 px e
// compressa in JPEG prima di salvarla, per non riempire la memoria.

const DB = 'wildspot';
const STORE = 'foto';
const LATO_MAX = 1600;

let dbPromessa = null;
function apriDb() {
  dbPromessa ??= new Promise((resolve, reject) => {
    const richiesta = indexedDB.open(DB, 1);
    richiesta.onupgradeneeded = () => {
      const store = richiesta.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('spotId', 'spotId');
    };
    richiesta.onsuccess = () => resolve(richiesta.result);
    richiesta.onerror = () => reject(richiesta.error);
  });
  return dbPromessa;
}

async function transazione(modo, operazione) {
  const db = await apriDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, modo);
    const risultato = operazione(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(risultato?.result ?? risultato);
    tx.onerror = () => reject(tx.error);
  });
}

// Ridimensiona e comprime un'immagine (File o Blob) in JPEG
async function comprimi(file) {
  const bitmap = await createImageBitmap(file);
  const scala = Math.min(1, LATO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scala);
  canvas.height = Math.round(bitmap.height * scala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
}

const nuovoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export async function aggiungiFoto(spotId, file) {
  const blob = await comprimi(file);
  const foto = { id: nuovoId(), spotId, blob, creata: new Date().toISOString() };
  await transazione('readwrite', (s) => s.put(foto));
  return foto;
}

export async function fotoDiSpot(spotId) {
  const elenco = await transazione('readonly', (s) => s.index('spotId').getAll(spotId));
  return (elenco || []).sort((a, b) => a.creata.localeCompare(b.creata));
}

export async function eliminaFoto(id) {
  await transazione('readwrite', (s) => s.delete(id));
}

export async function eliminaFotoDiSpot(spotId) {
  for (const f of await fotoDiSpot(spotId)) await eliminaFoto(f.id);
}

// --- Per esportazione e importazione: le foto viaggiano come data URL nel JSON

const blobInDataUrl = (blob) =>
  new Promise((resolve) => {
    const lettore = new FileReader();
    lettore.onload = () => resolve(lettore.result);
    lettore.readAsDataURL(blob);
  });

export async function esportaFoto() {
  const tutte = (await transazione('readonly', (s) => s.getAll())) || [];
  return Promise.all(tutte.map(async (f) => ({ id: f.id, spotId: f.spotId, creata: f.creata, dati: await blobInDataUrl(f.blob) })));
}

export async function importaFoto(elenco, spotValidi) {
  let n = 0;
  for (const f of elenco || []) {
    if (!f?.id || !spotValidi.has(f.spotId) || typeof f.dati !== 'string' || !f.dati.startsWith('data:image/')) continue;
    const blob = await (await fetch(f.dati)).blob();
    await transazione('readwrite', (s) => s.put({ id: f.id, spotId: f.spotId, blob, creata: f.creata || new Date().toISOString() }));
    n++;
  }
  return n;
}
