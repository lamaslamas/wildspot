// Filtri delle osservazioni: periodo, gruppi di animali e ricerca per specie.

import { el, debounce } from './dom.js';
import { GRUPPI, GRUPPI_PREDEFINITI } from './groups.js';
import { suggerisciTaxa } from './inaturalist.js';
import { leggi, scrivi } from './storage.js';

export const PERIODI = [7, 14, 30];

// Stato iniziale: periodo e gruppi vengono ricordati, la specie no
// (riaprendo l'app è meglio vedere di nuovo tutto)
export function filtriIniziali() {
  const salvati = leggi('filtri', {});
  const gruppiValidi = (salvati.gruppi || []).filter((id) => GRUPPI.some((g) => g.id === id));
  return {
    giorni: PERIODI.includes(salvati.giorni) ? salvati.giorni : 14,
    gruppi: gruppiValidi.length ? gruppiValidi : [...GRUPPI_PREDEFINITI],
    taxon: null, // { id, nomeIt, nomeSci }
  };
}

export function salvaFiltri(filtri) {
  scrivi('filtri', { giorni: filtri.giorni, gruppi: filtri.gruppi });
}

// Quanti filtri sono diversi dalle impostazioni predefinite (per il badge)
export function contaFiltriAttivi(filtri) {
  let n = 0;
  if (filtri.giorni !== 14) n++;
  const predefiniti = [...GRUPPI_PREDEFINITI].sort().join();
  if ([...filtri.gruppi].sort().join() !== predefiniti) n++;
  if (filtri.taxon) n++;
  return n;
}

/**
 * Costruisce il contenuto del pannello filtri.
 * Ogni modifica viene applicata subito chiamando `onCambio(filtri)`.
 */
export function creaPannelloFiltri(filtri, onCambio) {
  function cambia(modifiche) {
    Object.assign(filtri, modifiche);
    onCambio(filtri);
    ridisegna();
  }

  // --- Periodo
  const periodo = el('div', { class: 'segmenti', role: 'radiogroup', 'aria-label': 'Periodo' });

  // --- Gruppi
  const gruppi = el('div', { class: 'chips' });

  // --- Specie
  const specieScelta = el('div', { class: 'specie-scelta' });
  const campo = el('input', {
    type: 'search',
    class: 'campo',
    placeholder: 'Es. airone, picchio, Vulpes…',
    autocomplete: 'off',
    'aria-label': 'Cerca una specie',
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
                      cambia({ taxon: { id: t.id, nomeIt: t.nomeIt, nomeSci: t.nomeSci } });
                    },
                  },
                  t.foto ? el('img', { src: t.foto, alt: '', loading: 'lazy' }) : el('span', { class: 'foto-vuota' }),
                  el('span', {}, el('b', {}, t.nomeIt || t.nomeSci), t.nomeIt && el('i', {}, t.nomeSci)),
                ),
              ),
            )
          : [el('li', { class: 'nessuno' }, 'Nessun animale trovato con questo nome')]),
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        suggerimenti.replaceChildren(el('li', { class: 'nessuno' }, 'Ricerca non disponibile: controlla la connessione'));
      }
    }
  }, 350);

  campo.addEventListener('input', () => cercaSuggerimenti(campo.value.trim()));

  function ridisegna() {
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
          `${giorni} giorni`,
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
          el('span', { class: 'pallino', style: `background:${g.colore}` }),
          g.nome,
        );
      }),
    );

    specieScelta.replaceChildren(
      filtri.taxon
        ? el(
            'div',
            { class: 'specie-attiva' },
            el('span', {}, el('b', {}, filtri.taxon.nomeIt || filtri.taxon.nomeSci), ' ', filtri.taxon.nomeIt && el('i', {}, filtri.taxon.nomeSci)),
            el('button', { type: 'button', class: 'btn', onclick: () => cambia({ taxon: null }) }, 'Rimuovi'),
          )
        : '',
    );
  }

  ridisegna();

  return el(
    'div',
    { class: 'filtri' },
    el('h3', {}, 'Periodo'),
    periodo,
    el('h3', {}, 'Gruppi di animali'),
    gruppi,
    el('h3', {}, 'Specie'),
    specieScelta,
    campo,
    suggerimenti,
  );
}
