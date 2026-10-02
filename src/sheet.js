// Pannello a scomparsa dal basso ("bottom sheet"), riutilizzato per filtri,
// schede delle osservazioni e informazioni. Ne è aperto uno alla volta.
// Si apre a metà schermo; con la maniglia o trascinando la testata verso
// l'alto si allarga, trascinandola verso il basso si riduce o si chiude.

const elSheet = document.getElementById('sheet');
const elTitolo = document.getElementById('sheet-title');
const elCorpo = document.getElementById('sheet-body');
const btnChiudi = document.getElementById('sheet-close');
const maniglia = document.getElementById('sheet-handle');
const testata = elSheet.querySelector('.sheet-head');

let allaChiusura = null;

// `contenuto` è un elemento DOM già costruito
// `classe` aggiunge una variante di stile (es. 'sheet-basso' per lasciare più mappa visibile)
export function apriSheet(titolo, contenuto, { onChiudi, classe } = {}) {
  if (allaChiusura) allaChiusura(); // chiude "logicamente" il pannello precedente
  allaChiusura = onChiudi || null;
  elTitolo.textContent = titolo;
  elCorpo.replaceChildren(contenuto);
  elCorpo.scrollTop = 0;
  elSheet.className = `sheet aperto ${classe || ''}`.trim(); // si riapre sempre a metà schermo
  document.body.classList.add('pannello-aperto'); // su desktop sposta i comandi a sinistra della mappa
  aggiornaManiglia();
  elSheet.setAttribute('aria-hidden', 'false');
}

export function chiudiSheet() {
  if (!elSheet.classList.contains('aperto')) return;
  elSheet.classList.remove('aperto');
  document.body.classList.remove('pannello-aperto');
  elSheet.setAttribute('aria-hidden', 'true');
  if (allaChiusura) allaChiusura();
  allaChiusura = null;
}

export function sheetAperto() {
  return elSheet.classList.contains('aperto');
}

function espandi(si) {
  elSheet.classList.toggle('espanso', si);
  aggiornaManiglia();
}

function aggiornaManiglia() {
  const espanso = elSheet.classList.contains('espanso');
  maniglia.setAttribute('aria-expanded', String(espanso));
}

btnChiudi.addEventListener('click', chiudiSheet);
maniglia.addEventListener('click', () => espandi(!elSheet.classList.contains('espanso')));

// Trascinamento verticale della maniglia o della testata
let inizioY = null;
for (const zona of [maniglia, testata]) {
  zona.addEventListener('touchstart', (e) => (inizioY = e.touches[0].clientY), { passive: true });
  zona.addEventListener('touchend', (e) => {
    if (inizioY === null) return;
    const spostamento = e.changedTouches[0].clientY - inizioY;
    inizioY = null;
    if (spostamento < -40) espandi(true);
    else if (spostamento > 60) {
      if (elSheet.classList.contains('espanso')) espandi(false);
      else chiudiSheet();
    }
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') chiudiSheet();
});
