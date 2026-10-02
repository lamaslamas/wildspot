// Selettore del raggio di ricerca (5, 10, 25, 50 km).

export const RAGGI_KM = [5, 10, 25, 50];

// Crea i pulsanti dentro il contenitore e chiama `onCambio(km)` a ogni scelta
export function creaSelettoreRaggio(contenitore, raggioIniziale, onCambio) {
  const pulsanti = RAGGI_KM.map((km) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'radius-btn';
    btn.setAttribute('role', 'radio');
    btn.textContent = `${km} km`;
    btn.dataset.km = km;
    btn.addEventListener('click', () => {
      seleziona(km);
      onCambio(km);
    });
    contenitore.appendChild(btn);
    return btn;
  });

  function seleziona(km) {
    for (const btn of pulsanti) {
      btn.setAttribute('aria-checked', String(Number(btn.dataset.km) === km));
    }
  }

  seleziona(raggioIniziale);
}
