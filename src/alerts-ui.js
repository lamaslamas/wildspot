// Pannello "Novità": nuove segnalazioni delle specie che segui.

import { el, distanzaKm } from './dom.js';
import { t, locale } from './i18n.js';
import { htmlOsservazione, iconaPiccola } from './markers.js';

function quando(n) {
  const testo = n.dati.dataOra || n.dati.data;
  if (!testo) return '';
  const d = new Date(testo.length <= 10 ? `${testo}T12:00` : testo.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

/**
 * @param {object[]} novita
 * @param {{riferimento, haSeguite: boolean, onApri: (n) => void, onSvuota: () => void, onControlla: () => void}} opzioni
 */
export function creaPannelloNovita(novita, { riferimento, haSeguite, onApri, onSvuota, onControlla, ultimoControllo }) {
  if (!haSeguite) {
    return el('div', {}, el('p', { class: 'vuoto' }, t('segui.comeSeguire')));
  }
  const fControllo = ultimoControllo
    ? new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ultimoControllo))
    : '—';
  return el(
    'div',
    {},
    el('p', { class: 'nota' }, t('segui.ultimoControllo', { quando: fControllo })),
    novita.length
      ? el(
          'ul',
          { class: 'elenco-voci' },
          novita.map((n) =>
            el(
              'li',
              { class: n.vista ? '' : 'novita-nuova' },
              el(
                'button',
                { type: 'button', class: 'voce', onclick: () => onApri(n) },
                iconaPiccola(htmlOsservazione(n.dati.gruppo || 'Aves', n.dati.oscurata)),
                el(
                  'span',
                  { class: 'voce-testo' },
                  el('b', {}, n.dati.nomeComune || n.dati.nomeSci),
                  el('i', {}, n.dati.luogo || ''),
                  el(
                    'small',
                    {},
                    [n.fonte, quando(n), riferimento ? `${Math.round(distanzaKm(riferimento, n.dati))} km` : '', n.dati.numero ? `×${n.dati.numero}` : '']
                      .filter(Boolean)
                      .join(' · '),
                  ),
                ),
              ),
            ),
          ),
        )
      : el('p', { class: 'vuoto' }, t('segui.nessunaNovita')),
    el(
      'div',
      { class: 'riga-azioni' },
      el('button', { type: 'button', class: 'btn', onclick: onControlla }, t('segui.controllaOra')),
      novita.length > 0 && el('button', { type: 'button', class: 'btn', onclick: onSvuota }, t('segui.svuota')),
    ),
  );
}
