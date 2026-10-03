// Livello della mappa con i luoghi eBird: un indicatore per luogo.
//
// - Luogo con avvistamenti recenti: etichetta verde con binocolo e numero di
//   specie; stella e bordo ocra se ci sono specie notevoli (rare per la zona).
// - Hotspot senza avvistamenti recenti da mostrare: etichetta chiara più piccola.
//
// Gli indicatori finiscono nel raggruppamento condiviso con iNaturalist.

import { creaIndicatore, htmlLuogoEbird, htmlHotspot, evidenziaIndicatore, cambiaHtml } from './markers.js';

export function creaLivelloEbird(raggruppamento, onSeleziona) {
  let indicatori = [];
  let perLuogo = new Map(); // locId -> funzione che seleziona l'indicatore
  let disegni = new Map(); // locId -> { indicatore, html(extra) } per evidenziare i vicini a un percorso
  let selezionato = null;
  let idSelezionato = null; // per ritrovare la selezione dopo un ricaricamento

  /**
   * @param {object[]} luoghi   risultato di raggruppaPerLuogo
   * @param {{avvistamenti: boolean, hotspot: boolean}} visibili  livelli attivi
   */
  function aggiorna(luoghi, visibili) {
    const daRiselezionare = idSelezionato;
    togliEvidenziazione();
    raggruppamento.removeLayers(indicatori);
    indicatori = [];
    perLuogo = new Map();
    disegni = new Map();

    for (const luogo of luoghi) {
      const conAvvistamenti = visibili.avvistamenti && luogo.avvistamenti.length > 0;
      const comeHotspot = visibili.hotspot && luogo.hotspot;
      if (!conAvvistamenti && !comeHotspot) continue;

      const specie = new Set(luogo.avvistamenti.map((a) => a.codiceSpecie)).size;
      const htmlCon = (extra) => (conAvvistamenti ? htmlLuogoEbird(specie, luogo.notevole, extra) : htmlHotspot(extra));
      const html = htmlCon('');
      const indicatore = creaIndicatore([luogo.lat, luogo.lng], html, { titolo: luogo.nome });
      const seleziona = () => {
        togliEvidenziazione();
        selezionato = indicatore;
        idSelezionato = luogo.locId;
        evidenziaIndicatore(indicatore, true);
      };
      indicatore.on('click', () => {
        onSeleziona(luogo, { conAvvistamenti });
        seleziona();
      });
      if (luogo.locId === daRiselezionare) setTimeout(seleziona); // dopo l'aggiunta alla mappa
      perLuogo.set(luogo.locId, seleziona);
      disegni.set(luogo.locId, { indicatore, htmlCon });
      indicatori.push(indicatore);
    }
    raggruppamento.addLayers(indicatori);
  }

  function togliEvidenziazione() {
    evidenziaIndicatore(selezionato, false);
    selezionato = null;
    idSelezionato = null;
  }

  // Evidenzia i luoghi con locId in `vicini` e attenua gli altri; null = normale
  function evidenziaVicini(vicini) {
    for (const [locId, { indicatore, htmlCon }] of disegni) {
      cambiaHtml(indicatore, htmlCon(!vicini ? '' : vicini.has(locId) ? 'mk-vicino' : 'mk-lontano'));
    }
  }

  return { aggiorna, togliEvidenziazione, seleziona: (locId) => perLuogo.get(locId)?.(), evidenziaVicini };
}
