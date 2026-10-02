// Pannello "Sfondo": scelta della mappa di base e livello delle aree protette;
// scheda delle aree protette in un punto.

import { el } from './dom.js';
import { t } from './i18n.js';
import { SFONDI } from './basemaps.js';

// Anteprime: una tile di esempio (zona di Narni, zoom 11) per ogni sfondo
const ANTEPRIMA = { z: 11, x: 1095, y: 756 };
function urlAnteprima(id) {
  return SFONDI[id].url.replace('{s}', 'a').replace('{z}', ANTEPRIMA.z).replace('{x}', ANTEPRIMA.x).replace('{y}', ANTEPRIMA.y);
}

export function creaPannelloSfondi(sfondi, onCambio) {
  const contenitore = el('div', { class: 'sfondi' });

  function disegna() {
    contenitore.replaceChildren(
      el(
        'div',
        { class: 'sfondi-scelta', role: 'radiogroup', 'aria-label': t('sfondo.titolo') },
        Object.keys(SFONDI).map((id) =>
          el(
            'button',
            {
              type: 'button',
              role: 'radio',
              class: 'sfondo-opzione',
              'aria-checked': String(sfondi.sfondo() === id),
              onclick: () => {
                sfondi.impostaSfondo(id);
                onCambio?.();
                disegna();
              },
            },
            el('img', { src: urlAnteprima(id), alt: '', loading: 'lazy' }),
            el('span', {}, t(`sfondo.${id}`)),
          ),
        ),
      ),
      el('h3', {}, t('aree.titolo')),
      el(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(sfondi.areeAccese()),
          onclick: () => {
            sfondi.impostaAree(!sfondi.areeAccese());
            onCambio?.();
            disegna();
          },
        },
        el('span', { class: 'simbolo-aree' }),
        t('aree.mostra'),
      ),
      el('p', { class: 'nota' }, t('aree.spiega')),
    );
  }
  disegna();
  return contenitore;
}

const ETICHETTE_TIPO = { ZSC: 'aree.zsc', ZPS: 'aree.zps', parco: 'aree.parco' };

/** Scheda con le aree protette in cui cade un punto */
export function creaSchedaAree(aree) {
  if (!aree.length) return el('p', { class: 'nota' }, t('aree.nessuna'));
  return el(
    'div',
    { class: 'scheda' },
    el(
      'ul',
      { class: 'elenco-aree' },
      aree.map((a) =>
        el(
          'li',
          {},
          el('span', { class: `etichetta etichetta-${a.tipo === 'parco' ? 'verde' : 'ocra'}` }, t(ETICHETTE_TIPO[a.tipo])),
          el('b', {}, a.nome),
          a.iucn && el('small', {}, a.iucn),
          a.codice &&
            el(
              'a',
              { href: `https://natura2000.eea.europa.eu/Natura2000/SDF.aspx?site=${a.codice}`, target: '_blank', rel: 'noopener' },
              t('aree.scheda', { codice: a.codice }),
            ),
        ),
      ),
    ),
    el('p', { class: 'avviso' }, t('aree.regole')),
  );
}
