// Pannello "Quando andare": le ore dorate dei prossimi giorni con un giudizio.

import { el } from './dom.js';
import { t, locale } from './i18n.js';
import { migliori, giudizio } from './best-times.js';
import { puntoCardinale } from './sun.js';
import { descriviCodice } from './weather.js';

/**
 * @param {{lat:number,lng:number}} punto
 * @param {(finestra) => void} onApri  apre il pannello luce su quella finestra
 */
export function creaQuandoAndare(punto, { onApri } = {}) {
  const contenitore = el('div', { class: 'quando-andare' }, el('p', { class: 'nota' }, t('andare.carico')));
  const fGiorno = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'short' });
  const fOra = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });

  migliori(punto)
    .then((finestre) => {
      if (!finestre.length) {
        contenitore.replaceChildren(el('p', { class: 'nota' }, t('andare.nessuna')));
        return;
      }
      // le tre migliori (a parità, la più vicina)
      const top = new Set([...finestre].sort((a, b) => b.valore - a.valore || a.inizio - b.inizio).slice(0, 3).filter((f) => f.valore >= 60));
      let giornoPrecedente = '';
      const righe = [];
      for (const f of finestre) {
        const giorno = fGiorno.format(f.inizio);
        if (giorno !== giornoPrecedente) {
          righe.push(el('li', { class: 'andare-giorno' }, giorno));
          giornoPrecedente = giorno;
        }
        const g = giudizio(f.valore);
        const { icona } = descriviCodice(f.meteo.codice, true);
        righe.push(
          el(
            'li',
            {},
            el(
              'button',
              { type: 'button', class: `andare-finestra${top.has(f) ? ' top' : ''}`, onclick: () => onApri?.(f) },
              el('span', { class: `andare-voto voto-${g}` }, t(`andare.${g}`)),
              el(
                'span',
                { class: 'andare-testo' },
                el('b', {}, `${t(`andare.${f.momento}`)} ${fOra.format(f.inizio)}–${fOra.format(f.fine)}`, top.has(f) ? ' ★' : ''),
                el(
                  'small',
                  {},
                  `${icona} ${f.motivi.map((m) => t(`andare.m.${m}`)).join(', ')} · ${t('andare.sole', { dir: t(`cardinale.${puntoCardinale(f.azimut)}`) })}`,
                ),
              ),
            ),
          ),
        );
      }
      contenitore.replaceChildren(
        el('p', { class: 'nota' }, t('andare.spiega')),
        el('ul', { class: 'elenco-andare' }, righe),
        el('p', { class: 'nota' }, t('andare.direzione')),
      );
    })
    .catch(() => contenitore.replaceChildren(el('p', { class: 'nota' }, t('meteo.errore'))));

  return contenitore;
}
