// Géométrie de la grille de traits.
// On joue sur les CROISEMENTS : une grille de taille n a n x n croisements,
// numérotés i = y * n + x (x = colonne, y = ligne, origine en haut à gauche).
// Deux croisements sont adjacents s'ils sont voisins orthogonaux (un segment de trait les relie).

/** Nombre de croisements. */
export const nbCroisements = (n) => n * n;

/** Indice -> coordonnées. */
export const coord = (n, i) => ({ x: i % n, y: Math.floor(i / n) });

/** Coordonnées -> indice (ou -1 si hors grille). */
export const indice = (n, x, y) => (estDansGrille(n, x, y) ? y * n + x : -1);

export const estDansGrille = (n, x, y) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < n && y < n;

export const estCroisementValide = (n, i) => Number.isInteger(i) && i >= 0 && i < n * n;

/** Voisins orthogonaux d'un croisement (ordre : haut, droite, bas, gauche). */
export function voisins(n, i) {
  const { x, y } = coord(n, i);
  const res = [];
  if (y > 0) res.push(i - n);
  if (x < n - 1) res.push(i + 1);
  if (y < n - 1) res.push(i + n);
  if (x > 0) res.push(i - 1);
  return res;
}

/** Vrai si a et b sont reliés par un segment de trait. */
export function sontAdjacents(n, a, b) {
  if (!estCroisementValide(n, a) || !estCroisementValide(n, b)) return false;
  const A = coord(n, a);
  const B = coord(n, b);
  return Math.abs(A.x - B.x) + Math.abs(A.y - B.y) === 1;
}

/** Clé canonique d'un segment (indépendante du sens). */
export const cleSegment = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Liste des clés de segments d'un chemin [c0, c1, ...]. */
export function segmentsDuChemin(chemin) {
  const res = [];
  for (let k = 1; k < chemin.length; k++) res.push(cleSegment(chemin[k - 1], chemin[k]));
  return res;
}

/** Vrai si le croisement est sur le bord de la grille. */
export function estSurBord(n, i) {
  const { x, y } = coord(n, i);
  return x === 0 || y === 0 || x === n - 1 || y === n - 1;
}

/**
 * Chemin en ligne droite de a vers b s'ils sont sur la même ligne ou colonne
 * (a exclu, b inclus). Utile à la saisie quand le doigt va vite. null sinon.
 */
export function cheminDroit(n, a, b) {
  const A = coord(n, a);
  const B = coord(n, b);
  if (A.x !== B.x && A.y !== B.y) return null;
  const dx = Math.sign(B.x - A.x);
  const dy = Math.sign(B.y - A.y);
  const res = [];
  let { x, y } = A;
  while (x !== B.x || y !== B.y) {
    x += dx;
    y += dy;
    res.push(y * n + x);
  }
  return res;
}

/**
 * Composantes connexes (adjacence orthogonale) d'un ensemble de croisements.
 * @param {number} n taille
 * @param {(i:number)=>boolean} inclus prédicat d'appartenance
 * @returns {number[][]} composantes (indices triés)
 */
export function composantesConnexes(n, inclus) {
  const vu = new Uint8Array(n * n);
  const comps = [];
  for (let s = 0; s < n * n; s++) {
    if (vu[s] || !inclus(s)) continue;
    const comp = [];
    const pile = [s];
    vu[s] = 1;
    while (pile.length) {
      const c = pile.pop();
      comp.push(c);
      for (const v of voisins(n, c)) {
        if (!vu[v] && inclus(v)) {
          vu[v] = 1;
          pile.push(v);
        }
      }
    }
    comps.push(comp.sort((a, b) => a - b));
  }
  return comps;
}

// ---------------------------------------------------------------------------
// Cases (regles-proto.md §0) : carré délimité par 4 croisements.
// Une grille de N×N croisements a (N−1)² cases. La case (i, j) a pour coins (i, j) et (i+1, j+1).
// Numérotation k = j * (N−1) + i.
// ---------------------------------------------------------------------------

export const nbCases = (n) => (n - 1) * (n - 1);
export const coordCase = (n, k) => ({ i: k % (n - 1), j: Math.floor(k / (n - 1)) });
export const indiceCase = (n, i, j) => (i >= 0 && j >= 0 && i < n - 1 && j < n - 1 ? j * (n - 1) + i : -1);

/**
 * Côtés d'une case : pour chacun, le segment (clé) et la case voisine de l'autre côté
 * (-1 si ce côté est sur le bord).
 */
export function cotesCase(n, k) {
  const { i, j } = coordCase(n, k);
  const c = (x, y) => y * n + x;
  return [
    { segment: cleSegment(c(i, j), c(i + 1, j)), voisine: indiceCase(n, i, j - 1) }, // haut
    { segment: cleSegment(c(i + 1, j), c(i + 1, j + 1)), voisine: indiceCase(n, i + 1, j) }, // droite
    { segment: cleSegment(c(i, j + 1), c(i + 1, j + 1)), voisine: indiceCase(n, i, j + 1) }, // bas
    { segment: cleSegment(c(i, j), c(i, j + 1)), voisine: indiceCase(n, i - 1, j) }, // gauche
  ];
}

/** Cases qui touchent un croisement (2 à 4 selon sa position ; 1 dans un coin). */
export function casesAutourCroisement(n, c) {
  const { x, y } = coord(n, c);
  return [indiceCase(n, x - 1, y - 1), indiceCase(n, x, y - 1), indiceCase(n, x - 1, y), indiceCase(n, x, y)].filter((k) => k >= 0);
}

/** Vrai si le segment est sur le bord de la grille. */
export function estSegmentDuBord(n, cle) {
  const [a, b] = cle.split('-').map(Number);
  const A = coord(n, a);
  const B = coord(n, b);
  if (A.y === B.y) return A.y === 0 || A.y === n - 1;
  return A.x === 0 || A.x === n - 1;
}
