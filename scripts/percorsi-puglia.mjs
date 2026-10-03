#!/usr/bin/env node
// Genera public/data/percorsi-puglia.geojson: tutti i percorsi escursionistici,
// MTB e bici della Puglia da OpenStreetMap. Da eseguire a mano, non nell'app:
//
//   npm run percorsi:puglia            (usa l'estratto scaricato se ha meno di 7 giorni)
//   npm run percorsi:puglia -- --forza (scarica di nuovo l'estratto)
//
// Requisiti: Node 20+ e osmium-tool (https://osmcode.org/osmium-tool/)
//   macOS:  brew install osmium-tool
//   Linux:  sudo apt install osmium-tool
//
// Passi:
// 1. scarica da Geofabrik l'estratto del Sud Italia (Geofabrik non ha la sola Puglia)
// 2. ritaglia il riquadro della Puglia (osmium extract)
// 3. ricava il confine regionale, relazione OSM 40095 (osmium getid + export)
// 4. ritaglia sul confine e tiene solo le relazioni route=hiking/foot/mtb/bicycle
//    con i loro membri (osmium extract + tags-filter)
// 5. ricompone in Node la geometria di ogni percorso dal formato OPL
//    (osmium export non sa trasformare le relazioni dei percorsi in linee)
// 6. semplifica, arrotonda e scrive il GeoJSON con il confine, che l'app usa
//    per decidere quando leggere il file e quando chiedere a Overpass
//
// Dati © OpenStreetMap contributors, licenza ODbL: il file generato va
// distribuito con la stessa attribuzione.

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RADICE, '.osm-cache');
const USCITA = join(RADICE, 'public', 'data', 'percorsi-puglia.geojson');

const URL_ESTRATTO = 'https://download.geofabrik.de/europe/italy/sud-latest.osm.pbf';
const RIQUADRO_PUGLIA = '14.90,39.75,18.55,42.25'; // ovest,sud,est,nord (un po' più largo del confine)
const ID_CONFINE = 40095; // relazione OSM "Puglia" (admin_level=4)
const ROUTE = ['hiking', 'foot', 'mtb', 'bicycle'];
// tag che l'app usa nelle schede
const TAG_UTILI = ['route', 'name', 'name:it', 'ref', 'network', 'from', 'to', 'osmc:symbol', 'cai_scale', 'sac_scale',
  'mtb:scale', 'mtb:scale:uphill', 'distance', 'description', 'description:it', 'website'];
const TOLLERANZA_LINEE = 0.00004; // gradi (~4 m): semplificazione dei percorsi
const TOLLERANZA_CONFINE = 0.002; // gradi (~200 m): il confine serve solo a dire "dentro o fuori"
const GIORNO = 24 * 3600 * 1000;

const forza = process.argv.includes('--forza');

// --- Utilità

function passo(testo) {
  console.log(`\n▶ ${testo}`);
}

function osmium(argomenti) {
  const r = spawnSync('osmium', argomenti, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`osmium ${argomenti[0]} non è riuscito (codice ${r.status})`);
}

function controllaOsmium() {
  const r = spawnSync('osmium', ['--version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.error(`
✖ osmium-tool non è installato.
  macOS:  brew install osmium-tool   (se non hai Homebrew: https://brew.sh)
  Linux:  sudo apt install osmium-tool
  Altro:  https://osmcode.org/osmium-tool/
`);
    process.exit(1);
  }
  console.log(`osmium: ${r.stdout.split('\n')[0]}`);
}

async function scarica(url, destinazione) {
  if (!forza && existsSync(destinazione) && Date.now() - statSync(destinazione).mtimeMs < 7 * GIORNO) {
    console.log(`Uso l'estratto già scaricato (${Math.round(statSync(destinazione).size / 1e6)} MB). --forza per riscaricarlo.`);
    return;
  }
  const r = await fetch(url, { headers: { 'User-Agent': 'WildSpot-percorsi-puglia (script manuale)' } });
  if (!r.ok) throw new Error(`Download non riuscito: HTTP ${r.status}`);
  const totale = Number(r.headers.get('content-length')) || 0;
  let scaricati = 0;
  let ultimo = 0;
  const corpo = Readable.fromWeb(r.body);
  corpo.on('data', (pezzo) => {
    scaricati += pezzo.length;
    if (Date.now() - ultimo > 1000) {
      ultimo = Date.now();
      const pct = totale ? ` (${Math.round((scaricati / totale) * 100)}%)` : '';
      process.stdout.write(`\r  ${Math.round(scaricati / 1e6)} MB${pct}   `);
    }
  });
  await pipeline(corpo, createWriteStream(`${destinazione}.parziale`));
  spawnSync('mv', [`${destinazione}.parziale`, destinazione]);
  process.stdout.write(`\r  ${Math.round(scaricati / 1e6)} MB scaricati\n`);
}

// Ramer–Douglas–Peucker su punti [x, y]
function semplifica(punti, tolleranza) {
  if (punti.length < 3) return punti;
  const t2 = tolleranza * tolleranza;
  const tieni = new Uint8Array(punti.length);
  tieni[0] = tieni[punti.length - 1] = 1;
  const pila = [[0, punti.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    const [ax, ay] = punti[a];
    const [bx, by] = punti[b];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let massimo = 0;
    let indice = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = punti[i];
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      const qx = ax + t * dx - px;
      const qy = ay + t * dy - py;
      const d2 = qx * qx + qy * qy;
      if (d2 > massimo) {
        massimo = d2;
        indice = i;
      }
    }
    if (massimo > t2) {
      tieni[indice] = 1;
      pila.push([a, indice], [indice, b]);
    }
  }
  return punti.filter((_, i) => tieni[i]);
}

const arrotonda = (v, cifre) => Math.round(v * 10 ** cifre) / 10 ** cifre;

// --- OPL: una riga per oggetto. Esempi (senza metadati):
//   n123 T x12.3456789 y41.1234567
//   w45 Thighway=path Nn1,n2,n3
//   r78 Ttype=route,route=hiking,name=Sentiero%20%1 Mw45@,w46@forward,n9@guidepost
// Nei tag i caratteri speciali sono codificati come %<esadecimale>%.

const decodifica = (testo) => testo.replace(/%([0-9a-fA-F]+)%/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));

function leggiTag(campo) {
  const tag = {};
  if (!campo) return tag;
  for (const coppia of campo.split(',')) {
    if (!coppia) continue;
    const i = coppia.indexOf('=');
    tag[decodifica(coppia.slice(0, i))] = decodifica(coppia.slice(i + 1));
  }
  return tag;
}

export function analizzaRigaOpl(riga) {
  const campi = riga.split(' ');
  const tipo = riga[0];
  const id = Number(campi[0].slice(1));
  const oggetto = { tipo, id };
  for (const c of campi.slice(1)) {
    const k = c[0];
    const v = c.slice(1);
    if (k === 'T') oggetto.tag = leggiTag(v);
    else if (k === 'x') oggetto.lng = Number(v);
    else if (k === 'y') oggetto.lat = Number(v);
    else if (k === 'N') oggetto.nodi = v ? v.split(',').map((n) => Number(n.slice(1))) : [];
    else if (k === 'M') {
      oggetto.membri = v
        ? v.split(',').map((m) => {
            const at = m.indexOf('@');
            return { tipo: m[0], ref: Number(m.slice(1, at)), ruolo: decodifica(m.slice(at + 1)) };
          })
        : [];
    }
  }
  return oggetto;
}

/**
 * Da righe OPL a Feature GeoJSON dei percorsi: ogni way membro diventa un tratto
 * della MultiLineString (come la risposta di Overpass con "out geom").
 */
export async function percorsiDaOpl(righe) {
  const nodi = new Map(); // id -> [lng, lat]
  const vie = new Map(); // id -> [id nodi]
  const relazioni = [];
  for await (const riga of righe) {
    if (!riga) continue;
    const o = analizzaRigaOpl(riga);
    if (o.tipo === 'n' && Number.isFinite(o.lng)) nodi.set(o.id, [o.lng, o.lat]);
    else if (o.tipo === 'w') vie.set(o.id, o.nodi || []);
    else if (o.tipo === 'r' && o.tag?.type === 'route' && ROUTE.includes(o.tag.route)) relazioni.push(o);
  }
  const features = [];
  for (const r of relazioni) {
    const tratti = [];
    for (const m of r.membri || []) {
      if (m.tipo !== 'w') continue; // nodi (cartelli, punti di partenza) e sotto-relazioni: saltati
      const coordinate = (vie.get(m.ref) || []).map((id) => nodi.get(id)).filter(Boolean);
      if (coordinate.length < 2) continue;
      tratti.push(semplifica(coordinate, TOLLERANZA_LINEE).map(([x, y]) => [arrotonda(x, 5), arrotonda(y, 5)]));
    }
    if (!tratti.length) continue;
    const properties = { id: r.id };
    for (const k of TAG_UTILI) if (r.tag[k]) properties[k] = r.tag[k];
    features.push({ type: 'Feature', properties, geometry: { type: 'MultiLineString', coordinates: tratti } });
  }
  return features;
}

function confineSemplificato(fileGeojson) {
  const dati = JSON.parse(readFileSync(fileGeojson, 'utf8'));
  const area = dati.features.find((f) => /Polygon/.test(f.geometry?.type));
  if (!area) throw new Error('Confine della Puglia non trovato nel file esportato');
  const poligoni = area.geometry.type === 'Polygon' ? [area.geometry.coordinates] : area.geometry.coordinates;
  // anelli semplificati; si scartano le isolette ridotte a meno di 4 punti
  return poligoni
    .map((anelli) =>
      anelli
        .map((anello) => semplifica(anello, TOLLERANZA_CONFINE).map(([x, y]) => [arrotonda(x, 4), arrotonda(y, 4)]))
        .filter((a) => a.length >= 4),
    )
    .filter((anelli) => anelli.length);
}

// --- Programma

async function principale() {
  console.log('WildSpot · percorsi della Puglia da OpenStreetMap');
  controllaOsmium();
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(dirname(USCITA), { recursive: true });

  const sud = join(CACHE, 'sud-latest.osm.pbf');
  const riquadro = join(CACHE, 'puglia-riquadro.osm.pbf');
  const confinePbf = join(CACHE, 'confine-puglia.osm.pbf');
  const confineGeojson = join(CACHE, 'confine-puglia.geojson');
  const puglia = join(CACHE, 'puglia.osm.pbf');
  const percorsiPbf = join(CACHE, 'percorsi-puglia.osm.pbf');

  passo(`1/6 Scarico l'estratto del Sud Italia da Geofabrik`);
  await scarica(URL_ESTRATTO, sud);

  passo('2/6 Ritaglio il riquadro della Puglia');
  osmium(['extract', '-b', RIQUADRO_PUGLIA, '-s', 'smart', '-S', 'types=route,boundary,multipolygon', sud, '-o', riquadro, '--overwrite']);

  passo(`3/6 Ricavo il confine regionale (relazione ${ID_CONFINE})`);
  osmium(['getid', '-r', riquadro, `r${ID_CONFINE}`, '-o', confinePbf, '--overwrite']);
  osmium(['export', confinePbf, '-o', confineGeojson, '--geometry-types=polygon', '--overwrite']);
  const confine = confineSemplificato(confineGeojson);

  passo('4/6 Ritaglio sul confine e tengo solo i percorsi');
  // "smart" completa le relazioni dei percorsi che attraversano il confine
  osmium(['extract', '-p', confineGeojson, '-s', 'smart', '-S', 'types=route', riquadro, '-o', puglia, '--overwrite']);
  osmium(['tags-filter', puglia, ...ROUTE.map((r) => `r/route=${r}`), '-o', percorsiPbf, '--overwrite']);

  passo('5/6 Ricompongo la geometria dei percorsi');
  const processo = spawn('osmium', ['cat', percorsiPbf, '-f', 'opl,add_metadata=false'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const righe = createInterface({ input: processo.stdout, crlfDelay: Infinity });
  const features = await percorsiDaOpl(righe);
  const conteggio = Object.fromEntries(ROUTE.map((r) => [r, features.filter((f) => f.properties.route === r).length]));
  console.log(`  ${features.length} percorsi:`, conteggio);

  passo('6/6 Scrivo il GeoJSON');
  const geojson = {
    type: 'FeatureCollection',
    generato: new Date().toISOString(),
    fonte: URL_ESTRATTO,
    licenza: 'Dati © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright',
    // confine semplificato della Puglia (MultiPolygon): l'app usa il file solo dentro questo confine
    confine,
    features,
  };
  writeFileSync(USCITA, JSON.stringify(geojson));
  const mb = statSync(USCITA).size / 1e6;
  console.log(`\n✔ ${USCITA.replace(RADICE + '/', '')}: ${mb.toFixed(1)} MB`);
  if (mb > 15) console.warn('⚠ Il file è grande: valuta una TOLLERANZA_LINEE maggiore per alleggerirlo.');
  console.log('Ricordati di fare commit del file e push: l\'app lo userà come fonte principale in Puglia.');
}

// eseguito direttamente (non importato dai test)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principale().catch((err) => {
    console.error(`\n✖ ${err.message}`);
    process.exit(1);
  });
}
