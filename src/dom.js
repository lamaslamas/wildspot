// Piccole utilità per costruire l'interfaccia senza framework.

// Crea un elemento: el('a', { href: '…', class: 'x' }, 'testo', altroElemento)
// I figli di tipo stringa diventano nodi di testo, quindi sono sempre sicuri
// anche se arrivano da un'API esterna.
export function el(tag, attributi = {}, ...figli) {
  const nodo = document.createElement(tag);
  for (const [nome, valore] of Object.entries(attributi)) {
    if (valore === false || valore === null || valore === undefined) continue;
    if (nome.startsWith('on') && typeof valore === 'function') {
      nodo.addEventListener(nome.slice(2), valore);
    } else if (nome === 'class') {
      nodo.className = valore;
    } else {
      nodo.setAttribute(nome, valore === true ? '' : valore);
    }
  }
  for (const figlio of figli.flat()) {
    if (figlio === null || figlio === undefined || figlio === false) continue;
    nodo.append(figlio instanceof Node ? figlio : String(figlio));
  }
  return nodo;
}

// Rinvia l'esecuzione finché le chiamate non si fermano per `attesaMs`
export function debounce(funzione, attesaMs) {
  let timer;
  return (...argomenti) => {
    clearTimeout(timer);
    timer = setTimeout(() => funzione(...argomenti), attesaMs);
  };
}

// Distanza in km tra due punti (formula dell'emisenoverso)
export function distanzaKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
