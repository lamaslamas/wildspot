// Lettura della posizione tramite il GPS del browser.
// Nota: funziona solo in HTTPS (GitHub Pages) o su localhost.

const MESSAGGI_ERRORE = {
  1: 'Permesso di posizione negato. Abilitalo nelle impostazioni del browser.',
  2: 'Posizione non disponibile. Prova all\'aperto o attiva il GPS.',
  3: 'Il GPS non ha risposto in tempo. Riprova.',
};

export function leggiPosizione() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Questo browser non supporta la geolocalizzazione.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisione: pos.coords.accuracy, // in metri
        }),
      (err) => reject(new Error(MESSAGGI_ERRORE[err.code] || 'Errore di geolocalizzazione.')),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000, // accettiamo una posizione vecchia al massimo di un minuto
      },
    );
  });
}
