// Previsioni orarie da Open-Meteo (nessuna chiave richiesta).
// Documentazione: https://open-meteo.com/en/docs
// Licenza dei dati: CC BY 4.0, attribuzione "Weather data by Open-Meteo.com".

import { fetchJsonConCache } from './cache.js';

const API = 'https://api.open-meteo.com/v1/forecast';

const VARIABILI = [
  'temperature_2m',
  'weather_code',
  'cloud_cover',
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'visibility',
  'is_day',
];

// Data locale nel formato AAAA-MM-GG
export function dataIso(data) {
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const gg = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mm}-${gg}`;
}

/**
 * Meteo ora per ora di un giorno in un punto.
 * Gli orari sono nel fuso del luogo (timezone=auto).
 * Se la data è fuori dal periodo coperto, l'errore ha `fuoriPeriodo = true`.
 * @returns {Promise<object[]>} una voce per ora
 */
export async function meteoOrario({ lat, lng, data }, signal) {
  const giorno = dataIso(data);
  const parametri = new URLSearchParams({
    // due decimali (~1 km) bastano e permettono alla cache di riutilizzare le risposte
    latitude: lat.toFixed(2),
    longitude: lng.toFixed(2),
    hourly: VARIABILI.join(','),
    timezone: 'auto',
    start_date: giorno,
    end_date: giorno,
  });
  let dati;
  try {
    dati = await fetchJsonConCache(`${API}?${parametri}`, { signal });
  } catch (err) {
    // Open-Meteo risponde 400 quando la data è fuori dal periodo disponibile
    if (err.status === 400) err.fuoriPeriodo = true;
    throw err;
  }
  const h = dati.hourly;
  return h.time.map((ora, i) => ({
    ora: Number(ora.slice(11, 13)), // "2026-10-02T08:00" -> 8
    temperatura: h.temperature_2m[i],
    codice: h.weather_code[i],
    nuvole: h.cloud_cover[i],
    probPioggia: h.precipitation_probability[i],
    pioggia: h.precipitation[i],
    vento: h.wind_speed_10m[i],
    raffiche: h.wind_gusts_10m[i],
    direzioneVento: h.wind_direction_10m[i],
    visibilita: h.visibility[i],
    giorno: h.is_day[i] === 1,
  }));
}

// Icona e chiave di traduzione per i codici meteo WMO
export function descriviCodice(codice, giorno = true) {
  if (codice === 0) return { icona: giorno ? '☀️' : '🌙', chiave: 'meteo.sereno' };
  if (codice === 1) return { icona: giorno ? '🌤️' : '🌙', chiave: 'meteo.poco' };
  if (codice === 2) return { icona: '⛅', chiave: 'meteo.parziale' };
  if (codice === 3) return { icona: '☁️', chiave: 'meteo.coperto' };
  if (codice === 45 || codice === 48) return { icona: '🌫️', chiave: 'meteo.nebbia' };
  if (codice >= 51 && codice <= 57) return { icona: '🌦️', chiave: 'meteo.pioviggine' };
  if ((codice >= 61 && codice <= 67) || (codice >= 80 && codice <= 82)) return { icona: '🌧️', chiave: 'meteo.pioggia' };
  if ((codice >= 71 && codice <= 77) || codice === 85 || codice === 86) return { icona: '🌨️', chiave: 'meteo.neve' };
  if (codice >= 95) return { icona: '⛈️', chiave: 'meteo.temporale' };
  return { icona: '·', chiave: 'meteo.sconosciuto' };
}
