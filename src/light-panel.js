// Pannello "Luce e meteo" per un punto della mappa:
// data, cursore orario, posizione del sole, orari di alba/tramonto/ora dorata/ora blu
// e previsioni ora per ora da Open-Meteo.

import { el } from './dom.js';
import { t, locale } from './i18n.js';
import { orariDelGiorno, posizioneSole, faseLuce, gradienteGiornata, puntoCardinale, lunaDelGiorno, svgLuna } from './sun.js';
import { meteoOrario, descriviCodice, dataIso } from './weather.js';

const MINUTI_GIORNO = 24 * 60;

function mezzanotte(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function stessoGiorno(a, b) {
  return dataIso(a) === dataIso(b);
}

/**
 * @param {object} opzioni
 * @param {{lat:number,lng:number}} opzioni.punto
 * @param {(stato: object) => void} opzioni.onSole  chiamata a ogni cambio, per aggiornare la mappa
 * @param {(punto) => void} [opzioni.onSalvaSpot]  salva il punto nel diario
 * @returns {{elemento: HTMLElement, impostaPunto: (punto) => void}}
 */
export function creaPannelloLuce({ punto, onSole, onSalvaSpot }) {
  const ora = new Date();
  const stato = {
    punto,
    data: mezzanotte(ora),
    minuti: ora.getHours() * 60 + ora.getMinutes(),
  };

  const formatoOra = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });
  const hhmm = (d) => (d ? formatoOra.format(d) : '—');
  const intervallo = ([a, b]) => (a && b ? `${hhmm(a)}–${hhmm(b)}` : '—');

  function istante() {
    return new Date(stato.data.getTime() + stato.minuti * 60 * 1000);
  }

  // --- Data
  const campoData = el('input', {
    type: 'date',
    class: 'campo campo-data',
    'aria-label': t('luce.data'),
    onchange: () => {
      if (!campoData.value) return;
      const [a, m, g] = campoData.value.split('-').map(Number);
      cambiaData(new Date(a, m - 1, g));
    },
  });
  const btnPrima = el('button', { type: 'button', class: 'btn btn-icona', 'aria-label': t('luce.giornoPrima'), onclick: () => spostaGiorno(-1) }, '‹');
  const btnDopo = el('button', { type: 'button', class: 'btn btn-icona', 'aria-label': t('luce.giornoDopo'), onclick: () => spostaGiorno(1) }, '›');
  const btnOggi = el('button', { type: 'button', class: 'btn', onclick: () => cambiaData(mezzanotte(new Date())) }, t('luce.oggi'));

  function spostaGiorno(delta) {
    const d = new Date(stato.data);
    d.setDate(d.getDate() + delta);
    cambiaData(d);
  }

  function cambiaData(d) {
    stato.data = mezzanotte(d);
    aggiornaTutto();
  }

  // --- Ora scelta e cursore
  const elOra = el('span', { class: 'luce-ora' });
  const elFase = el('span', { class: 'etichetta' });
  const elSole = el('p', { class: 'luce-sole' });
  const cursore = el('input', {
    type: 'range',
    class: 'cursore-ora',
    min: 0,
    max: MINUTI_GIORNO - 5,
    step: 5,
    'aria-label': t('luce.ora'),
    oninput: () => {
      stato.minuti = Number(cursore.value);
      aggiornaOra();
    },
  });
  const tacche = el('div', { class: 'tacche' }, ['0', '6', '12', '18', '24'].map((h) => el('span', {}, h)));

  // --- Orari del giorno
  const griglia = el('dl', { class: 'orari' });
  const elLuna = el('div', { class: 'luna' });

  // --- Meteo
  const meteo = el('div', { class: 'meteo' });
  let richiestaMeteo = null;

  // --- Punto
  const elCoordinate = el('span', {});

  function aggiornaOra() {
    const { lat, lng } = stato.punto;
    const quando = istante();
    const sole = posizioneSole(quando, lat, lng);
    const fase = faseLuce(sole.altezza);

    cursore.value = stato.minuti;
    elOra.textContent = hhmm(quando);
    elFase.textContent = t(`fase.${fase}`);
    elFase.className = `etichetta fase-${fase}`;
    elSole.textContent =
      sole.altezza > 0
        ? t('luce.posizione', {
            altezza: Math.round(sole.altezza),
            azimut: Math.round(sole.azimut),
            cardinale: t(`cardinale.${puntoCardinale(sole.azimut)}`),
          })
        : t('luce.sottoOrizzonte');

    // Ora del meteo corrispondente evidenziata e portata in vista
    const oraIntera = Math.floor(stato.minuti / 60);
    for (const scheda of meteo.querySelectorAll('.ora-meteo')) {
      scheda.classList.toggle('attiva', Number(scheda.dataset.ora) === oraIntera);
    }
    mostraOraAttiva();

    const orari = orariDelGiorno(stato.data, lat, lng);
    onSole({
      latlng: [lat, lng],
      sole,
      azimutAlba: orari.alba ? posizioneSole(orari.alba, lat, lng).azimut : null,
      azimutTramonto: orari.tramonto ? posizioneSole(orari.tramonto, lat, lng).azimut : null,
      testi: { alba: t('luce.alba'), tramonto: t('luce.tramonto') },
    });
  }

  // Scorre la striscia del meteo (solo in orizzontale) fino all'ora scelta
  function mostraOraAttiva() {
    const striscia = meteo.querySelector('.striscia-meteo');
    const attiva = striscia?.querySelector('.attiva');
    if (!attiva) return;
    striscia.scrollLeft = attiva.offsetLeft - striscia.offsetLeft - striscia.clientWidth / 2 + attiva.clientWidth / 2;
  }

  function aggiornaGiorno() {
    const { lat, lng } = stato.punto;
    campoData.value = dataIso(stato.data);
    btnOggi.hidden = stessoGiorno(stato.data, new Date());
    cursore.style.setProperty('--sfondo-cursore', gradienteGiornata(stato.data, lat, lng));
    elCoordinate.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const o = orariDelGiorno(stato.data, lat, lng);
    const riga = (chiave, valore, classe) => [
      el('dt', {}, el('span', { class: `pallino ${classe}` }), t(chiave)),
      el('dd', {}, valore),
    ];
    griglia.replaceChildren(
      ...riga('luce.alba', hhmm(o.alba), 'fase-alba'),
      ...riga('luce.tramonto', hhmm(o.tramonto), 'fase-alba'),
      ...riga('luce.dorataMattina', intervallo(o.dorataMattina), 'fase-dorata'),
      ...riga('luce.dorataSera', intervallo(o.dorataSera), 'fase-dorata'),
      ...riga('luce.bluMattina', intervallo(o.bluMattina), 'fase-blu'),
      ...riga('luce.bluSera', intervallo(o.bluSera), 'fase-blu'),
    );

    // Luna
    const luna = lunaDelGiorno(stato.data, lat, lng);
    const disco = el('span', { class: 'luna-disco' });
    disco.innerHTML = svgLuna(luna.valoreFase, 44); // SVG generato da noi
    const orariLuna = luna.sempreSopra
      ? t('luna.sempreSopra')
      : luna.sempreSotto
        ? t('luna.sempreSotto')
        : t('luna.orari', { sorge: hhmm(luna.sorge), tramonta: hhmm(luna.tramonta) });
    elLuna.replaceChildren(
      disco,
      el(
        'span',
        { class: 'luna-testo' },
        el('b', {}, `${t(`luna.${luna.fase}`)} · ${luna.illuminata}%`),
        el('small', {}, orariLuna),
      ),
    );
  }

  async function aggiornaMeteo() {
    richiestaMeteo?.abort();
    const controller = new AbortController();
    richiestaMeteo = controller;
    const { lat, lng } = stato.punto;
    meteo.replaceChildren(el('p', { class: 'nota' }, t('meteo.carico')));

    try {
      const ore = await meteoOrario({ lat, lng, data: stato.data }, controller.signal);
      if (controller.signal.aborted) return;
      // Oggi partiamo dall'ora attuale; negli altri giorni mostriamo tutte le ore
      const oggi = stessoGiorno(stato.data, new Date());
      const daOra = oggi ? new Date().getHours() : 0;
      const visibili = ore.filter((o) => o.ora >= daOra);

      const striscia = el(
        'div',
        { class: 'striscia-meteo' },
        visibili.map((o) => {
          const { icona, chiave } = descriviCodice(o.codice, o.giorno);
          // L'ora è "dorata" se a metà ora il sole è nella fascia dell'ora dorata
          const metaOra = new Date(stato.data.getTime() + (o.ora * 60 + 30) * 60 * 1000);
          const dorata = faseLuce(posizioneSole(metaOra, lat, lng).altezza) === 'dorata';
          return el(
            'button',
            {
              type: 'button',
              class: `ora-meteo${dorata ? ' dorata' : ''}`,
              'data-ora': o.ora,
              title: t(chiave),
              onclick: () => {
                stato.minuti = o.ora * 60;
                aggiornaOra();
              },
            },
            el('span', { class: 'om-ora' }, `${String(o.ora).padStart(2, '0')}:00`),
            el('span', { class: 'om-icona', 'aria-label': t(chiave) }, icona),
            el('span', { class: 'om-temp' }, `${Math.round(o.temperatura)}°`),
            el('span', { class: 'om-dato' }, `☁ ${o.nuvole}%`),
            el('span', { class: 'om-dato' }, `💧 ${o.probPioggia ?? 0}%`),
            el(
              'span',
              { class: 'om-dato' },
              // la freccia indica dove soffia il vento (opposto alla provenienza)
              el('span', { class: 'freccia-vento', style: `transform: rotate(${o.direzioneVento + 180}deg)` }, '↑'),
              ` ${Math.round(o.vento)}`,
            ),
            el('span', { class: 'om-dato' }, `👁 ${Math.round(o.visibilita / 1000)} km`),
          );
        }),
      );
      meteo.replaceChildren(
        striscia,
        el('p', { class: 'nota legenda-meteo' }, t('meteo.legenda')),
      );
      aggiornaOra();
    } catch (err) {
      if (err.name === 'AbortError') return;
      meteo.replaceChildren(el('p', { class: 'nota' }, t(err.fuoriPeriodo ? 'meteo.fuoriPeriodo' : 'meteo.errore')));
    }
  }

  function aggiornaTutto() {
    aggiornaGiorno();
    aggiornaOra();
    aggiornaMeteo();
  }

  const elemento = el(
    'div',
    { class: 'luce' },
    el('div', { class: 'riga-data' }, btnPrima, campoData, btnDopo, btnOggi),
    el('div', { class: 'luce-adesso' }, elOra, elFase),
    elSole,
    cursore,
    tacche,
    griglia,
    elLuna,
    el('h3', {}, t('meteo.titolo')),
    meteo,
    el(
      'p',
      { class: 'nota' },
      t('luce.punto'), ' ', elCoordinate, '. ', t('luce.spostaPunto'),
    ),
    onSalvaSpot &&
      el('button', { type: 'button', class: 'btn btn-largo', onclick: () => onSalvaSpot({ ...stato.punto }) }, t('spot.salvaCome')),
    el(
      'p',
      { class: 'nota' },
      el('a', { href: 'https://open-meteo.com/', target: '_blank', rel: 'noopener' }, t('meteo.attribuzione')),
    ),
  );

  aggiornaTutto();

  return {
    elemento,
    punto: () => stato.punto,
    impostaPunto(nuovo) {
      stato.punto = nuovo;
      aggiornaGiorno();
      aggiornaOra();
      aggiornaMeteo();
    },
  };
}
