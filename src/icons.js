// Icone SVG (24×24, colore = currentColor) usate negli indicatori sulla mappa
// e nella legenda. Sono silhouette semplici, leggibili anche a 16px.

const svg = (contenuto) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${contenuto}</svg>`;

export const ICONE_GRUPPI = {
  // Uccello posato
  Aves: svg(
    '<circle cx="15.5" cy="7.5" r="3.4"/><path d="M18.6 6.6 22.5 8l-3.9 1.4z"/>' +
      '<path d="M3 20.5 5.3 17C4 12.7 7.6 9.4 12 10c3.7.5 6.3 2.2 6.3 5.2 0 3.3-3.4 5.3-7.6 5.3H7.4L4.8 22z"/>',
  ),
  // Impronta di zampa
  Mammalia: svg(
    '<ellipse cx="12" cy="16.2" rx="4.8" ry="4"/><ellipse cx="5.6" cy="10.6" rx="2" ry="2.5"/>' +
      '<ellipse cx="9.5" cy="6.4" rx="2.1" ry="2.7"/><ellipse cx="14.5" cy="6.4" rx="2.1" ry="2.7"/>' +
      '<ellipse cx="18.4" cy="10.6" rx="2" ry="2.5"/>',
  ),
  // Tartaruga
  Reptilia: svg(
    '<path d="M3 15a8.2 7 0 0 1 16.4 0z"/><circle cx="21" cy="13" r="2.3"/>' +
      '<rect x="5" y="14.2" width="3" height="4.3" rx="1.4"/><rect x="14.4" y="14.2" width="3" height="4.3" rx="1.4"/>' +
      '<path d="M3.2 14.4 1 16.2l2.6.2z"/>',
  ),
  // Rana vista di fronte
  Amphibia: svg(
    '<circle cx="7.3" cy="7.6" r="3.1"/><circle cx="16.7" cy="7.6" r="3.1"/>' +
      '<path d="M3 15.5C3 11.3 7 9.6 12 9.6s9 1.7 9 5.9c0 3.4-4 5.4-9 5.4s-9-2-9-5.4z"/>',
  ),
  // Farfalla
  Insecta: svg(
    '<ellipse cx="7.2" cy="8.4" rx="4.6" ry="3.9" transform="rotate(-25 7.2 8.4)"/>' +
      '<ellipse cx="16.8" cy="8.4" rx="4.6" ry="3.9" transform="rotate(25 16.8 8.4)"/>' +
      '<ellipse cx="8.4" cy="16" rx="3.2" ry="2.9"/><ellipse cx="15.6" cy="16" rx="3.2" ry="2.9"/>' +
      '<rect x="11.2" y="5.5" width="1.6" height="14" rx=".8"/>',
  ),
};

// Binocolo: luoghi eBird
export const ICONA_BINOCOLO = svg(
  '<rect x="3.6" y="4.5" width="5.6" height="9" rx="2"/><rect x="14.8" y="4.5" width="5.6" height="9" rx="2"/>' +
    '<rect x="8.6" y="8.2" width="6.8" height="3.6" rx="1"/>' +
    '<circle cx="6.4" cy="15.4" r="4.6"/><circle cx="17.6" cy="15.4" r="4.6"/>',
);

export function iconaGruppo(id) {
  return ICONE_GRUPPI[id] || svg('<circle cx="12" cy="12" r="6"/>');
}
