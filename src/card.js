// Scheda di dettaglio di un'osservazione, mostrata nel pannello in basso.

import { el } from './dom.js';
import { gruppo } from './groups.js';
import { t, locale } from './i18n.js';

function dataLeggibile(o) {
  const opzioni = { day: 'numeric', month: 'long', year: 'numeric' };
  if (o.dataOra) {
    return new Intl.DateTimeFormat(locale(), { ...opzioni, hour: '2-digit', minute: '2-digit' }).format(new Date(o.dataOra));
  }
  if (o.data) return new Intl.DateTimeFormat(locale(), opzioni).format(new Date(`${o.data}T12:00:00`));
  return t('scheda.dataSconosciuta');
}

function distanzaLeggibile(metri) {
  return metri >= 1000 ? `${Math.round(metri / 1000)} km` : `${Math.round(metri)} m`;
}

/**
 * @param {object} o osservazione normalizzata
 * @param {{onSoloSpecie?: (o:object) => void}} azioni
 */
export function creaScheda(o, { onSoloSpecie } = {}) {
  const g = gruppo(o.gruppo);

  return el(
    'article',
    { class: 'scheda' },
    o.foto &&
      el(
        'figure',
        { class: 'scheda-foto' },
        el('img', {
          src: o.foto.media,
          alt: t('scheda.fotoDi', { nome: o.nomeComune || o.nomeSci }),
          loading: 'lazy',
          // se la versione media non esiste ripieghiamo sulla miniatura
          onerror: (e) => {
            if (e.target.src !== o.foto.piccola) e.target.src = o.foto.piccola;
          },
        }),
        el('figcaption', {}, o.foto.attribuzione),
      ),
    el('p', { class: 'scheda-nome' }, o.nomeComune || o.nomeSci),
    o.nomeComune && el('p', { class: 'scheda-sci' }, el('i', {}, o.nomeSci)),
    el(
      'dl',
      { class: 'scheda-dati' },
      el('dt', {}, t('scheda.gruppo')),
      el('dd', {}, el('span', { class: 'pallino', style: `background:${g.colore}` }), g.nome),
      el('dt', {}, t('scheda.data')),
      el('dd', {}, dataLeggibile(o)),
      o.numero && el('dt', {}, t('scheda.individui')),
      o.numero && el('dd', {}, o.numero),
      o.luogo && el('dt', {}, t('scheda.luogo')),
      o.luogo && el('dd', {}, o.luogo),
      o.osservatore && el('dt', {}, t('scheda.osservatore')),
      o.osservatore && el('dd', {}, o.osservatore),
    ),
    o.oscurata &&
      el(
        'p',
        { class: 'avviso' },
        t('scheda.oscurata', { distanza: distanzaLeggibile(o.incertezzaM) }),
      ),
    el(
      'div',
      { class: 'scheda-azioni' },
      el('a', { class: 'btn btn-primario', href: o.link, target: '_blank', rel: 'noopener' }, t('scheda.apriSu', { fonte: o.fonte })),
      onSoloSpecie &&
        o.taxonId &&
        el('button', { class: 'btn', type: 'button', onclick: () => onSoloSpecie(o) }, t('scheda.soloSpecie')),
    ),
  );
}
