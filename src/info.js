// Contenuto del pannello informazioni: comportamento corretto e fonti dei dati.

import { el } from './dom.js';

const link = (href, testo) => el('a', { href, target: '_blank', rel: 'noopener' }, testo);

export function creaInfo() {
  return el(
    'div',
    { class: 'info' },
    el('h3', {}, 'Fotografare senza disturbare'),
    el(
      'ul',
      {},
      el('li', {}, 'Mantieni la distanza: se l\'animale cambia comportamento, sei troppo vicino. Usa il teleobiettivo, non i passi.'),
      el('li', {}, 'Stai lontano dai siti di nidificazione e dalle tane, soprattutto in primavera e inizio estate.'),
      el('li', {}, 'Niente richiami registrati nel periodo riproduttivo: stressano gli animali e li distolgono dalla cova.'),
      el('li', {}, 'Resta sui sentieri, rispetta le aree protette e le proprietà private.'),
      el('li', {}, 'Non condividere la posizione di specie sensibili: le posizioni oscurate in quest\'app restano tali.'),
    ),
    el('h3', {}, 'Fonti dei dati'),
    el(
      'ul',
      {},
      el('li', {}, 'Mappa © ', link('https://www.openstreetmap.org/copyright', 'OpenStreetMap'), ' contributors'),
      el('li', {}, 'Osservazioni e foto da ', link('https://www.inaturalist.org', 'iNaturalist'), ': i diritti delle foto appartengono ai rispettivi autori'),
    ),
  );
}
