// Gruppi di animali (i "taxa iconici" di iNaturalist) con colore sulla mappa.
// Il nome nella lingua scelta arriva dalle traduzioni (chiave gruppo.<id>).
// I colori evitano il blu (riservato alla mia posizione) e il verde (si perde sulla mappa).

import { t } from './i18n.js';

export const GRUPPI = [
  { id: 'Aves', colore: '#d6336c' },
  { id: 'Mammalia', colore: '#8a4b1f' },
  { id: 'Reptilia', colore: '#d98e04' },
  { id: 'Amphibia', colore: '#0b7d77' },
  { id: 'Insecta', colore: '#6f42c1' },
];

// Gruppi attivi al primo avvio (gli insetti si attivano dai filtri)
export const GRUPPI_PREDEFINITI = ['Aves', 'Mammalia', 'Reptilia', 'Amphibia'];

const PER_ID = Object.fromEntries(GRUPPI.map((g) => [g.id, g]));

export function gruppo(id) {
  const g = PER_ID[id];
  return g ? { ...g, nome: t(`gruppo.${id}`) } : { id, nome: t('gruppo.altro'), colore: '#666' };
}
