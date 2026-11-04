// Aides communes aux tests.
import { creerEtat, copier, geler, indice, cleSegment } from '../engine/index.js';

/** Anciens défauts (avant la décision de Lomig du 04/11, 11 h 39) : les tests écrits pour eux les épinglent. */
export const ANCIENS = { conflit: 'trajet', conflit_issue: 'annule', soutien: 'non' };

/**
 * Construit un état à la main.
 * pions = { A: [[x,y],...], B: [...] } ; couleurs = [[[x1,y1],[x2,y2],'A'], ...]
 */
export function etatAvec({ params = {}, pions = {}, couleurs = [], tour } = {}) {
  // Tests écrits pour le mode « un ordre par joueur » : on le fixe, sauf si le test demande `ordres`.
  const e = copier(creerEtat({ ordres: 'joueur', ...ANCIENS, ...params }));
  const n = e.params.grille;
  for (const j of ['A', 'B']) {
    e.pions[j] = (pions[j] || []).map(([x, y]) => indice(n, x, y));
    e.reserve[j] = e.params.nbPions - e.pions[j].length;
  }
  for (const [[x1, y1], [x2, y2], j] of couleurs) e.couleurs[cleSegment(indice(n, x1, y1), indice(n, x2, y2))] = j;
  if (tour) e.tour = tour;
  return geler(e);
}

/** Chemin (indices) à partir de coordonnées. */
export const ch = (n, pts) => pts.map(([x, y]) => indice(n, x, y));
/** Croisement (indice) à partir de coordonnées. */
export const cr = (n, x, y) => indice(n, x, y);
/** Codes du journal. */
export const codes = (journal) => journal.map((e) => e.code);
