// Traduzioni dell'interfaccia (italiano e inglese).
//
// - Nel codice: t('chiave', { parametri })
// - Nell'HTML: attributo data-i18n="chiave" (testo) o data-i18n-aria="chiave" (aria-label)
// Per aggiungere un testo, inserisci la stessa chiave in entrambe le lingue.

import { leggi, scrivi } from './storage.js';

export const LINGUE = ['it', 'en'];

const TESTI = {
  it: {
    // Header di presentazione
    'hero.titolo': 'I posti migliori per fotografare la fauna, ',
    'hero.titoloEvidenza': 'vicino a te',
    'hero.sottotitolo':
      'WildSpot unisce gli avvistamenti recenti di animali selvatici e uccelli con le informazioni che servono a un fotografo naturalista.',
    'hero.puntoAvvistamenti': 'Avvistamenti recenti da iNaturalist ed eBird',
    'hero.puntoLuce': 'Luce, ora dorata e direzione del sole',
    'hero.puntoMeteo': 'Meteo delle prossime ore sul posto',
    'hero.puntoDiario': 'Diario dei tuoi spot, salvato sul telefono',
    'hero.inArrivo': 'in arrivo',
    'hero.apriMappa': 'Apri la mappa',
    lingua: 'Lingua',

    // Barra e comandi
    'aria.mappa': 'Mappa',
    'aria.tornaSu': 'Torna alla presentazione',
    'aria.info': 'Informazioni e comportamento corretto',
    'aria.posizione': 'Centra sulla mia posizione',
    'aria.comandi': 'Comandi mappa',
    'aria.raggio': 'Raggio di ricerca',
    'aria.chiudi': 'Chiudi',
    filtri: 'Filtri',
    informazioni: 'Informazioni',

    // Messaggi di stato
    'stato.cercoPosizione': 'Cerco la tua posizione…',
    'stato.carico': 'Carico le osservazioni…',
    'stato.offline': 'Sei offline: osservazioni non disponibili',
    'stato.nessuna': 'Nessuna osservazione · {periodo}',
    'stato.conteggio1': '1 osservazione · {periodo}',
    'stato.conteggio': '{n} osservazioni · {periodo}',
    'stato.parziale': 'Le {n} più recenti su {totale} · {periodo}',
    'stato.troppeRichieste': 'Troppe richieste a iNaturalist: attendi un minuto e riprova',
    'stato.erroreRete': 'iNaturalist non risponde: controlla la connessione e riprova',
    'stato.nessunLivello': 'Nessun livello attivo: accendine uno dai filtri',

    // Errori GPS
    'gps.nonSupportato': 'Questo browser non supporta la geolocalizzazione.',
    'gps.negato': 'Permesso di posizione negato. Abilitalo nelle impostazioni del browser.',
    'gps.nonDisponibile': 'Posizione non disponibile. Prova all\'aperto o attiva il GPS.',
    'gps.timeout': 'Il GPS non ha risposto in tempo. Riprova.',
    'gps.errore': 'Errore di geolocalizzazione.',

    // Gruppi di animali
    'gruppo.Aves': 'Uccelli',
    'gruppo.Mammalia': 'Mammiferi',
    'gruppo.Reptilia': 'Rettili',
    'gruppo.Amphibia': 'Anfibi',
    'gruppo.Insecta': 'Insetti',
    'gruppo.altro': 'Altro',

    // Filtri
    'filtri.periodo': 'Periodo',
    // Periodi: etichetta del pulsante e descrizione nel messaggio di stato (0 = sempre)
    'periodo.7': '7 giorni',
    'periodo.30': '30 giorni',
    'periodo.365': '1 anno',
    'periodo.0': 'Sempre',
    'periodoStato.7': 'ultimi 7 giorni',
    'periodoStato.30': 'ultimi 30 giorni',
    'periodoStato.365': 'ultimo anno',
    'periodoStato.0': 'da sempre',
    'filtri.gruppi': 'Gruppi di animali',
    'filtri.specie': 'Specie',
    'filtri.segnaposto': 'Es. airone, picchio, Vulpes…',
    'filtri.cerca': 'Cerca una specie',
    'filtri.nessuno': 'Nessun animale trovato con questo nome',
    'filtri.nonDisponibile': 'Ricerca non disponibile: controlla la connessione',
    'filtri.rimuovi': 'Rimuovi',

    // Scheda osservazione
    'scheda.fotoDi': 'Foto di {nome}',
    'scheda.dataSconosciuta': 'Data sconosciuta',
    'scheda.gruppo': 'Gruppo',
    'scheda.data': 'Data',
    'scheda.individui': 'Individui',
    'scheda.luogo': 'Luogo',
    'scheda.osservatore': 'Osservatore',
    'scheda.oscurata':
      "Posizione oscurata per tutelare la specie o su richiesta dell'osservatore: l'osservazione si trova in un punto qualsiasi entro circa {distanza} dal centro del cerchio. Non cercare di risalire al luogo esatto.",
    'scheda.apriSu': 'Apri su {fonte}',
    'scheda.soloSpecie': 'Solo questa specie',

    // Informazioni
    'info.etica': 'Fotografare senza disturbare',
    'info.etica1': "Mantieni la distanza: se l'animale cambia comportamento, sei troppo vicino. Usa il teleobiettivo, non i passi.",
    'info.etica2': 'Stai lontano dai siti di nidificazione e dalle tane, soprattutto in primavera e inizio estate.',
    'info.etica3': 'Niente richiami registrati nel periodo riproduttivo: stressano gli animali e li distolgono dalla cova.',
    'info.etica4': 'Resta sui sentieri, rispetta le aree protette e le proprietà private.',
    'info.etica5': "Non condividere la posizione di specie sensibili: le posizioni oscurate in quest'app restano tali.",
    'info.fonti': 'Fonti dei dati',
    'info.fonteMappa': 'Mappa © {link} contributors',
    'info.fonteInat': 'Osservazioni e foto da {link}: i diritti delle foto appartengono ai rispettivi autori',

    // Impostazioni
    impostazioni: 'Impostazioni',
    'aria.impostazioni': 'Impostazioni',
    'imp.ebird': 'Chiave eBird',
    'imp.ebirdSpiegazione': 'Per vedere hotspot e avvistamenti di eBird serve una chiave personale gratuita.',
    'imp.ottieniChiave': 'Ottieni la chiave su ebird.org',
    'imp.chiave': 'Chiave API eBird',
    'imp.chiaveSegnaposto': 'Incolla qui la tua chiave',
    'imp.mostra': 'Mostra',
    'imp.nascondi': 'Nascondi',
    'imp.verificaSalva': 'Verifica e salva',
    'imp.rimuovi': 'Rimuovi',
    'imp.verifico': 'Verifico la chiave…',
    'imp.chiaveOk': 'Chiave valida e salvata.',
    'imp.chiaveNonValida': 'Chiave non valida: controlla di averla copiata per intero.',
    'imp.verificaNonRiuscita': 'Verifica non riuscita: controlla la connessione.',
    'imp.chiaveRimossa': 'Chiave rimossa da questo dispositivo.',
    'imp.chiavePrivata': 'La chiave resta solo su questo dispositivo e viene inviata soltanto a eBird.',
    'imp.raggio': 'Raggio predefinito',
    'imp.gruppi': 'Gruppi di animali predefiniti',
    'imp.predefinitiNota': "Valgono all'apertura dell'app; durante l'uso puoi cambiarli dalla barra in basso e dai filtri.",

    // Livelli della mappa
    'filtri.livelli': 'Livelli',
    'livello.inat': 'iNaturalist',
    'livello.ebirdAvvistamenti': 'Avvistamenti eBird',
    'livello.ebirdHotspot': 'Hotspot eBird',
    'filtri.ebirdSenzaChiave': 'Per i livelli eBird serve la chiave.',
    'filtri.apriImpostazioni': 'Aggiungila nelle impostazioni',
    'filtri.ebirdLimite': 'eBird fornisce al massimo gli ultimi 30 giorni: per i periodi più lunghi i suoi avvistamenti si fermano lì.',

    // eBird
    'stato.ebirdChiave': 'Chiave eBird non valida: controllala nelle impostazioni',
    'stato.ebirdErrore': 'eBird non risponde: per ora vedi solo iNaturalist',
    'ebird.hotspot': 'Hotspot eBird',
    'ebird.notevoli': 'Specie notevoli',
    'ebird.notevole': 'notevole',
    'ebird.specieTotali': 'Specie osservate in totale',
    'ebird.ultimaVisita': 'Ultima lista',
    'ebird.recenti': 'Avvistamenti recenti ({n})',
    'ebird.nessunRecente': 'Nessun avvistamento recente qui con i filtri attuali.',
    'ebird.luogoPrivato': "Luogo personale di un osservatore: potrebbe essere una proprietà privata, chiedi il permesso prima di entrare.",
    'info.fonteEbird': 'Avvistamenti e hotspot da {link} (Cornell Lab of Ornithology)',
  },

  en: {
    'hero.titolo': 'The best wildlife photo spots, ',
    'hero.titoloEvidenza': 'near you',
    'hero.sottotitolo':
      'WildSpot brings together recent sightings of wild animals and birds with the information a nature photographer needs.',
    'hero.puntoAvvistamenti': 'Recent sightings from iNaturalist and eBird',
    'hero.puntoLuce': 'Light, golden hour and sun direction',
    'hero.puntoMeteo': 'Weather for the next hours on site',
    'hero.puntoDiario': 'A journal of your spots, saved on your phone',
    'hero.inArrivo': 'coming soon',
    'hero.apriMappa': 'Open the map',
    lingua: 'Language',

    'aria.mappa': 'Map',
    'aria.tornaSu': 'Back to the introduction',
    'aria.info': 'Information and good practice',
    'aria.posizione': 'Center on my location',
    'aria.comandi': 'Map controls',
    'aria.raggio': 'Search radius',
    'aria.chiudi': 'Close',
    filtri: 'Filters',
    informazioni: 'Information',

    'stato.cercoPosizione': 'Finding your location…',
    'stato.carico': 'Loading observations…',
    'stato.offline': 'You are offline: observations unavailable',
    'stato.nessuna': 'No observations · {periodo}',
    'stato.conteggio1': '1 observation · {periodo}',
    'stato.conteggio': '{n} observations · {periodo}',
    'stato.parziale': 'The {n} most recent of {totale} · {periodo}',
    'stato.troppeRichieste': 'Too many requests to iNaturalist: wait a minute and try again',
    'stato.erroreRete': 'iNaturalist is not responding: check your connection and try again',
    'stato.nessunLivello': 'No layer is on: turn one on from the filters',

    'gps.nonSupportato': 'This browser does not support geolocation.',
    'gps.negato': 'Location permission denied. Enable it in your browser settings.',
    'gps.nonDisponibile': 'Location unavailable. Try outdoors or turn on GPS.',
    'gps.timeout': 'GPS did not respond in time. Try again.',
    'gps.errore': 'Geolocation error.',

    'gruppo.Aves': 'Birds',
    'gruppo.Mammalia': 'Mammals',
    'gruppo.Reptilia': 'Reptiles',
    'gruppo.Amphibia': 'Amphibians',
    'gruppo.Insecta': 'Insects',
    'gruppo.altro': 'Other',

    'filtri.periodo': 'Period',
    'periodo.7': '7 days',
    'periodo.30': '30 days',
    'periodo.365': '1 year',
    'periodo.0': 'All time',
    'periodoStato.7': 'last 7 days',
    'periodoStato.30': 'last 30 days',
    'periodoStato.365': 'last year',
    'periodoStato.0': 'all time',
    'filtri.gruppi': 'Animal groups',
    'filtri.specie': 'Species',
    'filtri.segnaposto': 'E.g. heron, woodpecker, Vulpes…',
    'filtri.cerca': 'Search for a species',
    'filtri.nessuno': 'No animal found with this name',
    'filtri.nonDisponibile': 'Search unavailable: check your connection',
    'filtri.rimuovi': 'Remove',

    'scheda.fotoDi': 'Photo of {nome}',
    'scheda.dataSconosciuta': 'Unknown date',
    'scheda.gruppo': 'Group',
    'scheda.data': 'Date',
    'scheda.individui': 'Individuals',
    'scheda.luogo': 'Place',
    'scheda.osservatore': 'Observer',
    'scheda.oscurata':
      'Location obscured to protect the species or at the observer\'s request: the observation is somewhere within about {distanza} of the circle\'s center. Do not try to work out the exact place.',
    'scheda.apriSu': 'Open on {fonte}',
    'scheda.soloSpecie': 'Only this species',

    'info.etica': 'Photograph without disturbing',
    'info.etica1': 'Keep your distance: if the animal changes its behaviour, you are too close. Use a telephoto lens, not your feet.',
    'info.etica2': 'Stay away from nesting sites and dens, especially in spring and early summer.',
    'info.etica3': 'No playback of recorded calls during the breeding season: it stresses animals and draws them away from their nests.',
    'info.etica4': 'Stay on trails, respect protected areas and private property.',
    'info.etica5': 'Do not share the location of sensitive species: obscured locations in this app stay obscured.',
    'info.fonti': 'Data sources',
    'info.fonteMappa': 'Map © {link} contributors',
    'info.fonteInat': 'Observations and photos from {link}: photo rights belong to their authors',

    impostazioni: 'Settings',
    'aria.impostazioni': 'Settings',
    'imp.ebird': 'eBird key',
    'imp.ebirdSpiegazione': 'To see eBird hotspots and sightings you need a free personal key.',
    'imp.ottieniChiave': 'Get your key on ebird.org',
    'imp.chiave': 'eBird API key',
    'imp.chiaveSegnaposto': 'Paste your key here',
    'imp.mostra': 'Show',
    'imp.nascondi': 'Hide',
    'imp.verificaSalva': 'Check and save',
    'imp.rimuovi': 'Remove',
    'imp.verifico': 'Checking the key…',
    'imp.chiaveOk': 'Key valid and saved.',
    'imp.chiaveNonValida': 'Invalid key: make sure you copied all of it.',
    'imp.verificaNonRiuscita': 'Check failed: verify your connection.',
    'imp.chiaveRimossa': 'Key removed from this device.',
    'imp.chiavePrivata': 'The key stays on this device only and is sent to eBird alone.',
    'imp.raggio': 'Default radius',
    'imp.gruppi': 'Default animal groups',
    'imp.predefinitiNota': 'Used when the app opens; while using it you can change them from the bottom bar and the filters.',

    'filtri.livelli': 'Layers',
    'livello.inat': 'iNaturalist',
    'livello.ebirdAvvistamenti': 'eBird sightings',
    'livello.ebirdHotspot': 'eBird hotspots',
    'filtri.ebirdSenzaChiave': 'eBird layers need a key.',
    'filtri.apriImpostazioni': 'Add it in settings',
    'filtri.ebirdLimite': 'eBird provides the last 30 days at most: for longer periods its sightings stop there.',

    'stato.ebirdChiave': 'Invalid eBird key: check it in settings',
    'stato.ebirdErrore': 'eBird is not responding: showing iNaturalist only for now',
    'ebird.hotspot': 'eBird hotspot',
    'ebird.notevoli': 'Notable species',
    'ebird.notevole': 'notable',
    'ebird.specieTotali': 'Species observed all time',
    'ebird.ultimaVisita': 'Latest checklist',
    'ebird.recenti': 'Recent sightings ({n})',
    'ebird.nessunRecente': 'No recent sightings here with the current filters.',
    'ebird.luogoPrivato': "An observer's personal location: it may be private property, ask permission before entering.",
    'info.fonteEbird': 'Sightings and hotspots from {link} (Cornell Lab of Ornithology)',
  },
};

// Lingua iniziale: quella scelta in passato, altrimenti quella del telefono
let lingua = leggi('lingua', null);
if (!LINGUE.includes(lingua)) {
  lingua = (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en';
}

export function linguaAttuale() {
  return lingua;
}

// Locale per formattare date e numeri
export function locale() {
  return lingua === 'it' ? 'it-IT' : 'en-GB';
}

// Traduce una chiave sostituendo i {parametri}
export function t(chiave, parametri = {}) {
  const testo = TESTI[lingua][chiave] ?? TESTI.it[chiave] ?? chiave;
  return testo.replace(/\{(\w+)\}/g, (_, nome) => parametri[nome] ?? `{${nome}}`);
}

// Applica le traduzioni agli elementi dell'HTML marcati con data-i18n
export function traduciPagina(radice = document) {
  document.documentElement.lang = lingua;
  for (const nodo of radice.querySelectorAll('[data-i18n]')) nodo.textContent = t(nodo.dataset.i18n);
  for (const nodo of radice.querySelectorAll('[data-i18n-aria]')) {
    nodo.setAttribute('aria-label', t(nodo.dataset.i18nAria));
  }
}

const ascoltatori = new Set();

// Registra una funzione da chiamare a ogni cambio di lingua
export function alCambioLingua(funzione) {
  ascoltatori.add(funzione);
}

export function impostaLingua(nuova) {
  if (!LINGUE.includes(nuova) || nuova === lingua) return;
  lingua = nuova;
  scrivi('lingua', nuova);
  traduciPagina();
  for (const funzione of ascoltatori) funzione(nuova);
}
