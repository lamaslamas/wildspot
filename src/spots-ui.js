// Interfaccia del diario: elenco degli spot, scheda di uno spot e modulo di modifica.
// Qui si costruisce solo l'HTML; salvataggi e navigazione li gestisce main.js.

import { el, distanzaKm } from './dom.js';
import { t, locale } from './i18n.js';
import { CAMPI_NOTE } from './spots.js';
import { dataIso } from './weather.js';
import { iconaPiccola } from './markers.js';
import { HTML_SPOT } from './spots-layer.js';
import { htmlOsservazione } from './markers.js';
import { perSpecie } from './photographed.js';
import { fotoDiSpot, aggiungiFoto, eliminaFoto } from './photos.js';

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
export function creaDiario({ spot, riferimento, messaggio, scheda = 'spot', onScheda, onApri, onNuovo, onEsporta, onImporta, onEliminaFotografata }) {
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

  const specie = perSpecie();
  const schede = el(
    'div',
    { class: 'segmenti schede-diario', role: 'tablist' },
    [['spot', t('spot.schedaSpot', { n: spot.length })], ['specie', t('foto.schedaSpecie', { n: specie.length })]].map(([id, testo]) =>
      el('button', { type: 'button', role: 'tab', class: 'segmento', 'aria-selected': String(scheda === id), onclick: () => onScheda(id) }, testo),
    ),
  );

  const contenuto =
    scheda === 'specie'
      ? elencoSpecie(specie, onEliminaFotografata)
      : [
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
        ];

  return el(
    'div',
    { class: 'diario' },
    schede,
    contenuto,
    el('h3', {}, t('spot.backup')),
    el('p', { class: 'nota' }, t('spot.backupNota')),
    el(
      'div',
      { class: 'riga-azioni' },
      el('button', { type: 'button', class: 'btn', disabled: !spot.length && !specie.length, onclick: onEsporta }, t('spot.esporta')),
      el('button', { type: 'button', class: 'btn', onclick: () => campoFile.click() }, t('spot.importa')),
    ),
    campoFile,
    esito,
  );
}

// Elenco "Specie fotografate": una voce per specie, si apre per vedere le volte
function elencoSpecie(specie, onElimina) {
  if (!specie.length) return el('p', { class: 'vuoto' }, t('foto.nessuna'));
  return [
    el('p', { class: 'nota' }, t('foto.comeAggiungere')),
    el(
      'ul',
      { class: 'elenco-specie-foto' },
      specie.map((g) =>
        el(
          'li',
          {},
          el(
            'details',
            {},
            el(
              'summary',
              {},
              iconaPiccola(htmlOsservazione(g.gruppo || 'Aves')),
              el(
                'span',
                { class: 'spot-testo' },
                el('b', {}, g.nomeComune || g.nomeSci),
                el('small', {}, `${g.nomeComune ? `${g.nomeSci} · ` : ''}${t(g.volte.length === 1 ? 'foto.volta1' : 'foto.volte', { n: g.volte.length })} · ${dataLunga(g.volte[0].data)}`),
              ),
            ),
            el(
              'ul',
              { class: 'elenco-visite' },
              g.volte.map((v) =>
                el(
                  'li',
                  {},
                  el('span', {}, dataLunga(v.data), v.luogo ? ` · ${v.luogo}` : ''),
                  el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('foto.elimina'), onclick: () => onElimina(v.id) }, '×'),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ];
}

// Galleria delle foto di uno spot: miniature, aggiunta e visualizzazione a schermo intero
function creaGalleria(spotId) {
  const griglia = el('div', { class: 'galleria' });
  const urls = [];
  const campo = el('input', {
    type: 'file',
    accept: 'image/*',
    multiple: true,
    hidden: true,
    onchange: async () => {
      const file = [...campo.files];
      campo.value = '';
      for (const f of file) await aggiungiFoto(spotId, f).catch(() => {});
      disegna();
    },
  });
  const btnAggiungi = el('button', { type: 'button', class: 'galleria-aggiungi', onclick: () => campo.click() }, el('span', {}, '+'), t('foto.aggiungi'));

  function apriGrande(f, url) {
    const vista = el(
      'div',
      { class: 'foto-grande', role: 'dialog', 'aria-modal': 'true' },
      el('img', { src: url, alt: '' }),
      el(
        'div',
        { class: 'foto-grande-azioni' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: async () => {
              if (!window.confirm(t('foto.confermaElimina'))) return;
              await eliminaFoto(f.id);
              vista.remove();
              disegna();
            },
          },
          t('foto.eliminaFoto'),
        ),
        el('button', { type: 'button', class: 'btn btn-primario', onclick: () => vista.remove() }, t('aria.chiudi')),
      ),
    );
    document.body.append(vista);
  }

  async function disegna() {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    let foto = [];
    try {
      foto = await fotoDiSpot(spotId);
    } catch {
      griglia.replaceChildren(el('p', { class: 'nota' }, t('foto.nonDisponibili')));
      return;
    }
    griglia.replaceChildren(
      ...foto.map((f) => {
        const url = URL.createObjectURL(f.blob);
        urls.push(url);
        return el('button', { type: 'button', class: 'galleria-foto', onclick: () => apriGrande(f, url) }, el('img', { src: url, alt: '' }));
      }),
      btnAggiungi,
      campo,
    );
  }
  disegna();
  return griglia;
}

/**
 * Scheda di uno spot.
 */
export function creaSchedaSpot(s, { onVisitaOggi, onTogliVisita, onModifica, onLuce, onQuandoAndare, onMappa, onElimina, onCondividi }) {
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
    el('h3', {}, t('foto.titolo')),
    creaGalleria(s.id),
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
      el('button', { type: 'button', class: 'btn', onclick: onQuandoAndare }, `★ ${t('andare.titolo')}`),
      el('button', { type: 'button', class: 'btn', onclick: onLuce }, t('scheda.luceMeteo')),
      el('button', { type: 'button', class: 'btn', onclick: onModifica }, t('spot.modifica')),
      el('button', { type: 'button', class: 'btn', onclick: onCondividi }, t('condividi.pulsante')),
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
