// Pannello a scomparsa dal basso ("bottom sheet"), riutilizzato per filtri,
// schede delle osservazioni e informazioni. Ne è aperto uno alla volta.

const elSheet = document.getElementById('sheet');
const elTitolo = document.getElementById('sheet-title');
const elCorpo = document.getElementById('sheet-body');
const btnChiudi = document.getElementById('sheet-close');

let allaChiusura = null;

// `contenuto` è un elemento DOM già costruito
export function apriSheet(titolo, contenuto, { onChiudi } = {}) {
  if (allaChiusura) allaChiusura(); // chiude "logicamente" il pannello precedente
  allaChiusura = onChiudi || null;
  elTitolo.textContent = titolo;
  elCorpo.replaceChildren(contenuto);
  elCorpo.scrollTop = 0;
  elSheet.classList.add('aperto');
  elSheet.setAttribute('aria-hidden', 'false');
}

export function chiudiSheet() {
  if (!elSheet.classList.contains('aperto')) return;
  elSheet.classList.remove('aperto');
  elSheet.setAttribute('aria-hidden', 'true');
  if (allaChiusura) allaChiusura();
  allaChiusura = null;
}

export function sheetAperto() {
  return elSheet.classList.contains('aperto');
}

btnChiudi.addEventListener('click', chiudiSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') chiudiSheet();
});
