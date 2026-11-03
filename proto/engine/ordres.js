// Ordres et validation (regles-proto.md §1 « Ordres » et étape 2).
// Un seul ordre par joueur et par tour :
//   { type: 'poser', croisement }
//   { type: 'deplacer', chemin: [c0, ..., ck], soutien?: croisement }   (c0 = un pion du joueur)
//   { type: 'passer' } choix proto (CDP 03/11) : ordre explicite « Passer » (bouton, ou automatique
//                      à la fin du chrono si aucun ordre n'a été donné) ; valide, ne fait rien, ne coupe rien.
//   { type: 'rien' }   ordre absent ou invalide (regles-proto.md étapes 1-2) ; même effet que « Passer ».
// La validation se fait sur l'état AU DÉBUT du tour (ordres simultanés, secrets).

import { estCroisementValide, sontAdjacents, segmentsDuChemin } from './grille.js';
import { occupant } from './etat.js';
import { longueurMax } from './params.js';

export const poser = (croisement) => ({ type: 'poser', croisement });
export const deplacer = (chemin, soutien) =>
  soutien == null ? { type: 'deplacer', chemin: chemin.slice() } : { type: 'deplacer', chemin: chemin.slice(), soutien };
export const rien = () => ({ type: 'rien' });
export const passer = () => ({ type: 'passer' });

/**
 * Valide un ordre de `joueur`.
 * @returns {{ok: true, ordre: object} | {ok: false, raison: string}}
 *   `ordre` est l'ordre normalisé (soutien ignoré s'il n'est pas valable).
 */
export function validerOrdre(etat, joueur, ordre) {
  const p = etat.params;
  const n = p.grille;
  const ko = (raison) => ({ ok: false, raison });
  if (etat.fini) return ko('La partie est terminée.');
  if (!ordre || ordre.type === 'rien') return { ok: true, ordre: rien() };
  if (ordre.type === 'passer') return { ok: true, ordre: passer() };

  if (ordre.type === 'poser') {
    const c = ordre.croisement;
    if (!estCroisementValide(n, c)) return ko('Croisement hors grille.');
    if (etat.reserve[joueur] <= 0) return ko('Plus de pion en réserve.');
    const occ = occupant(etat, c);
    // décision Lomig 03/11 (Q10) : on ne pose pas sur un croisement occupé par un pion, à soi ou à
    // l'adversaire. L'occupation se lit au début du tour, quand les ordres sont donnés : un croisement
    // que son pion quitte pendant ce tour reste interdit à la pose (lecture littérale, voir QUESTIONS.md).
    // (Remplace l'ordre conditionnel de regles-proto.md v0.2 étape 2 et le « veto » sur un départ.)
    if (occ === joueur) return ko('Croisement occupé par un de vos pions.');
    if (occ) return ko('Croisement occupé par un pion adverse : on ne pose que sur un croisement libre.');
    return { ok: true, ordre: poser(c) };
  }

  if (ordre.type === 'deplacer') {
    const ch = ordre.chemin;
    if (!Array.isArray(ch) || ch.length < 2) return ko('Un trajet compte au moins 1 segment.');
    for (const c of ch) if (!estCroisementValide(n, c)) return ko('Trajet hors grille.');
    if (occupant(etat, ch[0]) !== joueur) return ko('Le trajet doit partir d’un de vos pions.');
    for (let k = 1; k < ch.length; k++) {
      if (!sontAdjacents(n, ch[k - 1], ch[k])) return ko('Le trajet suit les traits, de croisement voisin en croisement voisin.');
    }
    const segs = segmentsDuChemin(ch);
    if (new Set(segs).size !== segs.length) return ko('Le trajet emprunte deux fois le même segment.');
    if (p.repasser_croisement === 'non' && new Set(ch).size !== ch.length) {
      return ko('Le trajet repasse par un croisement (réglage « Repasser par un croisement » : interdit).');
    }
    // décision Lomig 03/11 : au plus trajet_max segments (5 par défaut) ; au-delà, l'ordre est invalide.
    if (segs.length > longueurMax(p)) return ko(`Trajet trop long (max ${longueurMax(p)} segments).`);
    for (let k = 1; k < ch.length; k++) {
      const occ = occupant(etat, ch[k]);
      // Son propre croisement de départ peut être retraversé (boucle, regles-proto.md §1).
      // Un autre pion allié ne bouge pas ce tour (un seul ordre) : il est infranchissable.
      if (occ === joueur && ch[k] !== ch[0]) return ko('Le trajet passe par un de vos pions.');
      // regles-proto.md v0.2 : un croisement de pion ADVERSE est accepté (ordre conditionnel).
      // décision Lomig 03/11 : la résolution tranche : s'arrêter sur son départ libéré ou le traverser
      // réussit (réglage depart_libere), et un pion qui ne part pas n'est jamais traversé ni rejoint.
    }
    let soutien;
    if (p.soutien === 'oui' && ordre.soutien != null) {
      // Étape 2 : un soutien non adjacent au départ (ou qui n'est pas un pion du joueur) est ignoré.
      const s = ordre.soutien;
      if (estCroisementValide(n, s) && s !== ch[0] && occupant(etat, s) === joueur && sontAdjacents(n, s, ch[0])) soutien = s;
    }
    return { ok: true, ordre: deplacer(ch, soutien) };
  }

  return ko('Type d’ordre inconnu.');
}

/** Vrai si l'ordre est valide (raccourci). */
export const estValide = (etat, joueur, ordre) => validerOrdre(etat, joueur, ordre).ok;

