// Blocco "Quando vederla": due piccoli grafici a barre (mesi e ore del giorno).

import { el } from './dom.js';
import { t, locale } from './i18n.js';
import { quandoVederla } from './species-stats.js';

function nomiMesi() {
  const f = new Intl.DateTimeFormat(locale(), { month: 'narrow' });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(2026, i, 15)));
}

// Grafico a barre: valori, etichette e indice da evidenziare (es. il mese corrente)
function grafico(valori, etichette, { evidenzia, titolo, descrivi }) {
  const max = Math.max(...valori, 1);
  const migliori = valori
    .map((v, i) => [v, i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3)
    .filter(([v]) => v > 0)
    .map(([, i]) => descrivi(i));
  return el(
    'figure',
    { class: 'grafico' },
    el('figcaption', {}, el('b', {}, titolo), migliori.length ? ` · ${t('stat.picco', { elenco: migliori.join(', ') })}` : ''),
    el(
      'div',
      { class: 'barre', role: 'img', 'aria-label': `${titolo}: ${migliori.join(', ')}` },
      valori.map((v, i) =>
        el(
          'span',
          { class: `barra${i === evidenzia ? ' attuale' : ''}`, title: `${descrivi(i)}: ${v}` },
          el('i', { style: `height:calc((100% - 16px) * ${Math.max(v ? 0.06 : 0.02, v / max).toFixed(3)})` }), // 16px = etichetta
          el('small', {}, etichette[i]),
        ),
      ),
    ),
  );
}

/**
 * Restituisce subito un contenitore, poi lo riempie quando arrivano i dati.
 * @param {number} taxonId
 * @param {{lat:number,lng:number}} centro
 */
export function creaQuandoVederla(taxonId, centro) {
  const contenitore = el('section', { class: 'quando' }, el('h3', {}, t('stat.titolo')), el('p', { class: 'nota' }, t('stat.carico')));
  const mesiBrevi = nomiMesi();
  const fMese = new Intl.DateTimeFormat(locale(), { month: 'long' });

  quandoVederla(taxonId, centro)
    .then(({ mesi, ore, raggioKm }) => {
      const totale = mesi.reduce((a, b) => a + b, 0);
      if (!totale) {
        contenitore.replaceChildren(el('h3', {}, t('stat.titolo')), el('p', { class: 'nota' }, t('stat.pochi')));
        return;
      }
      const conOra = ore.reduce((a, b) => a + b, 0);
      contenitore.replaceChildren(
        el('h3', {}, t('stat.titolo')),
        grafico(mesi, mesiBrevi, {
          evidenzia: new Date().getMonth(),
          titolo: t('stat.mesi'),
          descrivi: (i) => fMese.format(new Date(2026, i, 15)),
        }),
        conOra >= 5 &&
          grafico(ore, ore.map((_, h) => (h % 6 === 0 ? String(h) : '')), {
            evidenzia: new Date().getHours(),
            titolo: t('stat.ore'),
            descrivi: (h) => `${h}–${h + 1}`,
          }),
        el(
          'p',
          { class: 'nota' },
          raggioKm ? t('stat.fonte', { n: totale, km: raggioKm }) : t('stat.fonteMondo', { n: totale }),
          ' ',
          t('stat.avvertenza'),
        ),
      );
    })
    .catch(() => {
      contenitore.replaceChildren(el('h3', {}, t('stat.titolo')), el('p', { class: 'nota' }, t('stat.errore')));
    });

  return contenitore;
}
