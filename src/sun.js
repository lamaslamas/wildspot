// Calcoli sul sole con SunCalc: orari della giornata, posizione e "fase" della luce.
//
// Definizioni usate (le più comuni tra i fotografi), in base all'altezza del sole:
// - ora blu:    tra -6° e -4° (prima dell'alba e dopo il tramonto)
// - ora dorata: tra -4° e +6°
// SunCalc conosce già -6° (dawn/dusk) e +6° (goldenHourEnd/goldenHour);
// aggiungiamo il passaggio a -4°.

import { getTimes, getPosition, addTime, getMoonIllumination, getMoonTimes } from 'suncalc';

addTime(-4, 'bluFineMattina', 'bluInizioSera');

/**
 * Orari notevoli del giorno per un punto. I valori possono essere `null`
 * (per esempio vicino ai poli, dove il sole non sorge o non tramonta).
 */
export function orariDelGiorno(data, lat, lng) {
  // Passiamo il fuso orario del telefono, così SunCalc usa il giorno civile scelto
  const mezzogiorno = new Date(data);
  mezzogiorno.setHours(12, 0, 0, 0);
  const o = getTimes(mezzogiorno, lat, lng, 0, -mezzogiorno.getTimezoneOffset());
  const valido = (d) => d || null; // SunCalc dà null quando un orario non esiste
  return {
    alba: valido(o.sunrise),
    tramonto: valido(o.sunset),
    mezzogiornoSolare: valido(o.solarNoon),
    bluMattina: [valido(o.dawn), valido(o.bluFineMattina)],
    dorataMattina: [valido(o.bluFineMattina), valido(o.goldenHourEnd)],
    dorataSera: [valido(o.goldenHour), valido(o.bluInizioSera)],
    bluSera: [valido(o.bluInizioSera), valido(o.dusk)],
  };
}

/**
 * Posizione del sole in un istante.
 * @returns {{altezza: number, azimut: number}} gradi; azimut come bussola (0 = nord, 90 = est)
 */
export function posizioneSole(data, lat, lng) {
  // SunCalc 2 dà già i gradi, con l'azimut misurato da nord in senso orario
  const p = getPosition(data, lat, lng);
  return { altezza: p.altitude, azimut: p.azimuth };
}

// Fase della luce in base all'altezza del sole
export function faseLuce(altezza) {
  if (altezza < -6) return 'notte';
  if (altezza < -4) return 'blu';
  if (altezza < 6) return 'dorata';
  return 'giorno';
}

// Colori delle fasi: usati per la barra del cursore orario
export const COLORI_FASI = {
  notte: '#1c2541',
  blu: '#3a5a98',
  dorata: '#e8a21a',
  giorno: '#9fd0e8',
};

/**
 * Sfondo a gradiente per una barra che rappresenta le 24 ore del giorno:
 * campioniamo l'altezza del sole ogni 10 minuti e coloriamo per fase.
 */
export function gradienteGiornata(data, lat, lng) {
  const inizio = new Date(data);
  inizio.setHours(0, 0, 0, 0);
  const passi = 144; // 24 ore × 6
  const tappe = [];
  let faseCorrente = null;
  for (let i = 0; i <= passi; i++) {
    const istante = new Date(inizio.getTime() + i * 10 * 60 * 1000);
    const fase = faseLuce(posizioneSole(istante, lat, lng).altezza);
    if (fase !== faseCorrente) {
      const percento = ((i / passi) * 100).toFixed(2);
      if (faseCorrente) tappe.push(`${COLORI_FASI[faseCorrente]} ${percento}%`);
      tappe.push(`${COLORI_FASI[fase]} ${percento}%`);
      faseCorrente = fase;
    }
  }
  tappe.push(`${COLORI_FASI[faseCorrente]} 100%`);
  return `linear-gradient(90deg, ${tappe.join(', ')})`;
}

// Punto cardinale (a 8 direzioni) da un azimut in gradi
const DIREZIONI = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function puntoCardinale(azimut) {
  return DIREZIONI[Math.round(azimut / 45) % 8];
}

// --- Luna

// Nomi delle fasi (chiavi di traduzione) in base alla fase SunCalc (0 → 1)
function nomeFase(fase) {
  if (fase < 0.03 || fase > 0.97) return 'nuova';
  if (fase < 0.22) return 'crescente';
  if (fase < 0.28) return 'primoQuarto';
  if (fase < 0.47) return 'gibbosaCrescente';
  if (fase < 0.53) return 'piena';
  if (fase < 0.72) return 'gibbosaCalante';
  if (fase < 0.78) return 'ultimoQuarto';
  return 'calante';
}

/**
 * Luna nel giorno scelto: fase, percentuale illuminata, sorgere e tramonto.
 * Utile per notturni e paesaggi (luna piena = notti chiare, luna nuova = cielo buio).
 */
export function lunaDelGiorno(data, lat, lng) {
  const mezzogiorno = new Date(data);
  mezzogiorno.setHours(12, 0, 0, 0);
  const illuminazione = getMoonIllumination(mezzogiorno);
  const orari = getMoonTimes(mezzogiorno, lat, lng, -mezzogiorno.getTimezoneOffset());
  return {
    fase: nomeFase(illuminazione.phase),
    valoreFase: illuminazione.phase,
    illuminata: Math.round(illuminazione.fraction * 100),
    sorge: orari.rise || null,
    tramonta: orari.set || null,
    sempreSopra: Boolean(orari.alwaysUp),
    sempreSotto: Boolean(orari.alwaysDown),
  };
}

// Disegno SVG della fase lunare: disco scuro con la parte illuminata
export function svgLuna(valoreFase, lato = 40) {
  const r = 18;
  const k = Math.cos(valoreFase * 2 * Math.PI); // 1 nuova, -1 piena
  const crescente = valoreFase < 0.5;
  // bordo esterno illuminato (semicerchio) + terminatore (ellisse con raggio x = |k|·r)
  const sweepEsterno = crescente ? 1 : 0;
  const sweepTerminatore = (k > 0) === crescente ? 0 : 1;
  const d = `M20 2 A${r} ${r} 0 0 ${sweepEsterno} 20 38 A${Math.abs(k) * r} ${r} 0 0 ${sweepTerminatore} 20 2Z`;
  return `<svg viewBox="0 0 40 40" width="${lato}" height="${lato}" aria-hidden="true"><circle cx="20" cy="20" r="${r}" fill="#2b3245"/><path d="${d}" fill="#f4e9c8"/></svg>`;
}
