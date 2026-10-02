// Leaflet.markercluster è un plugin "vecchio stile" che cerca Leaflet nella
// variabile globale `L`: la esponiamo qui, prima di caricarlo.

import L from 'leaflet';

window.L = L;

export default L;
