// Scheda di dettaglio di un'osservazione, mostrata nel pannello in basso.

import { el } from './dom.js';
import { gruppo } from './groups.js';

const formatoData = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const formatoDataOra = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function dataLeggibile(o) {
  if (o.dataOra) return formatoDataOra.format(new Date(o.dataOra));
  if (o.data) return formatoData.format(new Date(`${o.data}T12:00:00`));
  return 'Data sconosciuta';
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
          alt: `Foto di ${o.nomeIt || o.nomeSci}`,
          loading: 'lazy',
          // se la versione media non esiste ripieghiamo sulla miniatura
          onerror: (e) => {
            if (e.target.src !== o.foto.piccola) e.target.src = o.foto.piccola;
          },
        }),
        el('figcaption', {}, o.foto.attribuzione),
      ),
    el('p', { class: 'scheda-nome' }, o.nomeIt || o.nomeSci),
    o.nomeIt && el('p', { class: 'scheda-sci' }, el('i', {}, o.nomeSci)),
    el(
      'dl',
      { class: 'scheda-dati' },
      el('dt', {}, 'Gruppo'),
      el('dd', {}, el('span', { class: 'pallino', style: `background:${g.colore}` }), g.nome),
      el('dt', {}, 'Data'),
      el('dd', {}, dataLeggibile(o)),
      o.numero && el('dt', {}, 'Individui'),
      o.numero && el('dd', {}, o.numero),
      o.luogo && el('dt', {}, 'Luogo'),
      o.luogo && el('dd', {}, o.luogo),
      o.osservatore && el('dt', {}, 'Osservatore'),
      o.osservatore && el('dd', {}, o.osservatore),
    ),
    o.oscurata &&
      el(
        'p',
        { class: 'avviso' },
        `Posizione oscurata per tutelare la specie o su richiesta dell'osservatore: ` +
          `l'osservazione si trova in un punto qualsiasi entro circa ${distanzaLeggibile(o.incertezzaM)} ` +
          `dal centro del cerchio. Non cercare di risalire al luogo esatto.`,
      ),
    el(
      'div',
      { class: 'scheda-azioni' },
      el('a', { class: 'btn btn-primario', href: o.link, target: '_blank', rel: 'noopener' }, `Apri su ${o.fonte}`),
      onSoloSpecie &&
        o.taxonId &&
        el('button', { class: 'btn', type: 'button', onclick: () => onSoloSpecie(o) }, 'Solo questa specie'),
    ),
  );
}
