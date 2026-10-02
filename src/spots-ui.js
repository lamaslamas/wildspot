// Interfaccia del diario: elenco degli spot, scheda di uno spot e modulo di modifica.
// Qui si costruisce solo l'HTML; salvataggi e navigazione li gestisce main.js.

import { el, distanzaKm } from './dom.js';
import { t, locale } from './i18n.js';
import { CAMPI_NOTE } from './spots.js';
import { dataIso } from './weather.js';
import { iconaPiccola } from './markers.js';
import { HTML_SPOT } from './spots-layer.js';

function dataLunga(iso) {
  const [a, m, g] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a, m - 1, g));
}

function distanzaLeggibile(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}

/**
 * Elenco degli spot con le azioni del diario.
 * @param {object} p
 * @param {object[]} p.spot
 * @param {{lat:number,lng:number}|null} p.riferimento  per ordinare per distanza
 */
export function creaDiario({ spot, riferimento, messaggio, onApri, onNuovo, onEsporta, onImporta }) {
  // `messaggio` ({testo, tipo}) mostra l'esito di un'importazione appena fatta
  const esito = el('p', { class: 'esito', role: 'status', 'data-tipo': messaggio?.tipo }, messaggio?.testo || '');
  const campoFile = el('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onchange: async () => {
      const file = campoFile.files[0];
      campoFile.value = '';
      if (!file) return;
      onImporta(await file.text());
    },
  });

  const ordinati = [...spot].sort((a, b) =>
    riferimento ? distanzaKm(riferimento, a) - distanzaKm(riferimento, b) : a.nome.localeCompare(b.nome),
  );

  return el(
    'div',
    { class: 'diario' },
    el('button', { type: 'button', class: 'btn btn-primario btn-largo', onclick: onNuovo }, `+ ${t('spot.nuovo')}`),
    el('p', { class: 'nota' }, t('spot.comeAggiungere')),
    spot.length
      ? el(
          'ul',
          { class: 'elenco-spot' },
          ordinati.map((s) =>
            el(
              'li',
              {},
              el(
                'button',
                { type: 'button', onclick: () => onApri(s) },
                iconaPiccola(HTML_SPOT),
                el(
                  'span',
                  { class: 'spot-testo' },
                  el('b', {}, s.nome),
                  el(
                    'small',
                    {},
                    s.visite.length ? t('spot.ultimaVisita', { data: dataLunga(s.visite[0]) }) : t('spot.maiVisitato'),
                    riferimento ? ` · ${distanzaLeggibile(distanzaKm(riferimento, s))}` : '',
                  ),
                ),
              ),
            ),
          ),
        )
      : el('p', { class: 'vuoto' }, t('spot.nessuno')),
    el('h3', {}, t('spot.backup')),
    el('p', { class: 'nota' }, t('spot.backupNota')),
    el(
      'div',
      { class: 'riga-azioni' },
      el('button', { type: 'button', class: 'btn', disabled: !spot.length, onclick: onEsporta }, t('spot.esporta')),
      el('button', { type: 'button', class: 'btn', onclick: () => campoFile.click() }, t('spot.importa')),
    ),
    campoFile,
    esito,
  );
}

/**
 * Scheda di uno spot.
 */
export function creaSchedaSpot(s, { onVisitaOggi, onTogliVisita, onModifica, onLuce, onMappa, onElimina }) {
  const oggi = dataIso(new Date());
  const note = CAMPI_NOTE.filter((c) => s[c]);
  return el(
    'article',
    { class: 'scheda scheda-spot' },
    note.length
      ? el(
          'dl',
          { class: 'note-spot' },
          note.map((c) => [el('dt', {}, t(`spot.${c}`)), el('dd', {}, s[c])]),
        )
      : el('p', { class: 'nota' }, t('spot.senzaNote')),
    el('h3', {}, t('spot.visite', { n: s.visite.length })),
    s.visite.length
      ? el(
          'ul',
          { class: 'elenco-visite' },
          s.visite.map((v) =>
            el(
              'li',
              {},
              el('span', {}, dataLunga(v)),
              el(
                'button',
                { type: 'button', class: 'icon-btn', 'aria-label': t('spot.togliVisita', { data: dataLunga(v) }), onclick: () => onTogliVisita(v) },
                '×',
              ),
            ),
          ),
        )
      : el('p', { class: 'nota' }, t('spot.nessunaVisita')),
    !s.visite.includes(oggi) &&
      el('button', { type: 'button', class: 'btn btn-largo', onclick: onVisitaOggi }, t('spot.visitaOggi')),
    el(
      'div',
      { class: 'scheda-azioni' },
      onMappa && el('button', { type: 'button', class: 'btn', onclick: onMappa }, t('scheda.mostraMappa')),
      el(
        'a',
        {
          class: 'btn btn-primario',
          href: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`,
          target: '_blank',
          rel: 'noopener',
        },
        t('spot.naviga'),
      ),
      el('button', { type: 'button', class: 'btn', onclick: onLuce }, t('scheda.luceMeteo')),
      el('button', { type: 'button', class: 'btn', onclick: onModifica }, t('spot.modifica')),
    ),
    el('p', { class: 'nota' }, `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`),
    el('button', { type: 'button', class: 'link-btn link-pericolo', onclick: onElimina }, t('spot.elimina')),
  );
}

/**
 * Modulo per creare o modificare uno spot.
 * @param {object} bozza  spot esistente o nuovo (con lat/lng ed eventuali campi precompilati)
 * @param {{posizioneGps: object|null, onPosizione: (punto) => void}} contesto
 * Il form restituito ha il metodo `impostaPosizione(punto)`, usato quando si tocca la mappa.
 */
export function creaModuloSpot(bozza, { posizioneGps, onSalva, onAnnulla, onPosizione }) {
  const posizione = { lat: bozza.lat, lng: bozza.lng };
  const elPosizione = el('span', {});
  const mostraPosizione = () => (elPosizione.textContent = `${posizione.lat.toFixed(5)}, ${posizione.lng.toFixed(5)}`);
  mostraPosizione();

  const nome = el('input', {
    type: 'text',
    class: 'campo',
    value: bozza.nome || '',
    maxlength: 120,
    placeholder: t('spot.nomeSegnaposto'),
  });
  const campi = Object.fromEntries(
    CAMPI_NOTE.map((c) => [c, el('textarea', { class: 'campo campo-testo', rows: 2, placeholder: t(`spot.${c}Segnaposto`) })]),
  );
  for (const c of CAMPI_NOTE) campi[c].value = bozza[c] || '';

  const errore = el('p', { class: 'esito', role: 'status' });

  const etichetta = (testo, campo) => el('label', { class: 'etichetta-campo' }, el('span', {}, testo), campo);

  const modulo = el(
    'form',
    {
      class: 'modulo-spot',
      onsubmit: (e) => {
        e.preventDefault();
        if (!nome.value.trim()) {
          errore.textContent = t('spot.nomeObbligatorio');
          errore.dataset.tipo = 'errore';
          nome.focus();
          return;
        }
        onSalva({
          ...(bozza.id && { id: bozza.id }),
          nome: nome.value,
          lat: posizione.lat,
          lng: posizione.lng,
          ...Object.fromEntries(CAMPI_NOTE.map((c) => [c, campi[c].value])),
        });
      },
    },
    etichetta(t('spot.nome'), nome),
    ...CAMPI_NOTE.map((c) => etichetta(t(`spot.${c}`), campi[c])),
    el(
      'p',
      { class: 'nota' },
      t('spot.posizione'), ' ', elPosizione, '. ', t('luce.spostaPunto'),
      posizioneGps &&
        el(
          'button',
          {
            type: 'button',
            class: 'link-btn',
            onclick: () => modulo.impostaPosizione(posizioneGps),
          },
          ` · ${t('spot.usaPosizione')}`,
        ),
    ),
    errore,
    el(
      'div',
      { class: 'riga-azioni' },
      el('button', { type: 'submit', class: 'btn btn-primario' }, t('spot.salva')),
      el('button', { type: 'button', class: 'btn', onclick: onAnnulla }, t('spot.annulla')),
    ),
  );

  modulo.impostaPosizione = (punto) => {
    posizione.lat = punto.lat;
    posizione.lng = punto.lng;
    mostraPosizione();
    onPosizione?.(posizione);
  };
  return modulo;
}
