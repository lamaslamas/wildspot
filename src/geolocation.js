// Lettura della posizione tramite il GPS del browser.
// Nota: funziona solo in HTTPS (GitHub Pages) o su localhost.
// In caso di problemi l'errore ha una proprietà `chiave` da tradurre con t().

const CHIAVI_ERRORE = {
  1: 'gps.negato',
  2: 'gps.nonDisponibile',
  3: 'gps.timeout',
};

function errore(chiave) {
  const e = new Error(chiave);
  e.chiave = chiave;
  return e;
}

export function leggiPosizione() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(errore('gps.nonSupportato'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisione: pos.coords.accuracy, // in metri
        }),
      (err) => reject(errore(CHIAVI_ERRORE[err.code] || 'gps.errore')),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000, // accettiamo una posizione vecchia al massimo di un minuto
      },
    );
  });
}
