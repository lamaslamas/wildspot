// Heatmap delle osservazioni iNaturalist: tile calcolate dal server di
// iNaturalist con gli stessi filtri della mappa (gruppi, specie, periodo).
// Mostra le zone con più osservazioni: dove gli animali sono stati visti di
// più, ma anche dove ci sono più naturalisti.

import L from './leaflet-global.js';
import { urlHeatmap } from './inaturalist.js';

export function creaLivelloHeatmap(mappa) {
  // Pannello sopra la mappa di base ma sotto le aree e gli indicatori
  mappa.createPane('heatmap').style.zIndex = 300;
  const livello = L.tileLayer('', {
    pane: 'heatmap',
    opacity: 0.85,
    maxZoom: 19,
    className: 'tile-heatmap',
  });

  return {
    aggiorna(acceso, filtri) {
      if (!acceso) {
        livello.remove();
        return;
      }
      const url = urlHeatmap({ giorni: filtri.giorni, gruppi: filtri.gruppi, taxonId: filtri.taxon?.id });
      if (livello._url !== url) livello.setUrl(url); // ricarica le tile solo se i filtri cambiano
      if (!mappa.hasLayer(livello)) livello.addTo(mappa);
    },
  };
}
