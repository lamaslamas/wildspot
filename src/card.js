// Scheda di dettaglio di un'osservazione, mostrata nel pannello in basso.

import { el } from './dom.js';
import { gruppo } from './groups.js';
import { t, locale } from './i18n.js';
import { htmlOsservazione, iconaPiccola } from './markers.js';

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
 * @param {{onSoloSpecie?: (o:object) => void, onLuce?: (punto) => void, onSalvaSpot?: (bozza) => void}} azioni
 */
export function creaScheda(o, { onSoloSpecie, onLuce, onSalvaSpot } = {}) {
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
      el('dd', {}, iconaPiccola(htmlOsservazione(o.gruppo, o.oscurata)), g.nome),
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
      onLuce && el('button', { class: 'btn', type: 'button', onclick: () => onLuce({ lat: o.lat, lng: o.lng }) }, t('scheda.luceMeteo')),
      // Niente spot da un'osservazione oscurata: salverebbe una posizione falsa
      onSalvaSpot &&
        !o.oscurata &&
        el(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () =>
              onSalvaSpot({ lat: o.lat, lng: o.lng, nome: (o.luogo || '').split(',')[0], specie: o.nomeComune || o.nomeSci }),
          },
          t('spot.salvaCome'),
        ),
    ),
  );
}

// Data eBird ("AAAA-MM-GG hh:mm" o "AAAA-MM-GG", ora locale del luogo) in forma breve
function dataEbird(testo) {
  if (!testo) return '';
  const conOra = testo.length > 10;
  const data = new Date(conOra ? testo.replace(' ', 'T') : `${testo}T12:00`);
  const opzioni = { day: 'numeric', month: 'short', ...(conOra && { hour: '2-digit', minute: '2-digit' }) };
  return new Intl.DateTimeFormat(locale(), opzioni).format(data);
}

/**
 * Scheda di un luogo eBird: dati dell'hotspot (se lo è) ed elenco degli
 * avvistamenti recenti, dal più recente.
 * @param {object} luogo  luogo creato da raggruppaPerLuogo
 * @param {{conAvvistamenti: boolean, onLuce?: (punto) => void, onSalvaSpot?: (bozza) => void}} opzioni
 */
export function creaSchedaLuogo(luogo, { conAvvistamenti, onLuce, onSalvaSpot }) {
  const avvistamenti = conAvvistamenti ? luogo.avvistamenti : [];
  const linkEbird = luogo.hotspot
    ? `https://ebird.org/hotspot/${luogo.locId}`
    : avvistamenti[0]?.link;

  return el(
    'article',
    { class: 'scheda' },
    el(
      'div',
      { class: 'etichette' },
      luogo.hotspot && el('span', { class: 'etichetta' }, t('ebird.hotspot')),
      luogo.notevole && conAvvistamenti && el('span', { class: 'etichetta etichetta-ocra' }, t('ebird.notevoli')),
    ),
    luogo.hotspot &&
      el(
        'dl',
        { class: 'scheda-dati' },
        el('dt', {}, t('ebird.specieTotali')),
        el('dd', {}, luogo.specieTotali),
        luogo.ultimaData && el('dt', {}, t('ebird.ultimaVisita')),
        luogo.ultimaData && el('dd', {}, dataEbird(luogo.ultimaData)),
      ),
    luogo.privato && el('p', { class: 'avviso' }, t('ebird.luogoPrivato')),
    avvistamenti.length > 0 && el('h3', {}, t('ebird.recenti', { n: avvistamenti.length })),
    avvistamenti.length > 0 &&
      el(
        'ul',
        { class: 'elenco-avvistamenti' },
        avvistamenti.map((a) =>
          el(
            'li',
            {},
            el(
              'a',
              { href: a.link, target: '_blank', rel: 'noopener' },
              el(
                'span',
                { class: 'avv-nome' },
                el('b', {}, a.nomeComune || a.nomeSci),
                a.notevole && el('span', { class: 'etichetta etichetta-ocra' }, t('ebird.notevole')),
              ),
              el('i', {}, a.nomeSci),
              el(
                'span',
                { class: 'avv-meta' },
                a.numero ? `×${a.numero} · ` : '',
                dataEbird(a.dataOra),
              ),
            ),
          ),
        ),
      ),
    luogo.hotspot && !avvistamenti.length && el('p', { class: 'nota' }, t('ebird.nessunRecente')),
    el(
      'div',
      { class: 'scheda-azioni' },
      linkEbird &&
        el('a', { class: 'btn btn-primario', href: linkEbird, target: '_blank', rel: 'noopener' }, t('scheda.apriSu', { fonte: 'eBird' })),
      onLuce && el('button', { class: 'btn', type: 'button', onclick: () => onLuce({ lat: luogo.lat, lng: luogo.lng }) }, t('scheda.luceMeteo')),
      onSalvaSpot &&
        el(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () =>
              onSalvaSpot({
                lat: luogo.lat,
                lng: luogo.lng,
                nome: luogo.nome,
                specie: [...new Set(avvistamenti.map((a) => a.nomeComune || a.nomeSci))].slice(0, 12).join(', '),
              }),
          },
          t('spot.salvaCome'),
        ),
    ),
  );
}
