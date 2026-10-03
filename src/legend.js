// Legenda dei simboli sulla mappa. Usa lo stesso HTML degli indicatori veri,
// così ciò che si vede qui è identico a ciò che si vede sulla mappa.

import { el } from './dom.js';
import { t } from './i18n.js';
import { GRUPPI } from './groups.js';
import { htmlOsservazione, htmlLuogoEbird, htmlHotspot } from './markers.js';
import { HTML_SPOT } from './spots-layer.js';

// Elemento con HTML interno (solo per l'HTML generato da noi in markers.js)
function conHtml(classe, html) {
  const nodo = el('span', { class: classe });
  nodo.innerHTML = html;
  return nodo;
}

function voce(simbolo, titolo, spiegazione) {
  return el(
    'li',
    {},
    el('span', { class: 'legenda-simbolo' }, simbolo),
    el('span', { class: 'legenda-testo' }, el('b', {}, titolo), spiegazione && el('small', {}, spiegazione)),
  );
}

export function creaLegenda({ ebirdDisponibile, onApriInfo }) {
  return el(
    'div',
    {},
    el('h3', {}, 'iNaturalist'),
    el(
      'div',
      { class: 'legenda-gruppi' },
      GRUPPI.map((g) => el('span', {}, conHtml('', htmlOsservazione(g.id)), t(`gruppo.${g.id}`))),
    ),
    el(
      'ul',
      { class: 'legenda' },
      voce(conHtml('', htmlOsservazione('Mammalia', true)), t('legenda.oscurata'), t('legenda.oscurataSpiega')),
    ),
    el('h3', {}, 'eBird'),
    el(
      'ul',
      { class: 'legenda' },
      voce(conHtml('', htmlLuogoEbird(12)), t('legenda.ebird'), t('legenda.ebirdSpiega')),
      voce(conHtml('', htmlLuogoEbird(5, true)), t('legenda.notevole'), t('legenda.notevoleSpiega')),
      voce(conHtml('', htmlHotspot()), t('legenda.hotspot'), t('legenda.hotspotSpiega')),
    ),
    !ebirdDisponibile && el('p', { class: 'nota' }, t('filtri.ebirdSenzaChiave')),
    el('h3', {}, t('legenda.altro')),
    el(
      'ul',
      { class: 'legenda' },
      voce(conHtml('', HTML_SPOT), t('legenda.spot'), t('legenda.spotSpiega')),
      voce(conHtml('', '<span class="legenda-linee"><i style="--c:#d9480f"></i><i style="--c:#7b2cbf"></i><i class="tratt" style="--c:#1c7ed6"></i><i style="--c:#212529"></i></span>'), t('legenda.percorsi'), t('legenda.percorsiSpiega')),
      voce(conHtml('', '<span class="legenda-heat"></span>'), t('legenda.heatmap'), t('legenda.heatmapSpiega')),
      voce(conHtml('', '<span class="simbolo-aree grande"></span>'), t('legenda.aree'), t('legenda.areeSpiega')),
      voce(conHtml('', '<span class="mk-gruppo"><span>24</span></span>'), t('legenda.gruppo'), t('legenda.gruppoSpiega')),
      voce(conHtml('', '<span class="gps"></span>'), t('legenda.posizione')),
    ),
    onApriInfo && el('button', { type: 'button', class: 'btn btn-largo', onclick: onApriInfo }, `ⓘ ${t('aria.info')}`),
  );
}
