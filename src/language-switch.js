// Selettore della lingua (IT | EN), usato nella presentazione e nel pannello informazioni.

import { el } from './dom.js';
import { LINGUE, linguaAttuale, impostaLingua, alCambioLingua, t } from './i18n.js';

export function creaSelettoreLingua() {
  const pulsanti = LINGUE.map((codice) =>
    el(
      'button',
      {
        type: 'button',
        class: 'lingua-btn',
        lang: codice,
        onclick: () => impostaLingua(codice),
      },
      codice.toUpperCase(),
    ),
  );
  const gruppo = el('div', { class: 'lingua', role: 'group' }, pulsanti);

  function aggiorna() {
    gruppo.setAttribute('aria-label', t('lingua'));
    for (const btn of pulsanti) btn.setAttribute('aria-pressed', String(btn.lang === linguaAttuale()));
  }
  aggiorna();
  alCambioLingua(aggiorna);
  return gruppo;
}
