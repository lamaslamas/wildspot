// Filtri: livelli visibili, periodo, gruppi di animali e ricerca per specie.

import { el, debounce } from './dom.js';
import { GRUPPI } from './groups.js';
import { suggerisciTaxa } from './inaturalist.js';
import { leggi, scrivi } from './storage.js';
import { t } from './i18n.js';
import { htmlOsservazione, htmlLivello, iconaPiccola } from './markers.js';

// Regola generale dei filtri: in ogni sezione, se non è selezionato niente
// non c'è nessun filtro e si vede tutto; selezionando qualcosa si restringe.
// - periodo: 0 = nessuno selezionato = da sempre
// - gruppi:  [] = tutti i gruppi
// - livelli: nessuno selezionato = tutti i punti (la heatmap no: va scelta)
// Le funzioni `effettivi()` traducono queste scelte in ciò che va mostrato.

export const PERIODI = [7, 30, 365];
const PERIODO_PREDEFINITO = 30;

export const LIVELLI = ['inat', 'ebirdAvvistamenti', 'ebirdHotspot', 'spot', 'heatmap'];
const LIVELLI_SENZA_SELEZIONE = { inat: true, ebirdAvvistamenti: true, ebirdHotspot: true, spot: true, heatmap: false };

const tuttiIGruppi = () => GRUPPI.map((g) => g.id);

// Tutti i gruppi selezionati equivalgono a nessuno: li salviamo come []
function normalizzaGruppi(gruppi) {
  const validi = gruppi.filter((id) => GRUPPI.some((g) => g.id === id));
  return validi.length === GRUPPI.length ? [] : validi;
}

// Stato iniziale: periodo e livelli vengono ricordati; i gruppi partono da
// quelli predefiniti nelle impostazioni; la specie no (riaprendo l'app è
// meglio vedere di nuovo tutto)
export function filtriIniziali(impostazioni) {
  const salvati = leggi('filtri', {});
  const scelti = Array.isArray(salvati.livelliScelti) ? salvati.livelliScelti : [];
  return {
    giorni: [...PERIODI, 0].includes(salvati.giorni) ? salvati.giorni : PERIODO_PREDEFINITO,
    gruppi: normalizzaGruppi(impostazioni.gruppiPredefiniti),
    taxon: null, // { id, nomeComune, nomeSci }
    livelli: Object.fromEntries(LIVELLI.map((l) => [l, scelti.includes(l)])), // scelte dell'utente
  };
}

export function salvaFiltri(filtri) {
  scrivi('filtri', { giorni: filtri.giorni, livelliScelti: LIVELLI.filter((l) => filtri.livelli[l]) });
}

// Ciò che va effettivamente mostrato, partendo dalle selezioni
export function effettivi(filtri) {
  const qualcheLivello = LIVELLI.some((l) => filtri.livelli[l]);
  return {
    giorni: filtri.giorni,
    gruppi: filtri.gruppi.length ? filtri.gruppi : tuttiIGruppi(),
    livelli: qualcheLivello ? { ...filtri.livelli } : { ...LIVELLI_SENZA_SELEZIONE },
  };
}

// "Azzera tutti i filtri": deseleziona tutto
export function filtriVuoti() {
  return {
    giorni: 0,
    gruppi: [],
    taxon: null,
    livelli: Object.fromEntries(LIVELLI.map((l) => [l, false])),
  };
}

// Quante sezioni hanno una selezione (per il badge e il pulsante Azzera)
export function contaFiltriAttivi(filtri) {
  let n = 0;
  if (filtri.giorni !== 0) n++;
  if (filtri.gruppi.length) n++;
  if (filtri.taxon) n++;
  if (LIVELLI.some((l) => filtri.livelli[l])) n++;
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

  const notaHeatmap = el('p', { class: 'nota' }, t('filtri.heatmapNota'));
  const notaLivelli = el('p', { class: 'nota' });
  const notaGruppi = el('p', { class: 'nota' });
  const notaPeriodoTutti = el('p', { class: 'nota' }, t('filtri.periodoTutti'));

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

    notaHeatmap.hidden = !filtri.livelli.heatmap;
    const eff = effettivi(filtri);
    notaLivelli.textContent = LIVELLI.some((l) => filtri.livelli[l]) ? t('filtri.soloScelti') : t('filtri.livelliTutti');
    notaGruppi.textContent = filtri.gruppi.length ? '' : t('filtri.gruppiTutti');
    notaGruppi.hidden = Boolean(filtri.gruppi.length) || Boolean(filtri.taxon);
    livelli.replaceChildren(
      ...LIVELLI.map((id) => {
        const richiedeEbird = id.startsWith('ebird');
        const attivo = filtri.livelli[id];
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
    const ebirdLimitato = ebirdDisponibile && eff.livelli.ebirdAvvistamenti && (filtri.giorni === 0 || filtri.giorni > 30);
    notaPeriodoTutti.hidden = filtri.giorni !== 0;
    notaPeriodo.textContent = ebirdLimitato ? t('filtri.ebirdLimite') : '';
    notaPeriodo.hidden = !ebirdLimitato;

    periodo.replaceChildren(
      ...PERIODI.map((giorni) =>
        el(
          'button',
          {
            type: 'button',
            class: 'segmento',
            'aria-pressed': String(filtri.giorni === giorni),
            // toccando il periodo già scelto lo si deseleziona (= da sempre)
            onclick: () => cambia({ giorni: filtri.giorni === giorni ? 0 : giorni }),
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
              cambia({ gruppi: normalizzaGruppi(nuovi) });
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
    notaLivelli,
    avvisoEbird,
    notaHeatmap,
    el('h3', {}, t('filtri.periodo')),
    periodo,
    notaPeriodoTutti,
    notaPeriodo,
    el('h3', {}, t('filtri.gruppi')),
    gruppi,
    notaGruppi,
    el('h3', {}, t('filtri.specie')),
    specieScelta,
    campo,
    suggerimenti,
    piedeAzzera,
  );
}
