// Vista "Elenco": le stesse osservazioni iNaturalist e gli stessi luoghi eBird
// mostrati sulla mappa, con gli stessi filtri, ordinati per distanza o per data.

import { el, distanzaKm } from './dom.js';
import { t, locale } from './i18n.js';
import { leggi, scrivi } from './storage.js';
import { htmlOsservazione, htmlLuogoEbird, htmlHotspot, iconaPiccola } from './markers.js';

const ORDINI = ['vicini', 'recenti'];

// Istante (ms) di una data iNaturalist (ISO) o eBird ("AAAA-MM-GG hh:mm")
function istante(testo) {
  if (!testo) return 0;
  const d = new Date(testo.length <= 10 ? `${testo}T12:00` : testo.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function dataBreve(ms) {
  return ms ? new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(ms) : '';
}

function distanzaLeggibile(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}

/**
 * @param {HTMLElement} contenitore
 * @param {{onApriOsservazione: (o) => void, onApriLuogo: (luogo, opzioni) => void}} azioni
 */
export function creaElenco(contenitore, { onApriOsservazione, onApriLuogo }) {
  let ordine = ORDINI.includes(leggi('ordineElenco', '')) ? leggi('ordineElenco', '') : 'vicini';
  let ultimi = null; // ultimi dati ricevuti, per ridisegnare quando cambia l'ordine

  /**
   * @param {object} dati
   * @param {object[]} dati.osservazioni  iNaturalist
   * @param {object[]} dati.luoghi        luoghi eBird (raggruppaPerLuogo)
   * @param {{avvistamenti: boolean, hotspot: boolean}} dati.visibili  livelli eBird accesi
   * @param {{lat:number,lng:number}} dati.riferimento  per le distanze
   */
  function aggiorna(dati) {
    ultimi = dati;
    const { osservazioni, luoghi, visibili, riferimento } = dati;

    const voci = [
      ...osservazioni.map((o) => ({
        chiave: o.id,
        km: distanzaKm(riferimento, o),
        quando: istante(o.dataOra || o.data),
        icona: htmlOsservazione(o.gruppo, o.oscurata),
        titolo: o.nomeComune || o.nomeSci,
        sottotitolo: o.nomeComune ? o.nomeSci : '',
        dettagli: ['iNaturalist', o.oscurata && t('elenco.approssimativa')],
        foto: o.foto?.piccola,
        apri: () => onApriOsservazione(o),
      })),
      ...luoghi
        .map((luogo) => {
          const conAvvistamenti = visibili.avvistamenti && luogo.avvistamenti.length > 0;
          if (!conAvvistamenti && !(visibili.hotspot && luogo.hotspot)) return null;
          const specie = new Set(luogo.avvistamenti.map((a) => a.codiceSpecie)).size;
          return {
            chiave: luogo.locId,
            km: distanzaKm(riferimento, luogo),
            quando: istante(conAvvistamenti ? luogo.avvistamenti[0].dataOra : luogo.ultimaData),
            icona: conAvvistamenti ? htmlLuogoEbird(specie, luogo.notevole) : htmlHotspot(),
            titolo: luogo.nome,
            sottotitolo: conAvvistamenti
              ? luogo.avvistamenti.slice(0, 3).map((a) => a.nomeComune || a.nomeSci).join(', ') + (specie > 3 ? '…' : '')
              : '',
            dettagli: [
              conAvvistamenti ? t(specie === 1 ? 'elenco.specieRecenti1' : 'elenco.specieRecenti', { n: specie }) : t('ebird.hotspot'),
              luogo.notevole && conAvvistamenti && `★ ${t('ebird.notevoli')}`,
            ],
            apri: () => onApriLuogo(luogo, { conAvvistamenti }),
          };
        })
        .filter(Boolean),
    ];

    voci.sort((a, b) => (ordine === 'vicini' ? a.km - b.km : b.quando - a.quando));

    const selettore = el(
      'div',
      { class: 'segmenti segmenti-elenco', role: 'radiogroup', 'aria-label': t('elenco.ordine') },
      ORDINI.map((o) =>
        el(
          'button',
          {
            type: 'button',
            role: 'radio',
            class: 'segmento',
            'aria-checked': String(o === ordine),
            onclick: () => {
              ordine = o;
              scrivi('ordineElenco', o);
              aggiorna(ultimi);
              contenitore.scrollTop = 0;
            },
          },
          t(`elenco.${o}`),
        ),
      ),
    );

    contenitore.replaceChildren(
      el('div', { class: 'elenco-testa' }, selettore),
      voci.length
        ? el(
            'ul',
            { class: 'elenco-voci' },
            voci.map((v) =>
              el(
                'li',
                {},
                el(
                  'button',
                  { type: 'button', class: 'voce', onclick: v.apri },
                  iconaPiccola(v.icona),
                  el(
                    'span',
                    { class: 'voce-testo' },
                    el('b', {}, v.titolo),
                    v.sottotitolo && el('i', {}, v.sottotitolo),
                    el(
                      'small',
                      {},
                      [...v.dettagli.filter(Boolean), dataBreve(v.quando), distanzaLeggibile(v.km)].filter(Boolean).join(' · '),
                    ),
                  ),
                  v.foto && el('img', { class: 'voce-foto', src: v.foto, alt: '', loading: 'lazy' }),
                ),
              ),
            ),
          )
        : el('p', { class: 'vuoto' }, t('elenco.vuoto')),
    );
  }

  return { aggiorna };
}
