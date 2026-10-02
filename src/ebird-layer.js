// Livello della mappa con i luoghi eBird: un indicatore per luogo.
//
// - Luogo con avvistamenti recenti: etichetta verde con binocolo e numero di
//   specie; stella e bordo ocra se ci sono specie notevoli (rare per la zona).
// - Hotspot senza avvistamenti recenti da mostrare: etichetta chiara più piccola.
//
// Gli indicatori finiscono nel raggruppamento condiviso con iNaturalist.

import { creaIndicatore, htmlLuogoEbird, htmlHotspot, evidenziaIndicatore } from './markers.js';

export function creaLivelloEbird(raggruppamento, onSeleziona) {
  let indicatori = [];
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

    for (const luogo of luoghi) {
      const conAvvistamenti = visibili.avvistamenti && luogo.avvistamenti.length > 0;
      const comeHotspot = visibili.hotspot && luogo.hotspot;
      if (!conAvvistamenti && !comeHotspot) continue;

      const html = conAvvistamenti
        ? htmlLuogoEbird(new Set(luogo.avvistamenti.map((a) => a.codiceSpecie)).size, luogo.notevole)
        : htmlHotspot();
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
      indicatori.push(indicatore);
    }
    raggruppamento.addLayers(indicatori);
  }

  function togliEvidenziazione() {
    evidenziaIndicatore(selezionato, false);
    selezionato = null;
    idSelezionato = null;
  }

  return { aggiorna, togliEvidenziazione };
}
