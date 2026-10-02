// Condivisione di uno spot: con la condivisione del telefono (WhatsApp, email…)
// se disponibile, altrimenti copia il testo negli appunti. La condivisione va
// sempre a una persona scelta da te: l'app non pubblica niente.

import { t } from './i18n.js';
import { CAMPI_NOTE } from './spots.js';

export async function condividiSpot(s) {
  const link = `https://www.google.com/maps/search/?api=1&query=${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
  const note = CAMPI_NOTE.filter((c) => s[c]).map((c) => `${t(`spot.${c}`)}: ${s[c]}`);
  const testo = [s.nome, ...note, link].join('\n');

  if (!window.confirm(t('condividi.avviso'))) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: s.nome, text: testo });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // annullata dall'utente
    }
  }
  try {
    await navigator.clipboard.writeText(testo);
    window.alert(t('condividi.copiato'));
  } catch {
    window.prompt(t('condividi.copia'), testo);
  }
}
