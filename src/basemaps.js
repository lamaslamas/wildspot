// Sfondi della mappa (stradale, topografica, satellitare) e livello delle
// aree protette (Natura 2000 e aree nazionali, dall'Agenzia europea dell'ambiente).

import L from './leaflet-global.js';
import { leggi, scrivi } from './storage.js';

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const SFONDI = {
  stradale: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opzioni: { maxZoom: 19, attribution: OSM },
  },
  // Curve di livello, sentieri e rilievo: utile per capire dove appostarsi
  topografica: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    opzioni: {
      maxZoom: 17,
      subdomains: 'abc',
      attribution: `${OSM}, SRTM | <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
    },
  },
  satellitare: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opzioni: { maxZoom: 19, attribution: 'Immagini &copy; Esri, Maxar, Earthstar Geographics' },
  },
};

const EEA = 'https://bio.discomap.eea.europa.eu/arcgis';
const SERVIZI_AREE = {
  natura2000: 'ProtectedSites/Natura2000Sites/MapServer',
  nazionali: 'ProtectedSites/CDDA_Dyna_WM/MapServer',
};

export function creaSfondi(mappa) {
  let sfondo = leggi('sfondo', 'stradale');
  if (!SFONDI[sfondo]) sfondo = 'stradale';
  let livelloSfondo = null;
  let areeAccese = leggi('areeProtette', false);

  // Pannello per le aree: sopra lo sfondo e la heatmap, sotto gli indicatori
  mappa.createPane('aree').style.zIndex = 320;
  const aree = L.layerGroup([
    L.tileLayer.wms(`${EEA}/services/${SERVIZI_AREE.nazionali}/WMSServer`, {
      pane: 'aree', layers: '1', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.6,
    }),
    L.tileLayer.wms(`${EEA}/services/${SERVIZI_AREE.natura2000}/WMSServer`, {
      pane: 'aree', layers: '0,1', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.7,
      attribution: 'Aree protette &copy; <a href="https://www.eea.europa.eu">EEA</a>',
    }),
  ]);

  function impostaSfondo(id) {
    sfondo = SFONDI[id] ? id : 'stradale';
    scrivi('sfondo', sfondo);
    livelloSfondo?.remove();
    const { url, opzioni } = SFONDI[sfondo];
    livelloSfondo = L.tileLayer(url, opzioni).addTo(mappa);
    document.documentElement.dataset.sfondo = sfondo; // per adattare i colori sopra al satellite
  }

  function impostaAree(accese) {
    areeAccese = accese;
    scrivi('areeProtette', accese);
    if (accese) aree.addTo(mappa);
    else aree.remove();
  }

  impostaSfondo(sfondo);
  impostaAree(areeAccese);

  return {
    impostaSfondo,
    impostaAree,
    sfondo: () => sfondo,
    areeAccese: () => areeAccese,
  };
}

/**
 * Aree protette nel punto toccato. Restituisce un elenco senza doppioni:
 * [{ nome, tipo: 'ZSC'|'ZPS'|'parco', codice?, iucn? }]
 */
export async function areeNelPunto({ lat, lng }, mappa) {
  const b = mappa.getBounds();
  const dim = mappa.getSize();
  const comuni = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    tolerance: '2',
    mapExtent: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','),
    imageDisplay: `${dim.x},${dim.y},96`,
    returnGeometry: 'false',
    f: 'json',
  });
  const [n2000, naz] = await Promise.allSettled([
    fetch(`${EEA}/rest/services/${SERVIZI_AREE.natura2000}/identify?${comuni}&layers=all:0,1`).then((r) => r.json()),
    fetch(`${EEA}/rest/services/${SERVIZI_AREE.nazionali}/identify?${comuni}&layers=all:1`).then((r) => r.json()),
  ]);
  const trovate = new Map();
  if (n2000.status === 'fulfilled') {
    for (const r of n2000.value.results || []) {
      const a = r.attributes;
      // layer 1 = Direttiva Uccelli (ZPS); layer 0 = Direttiva Habitat (ZSC/SIC)
      const tipo = r.layerId === 1 ? 'ZPS' : 'ZSC';
      trovate.set(`${a.SITECODE}-${tipo}`, { nome: a.SITENAME, tipo, codice: a.SITECODE });
    }
  }
  if (naz.status === 'fulfilled') {
    for (const r of naz.value.results || []) {
      const a = r.attributes;
      if (a.siteName) trovate.set(`naz-${a.siteName}`, { nome: a.siteName, tipo: 'parco', iucn: a.iucnDescri || '' });
    }
  }
  if (n2000.status === 'rejected' && naz.status === 'rejected') throw new Error('rete');
  return [...trovate.values()];
}
