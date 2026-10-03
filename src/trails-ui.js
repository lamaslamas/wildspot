// Interfaccia di percorsi e tracce GPX: pannello "Percorsi", scheda di un
// percorso, scheda di una traccia, segnavia e profilo altimetrico.

import { el } from './dom.js';
import { t, locale } from './i18n.js';
import { TIPI_PERCORSO, COLORI_PERCORSO } from './trails.js';
import { COLORE_TRACCIA } from './trails-layer.js';
import { htmlOsservazione, htmlLuogoEbird, iconaPiccola } from './markers.js';

export const RAGGI_PERCORSI = [1, 3, 5]; // oltre i 5 km Overpass diventa troppo lento

const numero = (n, cifre = 1) => new Intl.NumberFormat(locale(), { maximumFractionDigits: cifre }).format(n);

// --- Segnavia da osmc:symbol, es. "red:red:white_stripe:740:black"
// formato: colore_via:sfondo[:simbolo[:simbolo2]][:testo[:colore_testo]]
const COLORI_OSMC = {
  red: '#d6201f', white: '#ffffff', blue: '#1e5fc4', yellow: '#f5c400', green: '#2b8a3e',
  black: '#111111', orange: '#f08c00', purple: '#7b2cbf', brown: '#8a4b1f', gray: '#868e96', grey: '#868e96',
};
const coloreOsmc = (c) => COLORI_OSMC[c] || null;

export function svgSegnavia(simbolo, lato = 34) {
  const parti = (simbolo || '').split(':');
  if (parti.length < 2) return '';
  const sfondo = parti[1].replace(/_.*$/, ''); // "white_circle" -> white
  const segni = [];
  let testo = '';
  let coloreTesto = '#111';
  // i campi dopo lo sfondo: simboli "colore_forma", poi testo e colore del testo
  for (let i = 2; i < parti.length; i++) {
    const p = parti[i];
    if (/^[a-z]+_[a-z_]+$/.test(p) && coloreOsmc(p.split('_')[0])) segni.push(p);
    else if (!testo && p) {
      testo = p.slice(0, 4);
      if (coloreOsmc(parti[i + 1])) coloreTesto = coloreOsmc(parti[i + 1]);
      break;
    }
  }
  const forme = segni
    .map((s) => {
      const [colore, ...resto] = s.split('_');
      const c = coloreOsmc(colore);
      const forma = resto.join('_');
      switch (forma) {
        case 'stripe': return `<rect x="0" y="12" width="40" height="16" fill="${c}"/>`;
        case 'bar': return `<rect x="13" y="0" width="14" height="40" fill="${c}"/>`;
        case 'lower': return `<rect x="0" y="20" width="40" height="20" fill="${c}"/>`;
        case 'dot': return `<circle cx="20" cy="20" r="10" fill="${c}"/>`;
        case 'circle': return `<circle cx="20" cy="20" r="11" fill="none" stroke="${c}" stroke-width="5"/>`;
        case 'diamond': return `<path d="M20 6 34 20 20 34 6 20z" fill="${c}"/>`;
        case 'triangle': return `<path d="M20 7 34 32H6z" fill="${c}"/>`;
        case 'cross': return `<path d="M17 4h6v13h13v6H23v13h-6V23H4v-6h13z" fill="${c}"/>`;
        case 'left': return `<rect x="0" y="0" width="20" height="40" fill="${c}"/>`;
        case 'corner': return `<path d="M0 0h40L0 40z" fill="${c}"/>`;
        default: return '';
      }
    })
    .join('');
  // senza forme né scritta il segnavia sarebbe un quadrato vuoto: meglio niente
  if (!forme && !testo) return '';
  const scritta = testo
    ? `<text x="20" y="25" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="${testo.length > 3 ? 11 : 13}" fill="${coloreTesto}" stroke="${coloreTesto === '#111111' || coloreTesto === '#111' ? '#fff' : '#000'}" stroke-width="2.5" paint-order="stroke">${testo.replace(/[<&>"]/g, '')}</text>`
    : '';
  return `<svg class="segnavia" viewBox="0 0 40 40" width="${lato}" height="${lato}" aria-hidden="true"><rect width="40" height="40" rx="5" fill="${coloreOsmc(sfondo) || '#fff'}" stroke="#666" stroke-width="1.5"/>${forme}${scritta}</svg>`;
}

function conHtml(html) {
  const nodo = el('span', { class: 'segnavia-contenitore' });
  nodo.innerHTML = html; // SVG generato qui sopra, con il testo ripulito
  return nodo;
}

function titoloPercorso(p) {
  if (p.nome && p.ref && !p.nome.includes(p.ref)) return `${p.ref} · ${p.nome}`;
  return p.nome || (p.ref ? `${t('percorsi.sentiero')} ${p.ref}` : t(`percorsi.tipo.${p.tipo}`));
}

function testoDifficolta(d) {
  const parti = [];
  if (d.cai) parti.push(`CAI ${d.cai}`);
  if (d.sac) parti.push(`SAC ${d.sac}`);
  if (d.mtb !== undefined) parti.push(`MTB S${d.mtb}`);
  if (d.mtbSalita !== undefined) parti.push(`↑ S${d.mtbSalita}`);
  return parti.join(' · ');
}

function testoLunghezza(p) {
  const km = `${numero(p.lunghezzaKm)} km`;
  return p.ritagliato && !p.lunghezzaDaTag ? t('percorsi.almeno', { km }) : km;
}

/**
 * Pannello "Percorsi".
 * @param {object} s stato dei percorsi (vedi main.js)
 */
export function creaPannelloPercorsi(s, azioni) {
  const campoGpx = el('input', {
    type: 'file',
    accept: '.gpx,application/gpx+xml,application/xml,text/xml',
    multiple: true,
    hidden: true,
    onchange: () => {
      const file = [...campoGpx.files];
      campoGpx.value = '';
      if (file.length) azioni.onImportaGpx(file);
    },
  });

  const visibili = s.percorsi.filter((p) => !s.tipi.length || s.tipi.includes(p.tipo));
  let statoTesto = '';
  if (s.stato === 'carico') statoTesto = s.riserva ? t('percorsi.riserva', { server: s.riserva }) : t('percorsi.carico');
  else if (s.stato === 'errore') statoTesto = t(s.errore);
  else if (s.stato === 'ok') statoTesto = visibili.length ? t('percorsi.trovati', { n: visibili.length, km: s.raggioUsato }) : t('percorsi.nessuno', { km: s.raggioUsato });

  // da dove arrivano i dati, e cosa è successo ai server se qualcosa è andato storto
  const fonte =
    s.stato !== 'ok'
      ? ''
      : s.fonte === 'puglia'
        ? t('percorsi.fontePuglia')
        : s.fonte === 'cache'
          ? t('percorsi.fonteCache', { data: new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(s.salvato) })
          : t('percorsi.fonteOverpass', { server: s.server });
  const dettaglio = s.tentativi?.length
    ? el(
        'details',
        { class: 'dettaglio-server' },
        el('summary', {}, t('percorsi.dettaglio')),
        el('ul', {}, s.tentativi.map((x) => el('li', {}, `${x.server}: ${x.motivo}`))),
      )
    : null;

  const haQualcosa = s.percorsi.length > 0 || s.tracceVisibili.some((id) => s.tracce.some((tr) => tr.id === id));
  return el(
    'div',
    { class: 'percorsi' },
    // Interruttore generale: percorsi e tracce si vedono solo quando lo vuoi
    el(
      'button',
      {
        type: 'button',
        class: 'chip chip-largo',
        'aria-pressed': String(s.visibili),
        disabled: !haQualcosa && !s.visibili,
        onclick: azioni.onVisibili,
      },
      s.visibili ? `👁 ${t('percorsi.visibiliSi')}` : `🚫 ${t('percorsi.visibiliNo')}`,
    ),
    el('p', { class: 'nota' }, t(haQualcosa ? 'percorsi.visibiliNota' : 'percorsi.visibiliVuoto')),
    el('h3', {}, t('percorsi.cerca')),
    el(
      'div',
      { class: 'segmenti', role: 'radiogroup', 'aria-label': t('percorsi.raggio') },
      RAGGI_PERCORSI.map((km) =>
        el('button', { type: 'button', role: 'radio', class: 'segmento', 'aria-checked': String(s.raggioKm === km), onclick: () => azioni.onRaggio(km) }, `${km} km`),
      ),
    ),
    el(
      'div',
      { class: 'chips chips-percorsi' },
      TIPI_PERCORSO.map((tipo) =>
        el(
          'button',
          { type: 'button', class: 'chip', 'aria-pressed': String(s.tipi.includes(tipo)), onclick: () => azioni.onTipo(tipo) },
          el('span', { class: 'linea-tipo', style: `--c:${COLORI_PERCORSO[tipo]}` }),
          t(`percorsi.tipo.${tipo}`),
        ),
      ),
    ),
    el('p', { class: 'nota' }, s.tipi.length ? t('filtri.soloScelti') : t('percorsi.tuttiITipi')),
    el(
      'button',
      { type: 'button', class: 'btn btn-primario btn-largo', disabled: s.stato === 'carico', onclick: azioni.onCercaQui },
      s.stato === 'carico' ? t('percorsi.carico') : t('percorsi.cercaQui'),
    ),
    el('p', { class: 'nota' }, t('percorsi.suggerimento')),
    statoTesto && el('p', { class: 'esito', role: 'status', 'data-tipo': s.stato === 'errore' ? 'errore' : 'info' }, statoTesto),
    fonte && el('p', { class: 'nota' }, fonte),
    dettaglio,
    visibili.length > 0 &&
      el(
        'ul',
        { class: 'elenco-percorsi' },
        visibili
          .slice()
          .sort((a, b) => a.tipo.localeCompare(b.tipo) || titoloPercorso(a).localeCompare(titoloPercorso(b)))
          .map((p) =>
            el(
              'li',
              {},
              el(
                'button',
                { type: 'button', class: 'voce', onclick: () => azioni.onApriPercorso(p) },
                p.simbolo && svgSegnavia(p.simbolo) ? conHtml(svgSegnavia(p.simbolo, 30)) : el('span', { class: 'linea-tipo grande', style: `--c:${COLORI_PERCORSO[p.tipo]}` }),
                el(
                  'span',
                  { class: 'voce-testo' },
                  el('b', {}, titoloPercorso(p)),
                  el('small', {}, [t(`percorsi.tipo.${p.tipo}`), testoLunghezza(p), testoDifficolta(p.difficolta)].filter(Boolean).join(' · ')),
                ),
              ),
            ),
          ),
      ),

    el('h3', {}, t('gpx.titolo')),
    el('p', { class: 'nota' }, t('gpx.spiega')),
    el('button', { type: 'button', class: 'btn btn-largo', onclick: () => campoGpx.click() }, `⬆ ${t('gpx.importa')}`),
    campoGpx,
    s.messaggioGpx && el('p', { class: 'esito', role: 'status', 'data-tipo': s.messaggioGpx.tipo }, s.messaggioGpx.testo),
    s.tracce.length
      ? el(
          'ul',
          { class: 'elenco-percorsi' },
          s.tracce.map((tr) =>
            el(
              'li',
              { class: 'riga-traccia' },
              el(
                'button',
                { type: 'button', class: 'voce', onclick: () => azioni.onApriTraccia(tr) },
                el('span', { class: 'linea-tipo grande traccia', style: `--c:${COLORE_TRACCIA}` }),
                el(
                  'span',
                  { class: 'voce-testo' },
                  el('b', {}, tr.nome),
                  el('small', {}, [`${numero(tr.stats.lunghezzaKm)} km`, tr.stats.salita !== null ? `↑ ${tr.stats.salita} m` : ''].filter(Boolean).join(' · ')),
                ),
              ),
              el(
                'button',
                {
                  type: 'button',
                  class: 'chip chip-occhio',
                  'aria-pressed': String(s.tracceVisibili.includes(tr.id)),
                  'aria-label': t('gpx.mostraSullaMappa'),
                  onclick: () => azioni.onMostraTraccia(tr),
                },
                s.tracceVisibili.includes(tr.id) ? '👁' : '—',
              ),
            ),
          ),
        )
      : el('p', { class: 'vuoto' }, t('gpx.nessuna')),
    el('p', { class: 'nota' }, t('percorsi.attribuzione')),
  );
}

// Elenco "Avvistamenti entro 500 m"
function elencoVicini(vicini) {
  if (!vicini) return null;
  return el(
    'section',
    {},
    el('h3', {}, t('percorsi.vicini', { n: vicini.voci.length })),
    vicini.voci.length
      ? el(
          'ul',
          { class: 'elenco-voci' },
          vicini.voci.slice(0, 40).map((v) =>
            el(
              'li',
              {},
              el(
                'button',
                { type: 'button', class: 'voce', onclick: v.apri },
                iconaPiccola(v.tipo === 'inat' ? htmlOsservazione(v.gruppo) : htmlLuogoEbird(v.specie, v.notevole)),
                el('span', { class: 'voce-testo' }, el('b', {}, v.titolo), el('small', {}, `${v.fonte} · ${Math.round(v.distanzaM)} m`)),
              ),
            ),
          ),
        )
      : el('p', { class: 'nota' }, t('percorsi.nessunVicino')),
    el('p', { class: 'nota' }, t('percorsi.viciniNota')),
  );
}

export function creaSchedaPercorso(p, { vicini, onLuce, onInquadra }) {
  const d = testoDifficolta(p.difficolta);
  return el(
    'article',
    { class: 'scheda scheda-percorso' },
    el(
      'div',
      { class: 'testa-percorso' },
      p.simbolo && svgSegnavia(p.simbolo) ? conHtml(svgSegnavia(p.simbolo, 44)) : el('span', { class: 'linea-tipo grande', style: `--c:${COLORI_PERCORSO[p.tipo]}` }),
      el('span', { class: `etichetta tipo-${p.tipo}` }, t(`percorsi.tipo.${p.tipo}`)),
    ),
    el(
      'dl',
      { class: 'scheda-dati' },
      el('dt', {}, t('percorsi.lunghezza')),
      el('dd', {}, testoLunghezza(p)),
      d && el('dt', {}, t('percorsi.difficolta')),
      d && el('dd', {}, d),
      (p.da || p.a) && el('dt', {}, t('percorsi.daA')),
      (p.da || p.a) && el('dd', {}, [p.da, p.a].filter(Boolean).join(' → ')),
      p.rete && el('dt', {}, t('percorsi.rete')),
      p.rete && el('dd', {}, t(`percorsi.reti.${p.rete}`) === `percorsi.reti.${p.rete}` ? p.rete : t(`percorsi.reti.${p.rete}`)),
    ),
    p.ritagliato && el('p', { class: 'nota' }, t('percorsi.ritagliato')),
    p.descrizione && el('p', {}, p.descrizione),
    d && el('p', { class: 'nota' }, t('percorsi.scale')),
    elencoVicini(vicini),
    el(
      'div',
      { class: 'scheda-azioni' },
      el('button', { type: 'button', class: 'btn btn-primario', onclick: onInquadra }, t('percorsi.inquadra')),
      el('a', { class: 'btn', href: p.link, target: '_blank', rel: 'noopener' }, t('percorsi.apriOsm')),
      p.sitoWeb && /^https?:\/\//.test(p.sitoWeb) && el('a', { class: 'btn', href: p.sitoWeb, target: '_blank', rel: 'noopener' }, t('percorsi.sito')),
      el('button', { type: 'button', class: 'btn', onclick: onLuce }, t('scheda.luceMeteo')),
    ),
  );
}

// Profilo altimetrico: area sotto la curva, quote minima e massima
export function svgProfilo(profilo) {
  if (profilo.length < 2) return '';
  const L = 320;
  const H = 90;
  const kmMax = profilo[profilo.length - 1][0] || 1;
  const qMin = Math.min(...profilo.map((p) => p[1]));
  const qMax = Math.max(...profilo.map((p) => p[1]));
  const ampiezza = Math.max(qMax - qMin, 20);
  // al massimo ~300 punti, per tenere leggero il disegno
  const passo = Math.max(1, Math.floor(profilo.length / 300));
  const punti = profilo
    .filter((_, i) => i % passo === 0 || i === profilo.length - 1)
    .map(([km, q]) => `${((km / kmMax) * L).toFixed(1)},${(H - ((q - qMin) / ampiezza) * (H - 8) - 4).toFixed(1)}`);
  return `<svg class="profilo" viewBox="0 0 ${L} ${H}" preserveAspectRatio="none" role="img" aria-label="${t('gpx.profilo')}">
    <polygon points="0,${H} ${punti.join(' ')} ${L},${H}" fill="rgb(61 122 79 / 0.25)"/>
    <polyline points="${punti.join(' ')}" fill="none" stroke="#275936" stroke-width="2" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

export function creaSchedaTraccia(tr, { vicini, onInquadra, onRinomina, onElimina, onLuce }) {
  const st = tr.stats;
  const profilo = el('div', { class: 'profilo-contenitore' });
  profilo.innerHTML = svgProfilo(st.profilo); // SVG generato da noi
  return el(
    'article',
    { class: 'scheda' },
    el(
      'dl',
      { class: 'scheda-dati' },
      el('dt', {}, t('percorsi.lunghezza')),
      el('dd', {}, `${numero(st.lunghezzaKm)} km`),
      st.salita !== null && el('dt', {}, t('gpx.dislivello')),
      st.salita !== null && el('dd', {}, `↑ ${numero(st.salita, 0)} m · ↓ ${numero(st.discesa, 0)} m`),
      st.quotaMin !== null && el('dt', {}, t('gpx.quote')),
      st.quotaMin !== null && el('dd', {}, `${numero(st.quotaMin, 0)}–${numero(st.quotaMax, 0)} m`),
    ),
    st.profilo.length > 1
      ? el('figure', { class: 'grafico' }, el('figcaption', {}, el('b', {}, t('gpx.profilo'))), profilo)
      : el('p', { class: 'nota' }, t('gpx.senzaQuote')),
    elencoVicini(vicini),
    el(
      'div',
      { class: 'scheda-azioni' },
      el('button', { type: 'button', class: 'btn btn-primario', onclick: onInquadra }, t('percorsi.inquadra')),
      el('button', { type: 'button', class: 'btn', onclick: onLuce }, t('scheda.luceMeteo')),
      el('button', { type: 'button', class: 'btn', onclick: onRinomina }, t('gpx.rinomina')),
    ),
    el('p', { class: 'nota' }, t('gpx.privata')),
    el('button', { type: 'button', class: 'link-btn link-pericolo', onclick: onElimina }, t('gpx.elimina')),
  );
}

// Più percorsi nello stesso punto: elenco per scegliere quale aprire
export function creaSceltaPercorso(elenco, { onPercorso, onTraccia }) {
  return el(
    'ul',
    { class: 'elenco-percorsi' },
    elenco.map(({ dati, tipo }) =>
      el(
        'li',
        {},
        el(
          'button',
          { type: 'button', class: 'voce', onclick: () => (tipo === 'traccia' ? onTraccia(dati) : onPercorso(dati)) },
          tipo === 'traccia'
            ? el('span', { class: 'linea-tipo grande traccia', style: `--c:${COLORE_TRACCIA}` })
            : dati.simbolo && svgSegnavia(dati.simbolo)
              ? conHtml(svgSegnavia(dati.simbolo, 30))
              : el('span', { class: 'linea-tipo grande', style: `--c:${COLORI_PERCORSO[dati.tipo]}` }),
          el(
            'span',
            { class: 'voce-testo' },
            el('b', {}, tipo === 'traccia' ? dati.nome : titoloPercorso(dati)),
            el('small', {}, tipo === 'traccia' ? t('gpx.traccia') : [t(`percorsi.tipo.${dati.tipo}`), testoLunghezza(dati), testoDifficolta(dati.difficolta)].filter(Boolean).join(' · ')),
          ),
        ),
      ),
    ),
  );
}

// Menu del tocco prolungato su un punto della mappa
export function creaMenuPunto({ lat, lng }, { onSpot, onPercorsi, onLuce }) {
  return el(
    'div',
    { class: 'menu-punto' },
    el('p', { class: 'nota' }, `${lat.toFixed(5)}, ${lng.toFixed(5)}`),
    el('button', { type: 'button', class: 'btn btn-largo', onclick: onPercorsi }, `🥾 ${t('percorsi.percorsiQui')}`),
    el('button', { type: 'button', class: 'btn btn-largo', onclick: onSpot }, `📍 ${t('menu.nuovoSpot')}`),
    el('button', { type: 'button', class: 'btn btn-largo', onclick: onLuce }, `☀ ${t('scheda.luceMeteo')}`),
  );
}
