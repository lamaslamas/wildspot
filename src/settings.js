// Impostazioni dell'utente, salvate solo su questo dispositivo (localStorage):
// chiave eBird, raggio predefinito e gruppi di animali predefiniti.

import { el } from './dom.js';
import { leggi, scrivi } from './storage.js';
import { GRUPPI, GRUPPI_PREDEFINITI } from './groups.js';
import { t } from './i18n.js';
import { creaSelettoreLingua } from './language-switch.js';
import { verificaChiave } from './ebird.js';
import { RAGGI_KM } from './radius.js';
import { creaBloccoInstalla } from './install-ui.js';
import { leggiSeguite, smettiDiSeguire } from './follow.js';
import { htmlOsservazione, iconaPiccola } from './markers.js';

export function leggiImpostazioni() {
  const s = leggi('impostazioni', {});
  const gruppi = (s.gruppiPredefiniti || []).filter((id) => GRUPPI.some((g) => g.id === id));
  return {
    chiaveEbird: typeof s.chiaveEbird === 'string' ? s.chiaveEbird : '',
    raggioPredefinito: RAGGI_KM.includes(s.raggioPredefinito) ? s.raggioPredefinito : 10,
    gruppiPredefiniti: gruppi.length ? gruppi : [...GRUPPI_PREDEFINITI],
    raggioAvvisi: RAGGI_KM.includes(s.raggioAvvisi) ? s.raggioAvvisi : 25,
  };
}

function salva(impostazioni) {
  scrivi('impostazioni', impostazioni);
}

/**
 * Pannello delle impostazioni. Ogni modifica viene salvata subito e
 * comunicata con `onCambio(impostazioni, cosaECambiato)`.
 */
export function creaPannelloImpostazioni(onCambio, { onApriInfo } = {}) {
  const imp = leggiImpostazioni();

  // --- Avvisi per le specie seguite
  const raggiAvvisi = el('div', { class: 'segmenti', role: 'radiogroup', 'aria-label': t('segui.raggio') });
  const elencoSeguite = el('ul', { class: 'elenco-seguite' });
  const btnNotifiche = el('button', { type: 'button', class: 'btn btn-largo' });
  async function chiediNotifiche() {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
    ridisegna();
  }
  btnNotifiche.addEventListener('click', chiediNotifiche);

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

  function ridisegnaAvvisi() {
    raggiAvvisi.replaceChildren(
      ...RAGGI_KM.map((km) =>
        el(
          'button',
          {
            type: 'button',
            role: 'radio',
            class: 'segmento',
            'aria-checked': String(imp.raggioAvvisi === km),
            onclick: () => cambia({ raggioAvvisi: km }, 'avvisi'),
          },
          `${km} km`,
        ),
      ),
    );
    const seguite = leggiSeguite();
    elencoSeguite.replaceChildren(
      ...(seguite.length
        ? seguite.map((s) =>
            el(
              'li',
              {},
              el('span', {}, el('b', {}, s.nomeComune || s.nomeSci), s.nomeComune ? el('small', {}, ` ${s.nomeSci}`) : ''),
              el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('segui.smetti'), onclick: () => { smettiDiSeguire(s.nomeSci); ridisegna(); } }, '×'),
            ),
          )
        : [el('li', { class: 'nota' }, t('segui.nessuna'))]),
    );
    const supportate = 'Notification' in window;
    const permesso = supportate ? Notification.permission : 'denied';
    btnNotifiche.hidden = !supportate || permesso !== 'default';
    btnNotifiche.textContent = t('segui.attivaNotifiche');
    notaNotifiche.textContent = !supportate
      ? t('segui.notificheNo')
      : permesso === 'granted'
        ? t('segui.notificheSi')
        : permesso === 'denied'
          ? t('segui.notificheNegate')
          : t('segui.notificheSpiega');
  }
  const notaNotifiche = el('p', { class: 'nota' });

  function ridisegna() {
    ridisegnaAvvisi();
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
          iconaPiccola(htmlOsservazione(g.id)),
          t(`gruppo.${g.id}`),
        );
      }),
    );
  }
  ridisegna();

  return el(
    'div',
    { class: 'impostazioni' },
    onApriInfo && el('button', { type: 'button', class: 'btn link-info', onclick: onApriInfo }, `ⓘ ${t('aria.info')}`),
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
    el('h3', {}, t('segui.titolo')),
    el('p', { class: 'nota' }, t('segui.spiega')),
    elencoSeguite,
    el('p', { class: 'nota' }, t('segui.raggio')),
    raggiAvvisi,
    btnNotifiche,
    notaNotifiche,
    el('h3', {}, t('installa.titolo')),
    creaBloccoInstalla(),
  );
}
