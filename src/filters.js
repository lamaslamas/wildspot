// Filtri: livelli visibili, periodo, gruppi di animali e ricerca per specie.

import { el, debounce } from './dom.js';
import { GRUPPI } from './groups.js';
import { suggerisciTaxa } from './inaturalist.js';
import { leggi, scrivi } from './storage.js';
import { t } from './i18n.js';
import { htmlOsservazione, htmlLivello, iconaPiccola } from './markers.js';

// Periodo in giorni; 0 significa "sempre" (nessun limite di data)
export const PERIODI = [7, 30, 365, 0];
const PERIODO_PREDEFINITO = 30;

// Livelli della mappa che si possono accendere e spegnere
export const LIVELLI = ['inat', 'ebirdAvvistamenti', 'ebirdHotspot', 'spot'];

// Stato iniziale: periodo e livelli vengono ricordati; i gruppi partono da
// quelli predefiniti nelle impostazioni; la specie no (riaprendo l'app è
// meglio vedere di nuovo tutto)
export function filtriIniziali(impostazioni) {
  const salvati = leggi('filtri', {});
  const livelli = Object.fromEntries(LIVELLI.map((l) => [l, salvati.livelli?.[l] !== false]));
  return {
    giorni: PERIODI.includes(salvati.giorni) ? salvati.giorni : PERIODO_PREDEFINITO,
    gruppi: [...impostazioni.gruppiPredefiniti],
    taxon: null, // { id, nomeComune, nomeSci }
    livelli,
  };
}

export function salvaFiltri(filtri) {
  scrivi('filtri', { giorni: filtri.giorni, livelli: filtri.livelli });
}

// Nessun filtro: tutto visibile. È lo stato a cui porta il pulsante "Azzera filtri"
// (anche i valori predefiniti delle impostazioni vengono tolti)
export function filtriVuoti() {
  return {
    giorni: 0, // sempre
    gruppi: GRUPPI.map((g) => g.id),
    taxon: null,
    livelli: Object.fromEntries(LIVELLI.map((l) => [l, true])),
  };
}

// Quante restrizioni sono attive rispetto a "tutto visibile" (per il badge)
export function contaFiltriAttivi(filtri) {
  let n = 0;
  if (filtri.giorni !== 0) n++;
  if (filtri.gruppi.length < GRUPPI.length) n++;
  if (filtri.taxon) n++;
  if (LIVELLI.some((l) => !filtri.livelli[l])) n++;
  return n;
}

/**
 * Costruisce il contenuto del pannello filtri.
 * Ogni modifica viene applicata subito chiamando `onCambio(filtri)`.
 * @param {{ebirdDisponibile: boolean, onApriImpostazioni: () => void}} opzioni
 */
export function creaPannelloFiltri(filtri, onCambio, { ebirdDisponibile, onApriImpostazioni }) {
  function cambia(modifiche) {
    Object.assign(filtri, modifiche);
    onCambio(filtri);
    ridisegna();
  }

  // --- Azzera: toglie tutti i filtri (in fondo al pannello, sempre visibile)
  const btnAzzera = el('button', { type: 'button', class: 'btn btn-largo', onclick: () => cambia(filtriVuoti()) });
  const piedeAzzera = el('div', { class: 'piede-azzera' }, btnAzzera);

  // --- Livelli
  const livelli = el('div', { class: 'chips' });
  const avvisoEbird = ebirdDisponibile
    ? null
    : el(
        'p',
        { class: 'nota' },
        t('filtri.ebirdSenzaChiave'),
        ' ',
        el('button', { type: 'button', class: 'link-btn', onclick: onApriImpostazioni }, t('filtri.apriImpostazioni')),
      );

  // --- Periodo
  const notaPeriodo = el('p', { class: 'nota' });
  const periodo = el('div', { class: 'segmenti', role: 'radiogroup', 'aria-label': t('filtri.periodo') });

  // --- Gruppi
  const gruppi = el('div', { class: 'chips' });

  // --- Specie
  const specieScelta = el('div', { class: 'specie-scelta' });
  const campo = el('input', {
    type: 'search',
    class: 'campo',
    placeholder: t('filtri.segnaposto'),
    autocomplete: 'off',
    'aria-label': t('filtri.cerca'),
  });
  const suggerimenti = el('ul', { class: 'suggerimenti', role: 'listbox' });
  let richiesta = null;

  const cercaSuggerimenti = debounce(async (testo) => {
    richiesta?.abort();
    if (testo.length < 3) {
      suggerimenti.replaceChildren();
      return;
    }
    richiesta = new AbortController();
    try {
      const taxa = await suggerisciTaxa(testo, richiesta.signal);
      suggerimenti.replaceChildren(
        ...(taxa.length
          ? taxa.map((t) =>
              el(
                'li',
                {},
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'suggerimento',
                    onclick: () => {
                      campo.value = '';
                      suggerimenti.replaceChildren();
                      cambia({ taxon: { id: t.id, nomeComune: t.nomeComune, nomeSci: t.nomeSci } });
                    },
                  },
                  t.foto ? el('img', { src: t.foto, alt: '', loading: 'lazy' }) : el('span', { class: 'foto-vuota' }),
                  el('span', {}, el('b', {}, t.nomeComune || t.nomeSci), t.nomeComune && el('i', {}, t.nomeSci)),
                ),
              ),
            )
          : [el('li', { class: 'nessuno' }, t('filtri.nessuno'))]),
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        suggerimenti.replaceChildren(el('li', { class: 'nessuno' }, t('filtri.nonDisponibile')));
      }
    }
  }, 350);

  campo.addEventListener('input', () => cercaSuggerimenti(campo.value.trim()));

  function ridisegna() {
    const attivi = contaFiltriAttivi(filtri);
    btnAzzera.disabled = attivi === 0;
    btnAzzera.textContent = attivi ? `${t('filtri.azzera')} (${attivi})` : t('filtri.nessunFiltro');

    livelli.replaceChildren(
      ...LIVELLI.map((id) => {
        const richiedeEbird = id.startsWith('ebird');
        const attivo = filtri.livelli[id] && (!richiedeEbird || ebirdDisponibile);
        return el(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(attivo),
            disabled: richiedeEbird && !ebirdDisponibile,
            onclick: () => cambia({ livelli: { ...filtri.livelli, [id]: !filtri.livelli[id] } }),
          },
          iconaPiccola(htmlLivello(id)),
          t(`livello.${id}`),
        );
      }),
    );

    // eBird non va oltre i 30 giorni: lo diciamo quando il periodo scelto è più lungo
    const ebirdLimitato = ebirdDisponibile && (filtri.giorni === 0 || filtri.giorni > 30);
    notaPeriodo.textContent = ebirdLimitato ? t('filtri.ebirdLimite') : '';
    notaPeriodo.hidden = !ebirdLimitato;

    periodo.replaceChildren(
      ...PERIODI.map((giorni) =>
        el(
          'button',
          {
            type: 'button',
            role: 'radio',
            class: 'segmento',
            'aria-checked': String(filtri.giorni === giorni),
            onclick: () => cambia({ giorni }),
          },
          t(`periodo.${giorni}`),
        ),
      ),
    );

    gruppi.replaceChildren(
      ...GRUPPI.map((g) => {
        const attivo = filtri.gruppi.includes(g.id);
        return el(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(attivo),
            // con una specie scelta il gruppo è già determinato
            disabled: Boolean(filtri.taxon),
            onclick: () => {
              const nuovi = attivo ? filtri.gruppi.filter((id) => id !== g.id) : [...filtri.gruppi, g.id];
              if (nuovi.length) cambia({ gruppi: nuovi }); // almeno un gruppo resta attivo
            },
          },
          iconaPiccola(htmlOsservazione(g.id)),
          t(`gruppo.${g.id}`),
        );
      }),
    );

    specieScelta.replaceChildren(
      filtri.taxon
        ? el(
            'div',
            { class: 'specie-attiva' },
            el('span', {}, el('b', {}, filtri.taxon.nomeComune || filtri.taxon.nomeSci), ' ', filtri.taxon.nomeComune && el('i', {}, filtri.taxon.nomeSci)),
            el('button', { type: 'button', class: 'btn', onclick: () => cambia({ taxon: null }) }, t('filtri.rimuovi')),
          )
        : '',
    );
  }

  ridisegna();

  return el(
    'div',
    { class: 'filtri' },
    el('h3', {}, t('filtri.livelli')),
    livelli,
    avvisoEbird,
    el('h3', {}, t('filtri.periodo')),
    periodo,
    notaPeriodo,
    el('h3', {}, t('filtri.gruppi')),
    gruppi,
    el('h3', {}, t('filtri.specie')),
    specieScelta,
    campo,
    suggerimenti,
    piedeAzzera,
  );
}
