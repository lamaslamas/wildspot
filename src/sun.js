// Calcoli sul sole con SunCalc: orari della giornata, posizione e "fase" della luce.
//
// Definizioni usate (le più comuni tra i fotografi), in base all'altezza del sole:
// - ora blu:    tra -6° e -4° (prima dell'alba e dopo il tramonto)
// - ora dorata: tra -4° e +6°
// SunCalc conosce già -6° (dawn/dusk) e +6° (goldenHourEnd/goldenHour);
// aggiungiamo il passaggio a -4°.

import { getTimes, getPosition, addTime } from 'suncalc';

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
