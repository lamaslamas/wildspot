// Disegno sulla mappa del punto scelto per luce e meteo:
// - un mirino ocra sul punto
// - una linea verso il sole all'ora scelta, con un disco giallo al fondo
//   (grigio e tratteggiato quando il sole è sotto l'orizzonte)
// - due linee tratteggiate sottili verso dove il sole sorge e tramonta
//
// Le linee hanno lunghezza fissa in pixel, così restano leggibili a ogni zoom:
// per questo vengono ricalcolate quando cambia lo zoom.

import L from 'leaflet';

const LUNGHEZZA_PX = 90;

export function creaLivelloSole(mappa) {
  const gruppo = L.layerGroup();
  let punto = null;   // L.LatLng
  let azimut = null;  // gradi bussola del sole
  let sopra = true;   // sole sopra l'orizzonte?
  let azimutAlba = null;
  let azimutTramonto = null;
  let testi = {};     // etichette tradotte per alba e tramonto

  // Punto di arrivo di una linea lunga LUNGHEZZA_PX in direzione `gradi`
  function fineLinea(gradi, lunghezza = LUNGHEZZA_PX) {
    const p = mappa.latLngToLayerPoint(punto);
    const rad = (gradi * Math.PI) / 180;
    return mappa.layerPointToLatLng(L.point(p.x + Math.sin(rad) * lunghezza, p.y - Math.cos(rad) * lunghezza));
  }

  function etichetta(latlng, testo) {
    return L.marker(latlng, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'etichetta-sole', html: testo, iconSize: null }),
    });
  }

  function disegna() {
    gruppo.clearLayers();
    if (!punto) return;

    // Direzioni di alba e tramonto
    for (const [gradi, testo] of [[azimutAlba, testi.alba], [azimutTramonto, testi.tramonto]]) {
      if (gradi === null) continue;
      const fine = fineLinea(gradi, LUNGHEZZA_PX * 0.7);
      L.polyline([punto, fine], { className: 'linea-alba-tramonto', interactive: false }).addTo(gruppo);
      // L'etichetta si nasconde quando il sole è nella stessa direzione, per non sovrapporsi al disco
      const differenza = Math.abs(((gradi - azimut + 540) % 360) - 180);
      if (testo && (azimut === null || differenza > 20)) etichetta(fineLinea(gradi, LUNGHEZZA_PX * 0.7 + 34), testo).addTo(gruppo);
    }

    // Linea e disco del sole
    if (azimut !== null) {
      const fine = fineLinea(azimut);
      L.polyline([punto, fine], {
        className: sopra ? 'linea-sole' : 'linea-sole sotto',
        interactive: false,
      }).addTo(gruppo);
      L.circleMarker(fine, {
        radius: 10,
        className: sopra ? 'disco-sole' : 'disco-sole sotto',
        interactive: false,
      }).addTo(gruppo);
    }

    // Mirino sul punto
    L.circleMarker(punto, { radius: 9, className: 'punto-luce', interactive: false }).addTo(gruppo);
    L.circleMarker(punto, { radius: 3, className: 'punto-luce-centro', interactive: false }).addTo(gruppo);
  }

  mappa.on('zoomend', disegna);

  return {
    // Mostra il punto e la posizione del sole
    aggiorna({ latlng, sole, azimutAlba: alba, azimutTramonto: tramonto, testi: testiTradotti }) {
      punto = L.latLng(latlng);
      azimut = sole.azimut;
      sopra = sole.altezza > 0;
      azimutAlba = alba;
      azimutTramonto = tramonto;
      testi = testiTradotti || {};
      if (!mappa.hasLayer(gruppo)) gruppo.addTo(mappa);
      disegna();
    },
    nascondi() {
      gruppo.remove();
      punto = null;
    },
  };
}
