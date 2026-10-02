// Piccolo wrapper su localStorage: tutte le chiavi hanno il prefisso "wildspot:"
// e gli errori (modalità privata, spazio esaurito) non bloccano l'app.

const PREFISSO = 'wildspot:';

export function leggi(chiave, predefinito) {
  try {
    const valore = localStorage.getItem(PREFISSO + chiave);
    return valore === null ? predefinito : JSON.parse(valore);
  } catch {
    return predefinito;
  }
}

export function scrivi(chiave, valore) {
  try {
    localStorage.setItem(PREFISSO + chiave, JSON.stringify(valore));
  } catch {
    // Ignoriamo: il dato semplicemente non verrà ricordato
  }
}
