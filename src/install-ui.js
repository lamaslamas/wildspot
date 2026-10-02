// Blocco "Installa l'app": pulsante quando il browser lo permette,
// altrimenti istruzioni per farlo dal menu. Nascosto se l'app è già installata.

import { el } from './dom.js';
import { t } from './i18n.js';
import { installabile, installata, installa, alCambioInstallabile } from './pwa.js';

export function creaBloccoInstalla({ compatto = false } = {}) {
  const contenitore = el('div', { class: `installa${compatto ? ' installa-compatto' : ''}` });

  function disegna() {
    if (installata()) {
      contenitore.replaceChildren(compatto ? '' : el('p', { class: 'nota' }, t('installa.giaFatto')));
      return;
    }
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    contenitore.replaceChildren(
      installabile()
        ? el('button', { type: 'button', class: 'btn btn-largo btn-installa', onclick: () => installa() }, `⬇ ${t('installa.pulsante')}`)
        : el('p', { class: 'nota' }, t(iOS ? 'installa.ios' : 'installa.menu')),
    );
  }
  disegna();
  alCambioInstallabile(disegna);
  return contenitore;
}
