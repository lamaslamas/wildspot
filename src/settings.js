// Impostazioni dell'utente, salvate solo su questo dispositivo (localStorage):
// chiave eBird, raggio predefinito e gruppi di animali predefiniti.

import { el } from './dom.js';
import { leggi, scrivi } from './storage.js';
import { GRUPPI, GRUPPI_PREDEFINITI } from './groups.js';
import { t } from './i18n.js';
import { creaSelettoreLingua } from './language-switch.js';
import { verificaChiave } from './ebird.js';
import { RAGGI_KM } from './radius.js';

export function leggiImpostazioni() {
  const s = leggi('impostazioni', {});
  const gruppi = (s.gruppiPredefiniti || []).filter((id) => GRUPPI.some((g) => g.id === id));
  return {
    chiaveEbird: typeof s.chiaveEbird === 'string' ? s.chiaveEbird : '',
    raggioPredefinito: RAGGI_KM.includes(s.raggioPredefinito) ? s.raggioPredefinito : 10,
    gruppiPredefiniti: gruppi.length ? gruppi : [...GRUPPI_PREDEFINITI],
  };
}

function salva(impostazioni) {
  scrivi('impostazioni', impostazioni);
}

/**
 * Pannello delle impostazioni. Ogni modifica viene salvata subito e
 * comunicata con `onCambio(impostazioni, cosaECambiato)`.
 */
export function creaPannelloImpostazioni(onCambio) {
  const imp = leggiImpostazioni();

  function cambia(modifiche, cosa) {
    Object.assign(imp, modifiche);
    salva(imp);
    onCambio(imp, cosa);
    ridisegna();
  }

  // --- Chiave eBird
  const campoChiave = el('input', {
    type: 'password',
    class: 'campo',
    value: imp.chiaveEbird,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    placeholder: t('imp.chiaveSegnaposto'),
    'aria-label': t('imp.chiave'),
  });
  const btnMostra = el(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: () => {
        const nascosta = campoChiave.type === 'password';
        campoChiave.type = nascosta ? 'text' : 'password';
        btnMostra.textContent = t(nascosta ? 'imp.nascondi' : 'imp.mostra');
      },
    },
    t('imp.mostra'),
  );
  const esito = el('p', { class: 'esito', role: 'status' });

  const btnSalva = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-primario',
      onclick: async () => {
        // Una chiave eBird non contiene spazi: togliamo anche quelli aggiunti dalla tastiera
        const chiave = campoChiave.value.replace(/\s+/g, '');
        campoChiave.value = chiave;
        if (!chiave) return;
        btnSalva.disabled = true;
        mostraEsito('imp.verifico', 'info');
        try {
          if (await verificaChiave(chiave)) {
            cambia({ chiaveEbird: chiave }, 'chiave');
            mostraEsito('imp.chiaveOk', 'ok');
          } else {
            // Testo con simboli (es. un codice con trattini): probabilmente non è la chiave giusta
            mostraEsito(/[^a-z0-9]/i.test(chiave) ? 'imp.chiaveFormato' : 'imp.chiaveNonValida', 'errore');
          }
        } catch {
          mostraEsito('imp.verificaNonRiuscita', 'errore');
        } finally {
          btnSalva.disabled = false;
        }
      },
    },
    t('imp.verificaSalva'),
  );

  const btnRimuovi = el(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: () => {
        campoChiave.value = '';
        cambia({ chiaveEbird: '' }, 'chiave');
        mostraEsito('imp.chiaveRimossa', 'info');
      },
    },
    t('imp.rimuovi'),
  );

  function mostraEsito(chiave, tipo) {
    esito.textContent = t(chiave);
    esito.dataset.tipo = tipo;
  }

  // --- Raggio e gruppi predefiniti
  const raggi = el('div', { class: 'segmenti', role: 'radiogroup', 'aria-label': t('imp.raggio') });
  const gruppi = el('div', { class: 'chips' });

  function ridisegna() {
    btnRimuovi.hidden = !imp.chiaveEbird;
    raggi.replaceChildren(
      ...RAGGI_KM.map((km) =>
        el(
          'button',
          {
            type: 'button',
            role: 'radio',
            class: 'segmento',
            'aria-checked': String(imp.raggioPredefinito === km),
            onclick: () => cambia({ raggioPredefinito: km }, 'raggio'),
          },
          `${km} km`,
        ),
      ),
    );
    gruppi.replaceChildren(
      ...GRUPPI.map((g) => {
        const attivo = imp.gruppiPredefiniti.includes(g.id);
        return el(
          'button',
          {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(attivo),
            onclick: () => {
              const nuovi = attivo
                ? imp.gruppiPredefiniti.filter((id) => id !== g.id)
                : [...imp.gruppiPredefiniti, g.id];
              if (nuovi.length) cambia({ gruppiPredefiniti: nuovi }, 'gruppi');
            },
          },
          el('span', { class: 'pallino', style: `background:${g.colore}` }),
          t(`gruppo.${g.id}`),
        );
      }),
    );
  }
  ridisegna();

  return el(
    'div',
    { class: 'impostazioni' },
    el('h3', {}, t('imp.ebird')),
    el(
      'p',
      { class: 'nota' },
      t('imp.ebirdSpiegazione'),
      ' ',
      el('a', { href: 'https://ebird.org/api/keygen', target: '_blank', rel: 'noopener' }, t('imp.ottieniChiave')),
    ),
    el('div', { class: 'riga-campo' }, campoChiave, btnMostra),
    el('div', { class: 'riga-azioni' }, btnSalva, btnRimuovi),
    esito,
    el('p', { class: 'nota' }, t('imp.chiavePrivata')),
    el('h3', {}, t('imp.raggio')),
    raggi,
    el('h3', {}, t('imp.gruppi')),
    gruppi,
    el('p', { class: 'nota' }, t('imp.predefinitiNota')),
    el('h3', {}, t('lingua')),
    creaSelettoreLingua(),
  );
}
