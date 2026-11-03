// IA faible : choisit au hasard un ordre LÉGAL (chaque candidat passe par validerOrdre).
// Aucune stratégie : elle sert seulement à tester les règles en solo.
// Elle n'utilise pas le soutien (pas de règle d'IA écrite pour cela).

import { voisins, nbCroisements } from '../engine/grille.js';
import { validerOrdre, poser, deplacer, rien, passer } from '../engine/ordres.js';

/** Poses légales pour `joueur`. */
export function posesLegales(etat, joueur) {
  const res = [];
  for (let c = 0; c < nbCroisements(etat.params.grille); c++) {
    if (validerOrdre(etat, joueur, poser(c)).ok) res.push(poser(c));
  }
  return res;
}

/** Marche au hasard le long des traits ; chaque prolongement est validé par le moteur. */
export function trajetAleatoire(etat, joueur, depart, rng, longueurVisee) {
  const n = etat.params.grille;
  let chemin = [depart];
  let valide = null;
  for (let pas = 0; pas < longueurVisee; pas++) {
    let prolonge = false;
    for (const v of rng.melanger(voisins(n, chemin[chemin.length - 1]))) {
      const essai = [...chemin, v];
      if (validerOrdre(etat, joueur, deplacer(essai)).ok) {
        chemin = essai;
        valide = essai;
        prolonge = true;
        break;
      }
    }
    if (!prolonge) break;
  }
  return valide ? deplacer(valide) : null;
}

/**
 * Ordre légal au hasard (ou « rien » si aucun n'est possible).
 * @param {object} etat état gelé
 * @param {'A'|'B'} joueur
 * @param {object} rng générateur à graine (engine/rng.js)
 */
export function choisirOrdre(etat, joueur, rng) {
  if (etat.fini) return rien();
  // choix proto (CDP 03/11) : l'IA peut aussi « Passer » (rarement : 1 fois sur 20).
  if (rng.reel() < 0.05) return passer();
  const poses = posesLegales(etat, joueur);
  const pions = etat.pions[joueur];
  const tenterDeplacement = pions.length > 0 && (poses.length === 0 || rng.reel() < 0.5);
  if (tenterDeplacement) {
    for (const depart of rng.melanger(pions)) {
      const o = trajetAleatoire(etat, joueur, depart, rng, 1 + rng.entier(etat.params.grille));
      if (o) return o;
    }
  }
  if (poses.length) return rng.choisir(poses);
  return passer();
}
