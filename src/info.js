// Contenuto del pannello informazioni: comportamento corretto e fonti dei dati.

import { el } from './dom.js';
import { t } from './i18n.js';

const link = (href, testo) => el('a', { href, target: '_blank', rel: 'noopener' }, testo);

// Inserisce un link al posto di {link} in un testo tradotto
function conLink(chiave, href, testoLink) {
  const [prima, dopo] = t(chiave).split('{link}');
  return [prima, link(href, testoLink), dopo];
}

export function creaInfo() {
  return el(
    'div',
    { class: 'info' },
    el('h3', {}, t('info.etica')),
    el('ul', {}, ['info.etica1', 'info.etica2', 'info.etica3', 'info.etica4', 'info.etica5'].map((k) => el('li', {}, t(k)))),
    el('h3', {}, t('info.fonti')),
    el(
      'ul',
      {},
      el('li', {}, conLink('info.fonteMappa', 'https://www.openstreetmap.org/copyright', 'OpenStreetMap')),
      el('li', {}, conLink('info.fonteInat', 'https://www.inaturalist.org', 'iNaturalist')),
      el('li', {}, conLink('info.fonteEbird', 'https://ebird.org', 'eBird')),
    ),
  );
}
