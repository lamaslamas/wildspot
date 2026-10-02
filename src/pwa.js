// Service worker (funzionamento offline) e pulsante "Installa l'app".

import { registerSW } from 'virtual:pwa-register';

// Il service worker si aggiorna da solo quando pubblichiamo una nuova versione
registerSW({ immediate: true });

// Chrome su Android segnala quando l'app si può installare: teniamo l'evento
// per mostrare il nostro pulsante invece di affidarci solo al menu del browser
let richiestaInstallazione = null;
const ascoltatori = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  richiestaInstallazione = e;
  ascoltatori.forEach((f) => f(true));
});

window.addEventListener('appinstalled', () => {
  richiestaInstallazione = null;
  ascoltatori.forEach((f) => f(false));
});

export function installabile() {
  return Boolean(richiestaInstallazione);
}

// L'app è già aperta come app installata?
export function installata() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function alCambioInstallabile(funzione) {
  ascoltatori.add(funzione);
}

export async function installa() {
  if (!richiestaInstallazione) return false;
  richiestaInstallazione.prompt();
  const { outcome } = await richiestaInstallazione.userChoice;
  richiestaInstallazione = null;
  ascoltatori.forEach((f) => f(false));
  return outcome === 'accepted';
}
