// Livello della mappa con le osservazioni di iNaturalist.
//
// - Osservazione con posizione precisa: badge rotondo con l'icona del gruppo.
// - Osservazione con posizione oscurata: badge chiaro con bordo tratteggiato.
//   Toccandola compare l'area di incertezza dichiarata dall'API (spesso decine
//   di km): il centro NON è la posizione reale, è solo il punto pubblico casuale.
//   Le aree non sono disegnate tutte insieme perché, sovrapposte, coprirebbero
//   la mappa con una velatura che confonde.
//
// Gli indicatori finiscono nel raggruppamento condiviso con eBird.

import L from './leaflet-global.js';
import { gruppo } from './groups.js';
import { creaIndicatore, htmlOsservazione, evidenziaIndicatore } from './markers.js';

export function creaLivelloOsservazioni(mappa, raggruppamento, onSeleziona) {
  // Pannello sotto agli indicatori per le aree di incertezza
  mappa.createPane('incertezza').style.zIndex = 350;

  let indicatori = [];
  let perId = new Map(); // id osservazione -> { indicatore, o }
  let selezionato = null;
  let idSelezionato = null; // per ritrovare la selezione dopo un ricaricamento
  let areaEvidenziata = null;

  function aggiorna(osservazioni) {
    const daRiselezionare = idSelezionato;
    togliEvidenziazione();
    raggruppamento.removeLayers(indicatori);
    perId = new Map();

    indicatori = osservazioni.map((o) => {
      const punto = [o.lat, o.lng];
      const indicatore = creaIndicatore(punto, htmlOsservazione(o.gruppo, o.oscurata), {
        titolo: o.nomeComune || o.nomeSci,
        sopra: true,
      });
      indicatore.on('click', () => {
        onSeleziona(o); // prima la scheda: aprendola si toglie l'evidenziazione precedente
        evidenzia(indicatore, o);
      });
      if (o.id === daRiselezionare) setTimeout(() => evidenzia(indicatore, o)); // dopo l'aggiunta alla mappa
      perId.set(o.id, { indicatore, o });
      return indicatore;
    });
    raggruppamento.addLayers(indicatori);
  }

  function evidenzia(indicatore, o) {
    togliEvidenziazione();
    selezionato = indicatore;
    idSelezionato = o.id;
    evidenziaIndicatore(indicatore, true);
    if (o.oscurata) {
      // Mostriamo il bordo dell'area entro cui si trova davvero l'osservazione
      areaEvidenziata = L.circle([o.lat, o.lng], {
        pane: 'incertezza',
        radius: o.incertezzaM,
        color: gruppo(o.gruppo).colore,
        weight: 2,
        dashArray: '6 6',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(mappa);
    }
  }

  function togliEvidenziazione() {
    evidenziaIndicatore(selezionato, false);
    selezionato = null;
    idSelezionato = null;
    areaEvidenziata?.remove();
    areaEvidenziata = null;
  }

  // Seleziona un'osservazione dall'esterno (per esempio dall'elenco)
  function seleziona(id) {
    const voce = perId.get(id);
    if (voce) evidenzia(voce.indicatore, voce.o);
  }

  return { aggiorna, togliEvidenziazione, seleziona };
}
