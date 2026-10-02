// "Quando andare": valuta le ore dorate dei prossimi giorni in un punto,
// incrociando le previsioni orarie di Open-Meteo con gli orari del sole.
//
// Punteggio da 0 a 100 per ogni finestra (ora dorata del mattino e della sera):
// - pioggia: la penalità più forte
// - nuvole: cielo sereno o poco nuvoloso va bene (un po' di nuvole rende il
//   cielo più interessante); coperto toglie la luce calda; le nuvole basse
//   all'orizzonte la bloccano del tutto
// - vento: oltre 20–25 km/h gli animali si riparano e il teleobiettivo vibra
// - visibilità: foschia leggera tollerata, nebbia fitta penalizzata

import { fetchJsonConCache } from './cache.js';
import { orariDelGiorno, posizioneSole } from './sun.js';
import { dataIso } from './weather.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const GIORNI = 7;

async function previsioniOrarie({ lat, lng }, signal) {
  const p = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lng.toFixed(2),
    hourly: 'cloud_cover,cloud_cover_low,precipitation_probability,wind_speed_10m,visibility,weather_code',
    forecast_days: GIORNI,
    timezone: 'auto',
  });
  const d = await fetchJsonConCache(`${API}?${p}`, { signal });
  const h = d.hourly;
  // indice per "AAAA-MM-GGThh" -> dati di quell'ora (ora locale del luogo)
  const perOra = new Map();
  h.time.forEach((t, i) =>
    perOra.set(t.slice(0, 13), {
      nuvole: h.cloud_cover[i],
      nuvoleBasse: h.cloud_cover_low[i],
      pioggia: h.precipitation_probability[i] ?? 0,
      vento: h.wind_speed_10m[i],
      visibilita: h.visibility[i],
      codice: h.weather_code[i],
    }),
  );
  return perOra;
}

const chiaveOra = (d) => `${dataIso(d)}T${String(d.getHours()).padStart(2, '0')}`;

// Media dei valori meteo nelle ore toccate dalla finestra
function meteoFinestra(perOra, inizio, fine) {
  const ore = [];
  for (let t = new Date(inizio); t < fine; t = new Date(t.getTime() + 30 * 60 * 1000)) {
    const v = perOra.get(chiaveOra(t));
    if (v) ore.push(v);
  }
  if (!ore.length) return null;
  const media = (k) => ore.reduce((a, o) => a + (o[k] ?? 0), 0) / ore.length;
  return {
    nuvole: media('nuvole'),
    nuvoleBasse: media('nuvoleBasse'),
    pioggia: Math.max(...ore.map((o) => o.pioggia ?? 0)),
    vento: media('vento'),
    visibilita: Math.min(...ore.map((o) => o.visibilita ?? 50000)),
    codice: ore[Math.floor(ore.length / 2)].codice,
  };
}

function punteggio(m) {
  let s = 100;
  const motivi = [];
  if (m.pioggia >= 60) { s -= 60; motivi.push('pioggia'); }
  else if (m.pioggia >= 30) { s -= 30; motivi.push('pioggiaForse'); }
  if (m.nuvole >= 85) { s -= 50; motivi.push('coperto'); }
  else if (m.nuvole >= 60) { s -= 25; motivi.push('nuvoloso'); }
  else if (m.nuvole >= 15) motivi.push('nuvoleBelle');
  else motivi.push('sereno');
  if (m.nuvoleBasse >= 60) { s -= 15; motivi.push('nuvoleBasse'); }
  if (m.vento >= 30) { s -= 25; motivi.push('ventoForte'); }
  else if (m.vento >= 20) { s -= 10; motivi.push('vento'); }
  if (m.visibilita < 1000) { s -= 20; motivi.push('nebbia'); }
  else if (m.visibilita < 5000) { s -= 5; motivi.push('foschia'); }
  return { valore: Math.max(0, Math.min(100, s)), motivi };
}

export function giudizio(valore) {
  if (valore >= 80) return 'ottima';
  if (valore >= 60) return 'buona';
  if (valore >= 40) return 'discreta';
  return 'scarsa';
}

/**
 * Finestre di ora dorata dei prossimi giorni, in ordine di tempo.
 * @returns {Promise<Array<{inizio:Date, fine:Date, momento:'mattina'|'sera', azimut:number,
 *   meteo:object, valore:number, motivi:string[]}>>}
 */
export async function migliori(punto, signal) {
  const perOra = await previsioniOrarie(punto, signal);
  const adesso = new Date();
  const finestre = [];
  for (let g = 0; g < GIORNI; g++) {
    const giorno = new Date();
    giorno.setDate(giorno.getDate() + g);
    const o = orariDelGiorno(giorno, punto.lat, punto.lng);
    for (const [momento, [inizio, fine]] of [['mattina', o.dorataMattina], ['sera', o.dorataSera]]) {
      if (!inizio || !fine || fine < adesso) continue;
      const meteo = meteoFinestra(perOra, inizio, fine);
      if (!meteo) continue;
      const centro = new Date((inizio.getTime() + fine.getTime()) / 2);
      finestre.push({
        inizio,
        fine,
        momento,
        azimut: posizioneSole(centro, punto.lat, punto.lng).azimut,
        meteo,
        ...punteggio(meteo),
      });
    }
  }
  return finestre;
}
