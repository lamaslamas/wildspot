// Gruppi di animali (i "taxa iconici" di iNaturalist) con nome italiano e colore sulla mappa.
// I colori evitano il blu (riservato alla mia posizione) e il verde (si perde sulla mappa).

export const GRUPPI = [
  { id: 'Aves', nome: 'Uccelli', colore: '#d6336c' },
  { id: 'Mammalia', nome: 'Mammiferi', colore: '#8a4b1f' },
  { id: 'Reptilia', nome: 'Rettili', colore: '#d98e04' },
  { id: 'Amphibia', nome: 'Anfibi', colore: '#0b7d77' },
  { id: 'Insecta', nome: 'Insetti', colore: '#6f42c1' },
];

// Gruppi attivi al primo avvio (gli insetti si attivano dai filtri)
export const GRUPPI_PREDEFINITI = ['Aves', 'Mammalia', 'Reptilia', 'Amphibia'];

const PER_ID = Object.fromEntries(GRUPPI.map((g) => [g.id, g]));

export function gruppo(id) {
  return PER_ID[id] || { id, nome: id || 'Altro', colore: '#666' };
}
