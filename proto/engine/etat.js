// État de partie : objet de données pur (JSON-compatible), jamais muté.
// Chaque fonction du moteur retourne un NOUVEL état (copie profonde puis gel).

import { normaliserParametres, JOUEURS } from './params.js';
import { nbCases } from './grille.js';

/**
 * État initial (regles-proto.md §1) : plateau vide (choix proto `plateau_depart`),
 * 5 pions par joueur en réserve, aucune case possédée, aucun segment coloré.
 */
export function creerEtat(parametres = {}) {
  const params = normaliserParametres(parametres);
  return geler({
    params,
    tour: 1, // tour en cours, de 1 à params.nbTours
    pions: { A: [], B: [] }, // croisements occupés
    reserve: { A: params.nbPions, B: params.nbPions },
    retires: { A: 0, B: 0 }, // pions capturés sans retour
    couleurs: {}, // clé de segment -> 'A' | 'B' (les traces)
    proprietaires: new Array(nbCases(params.grille)).fill(null), // case -> null | 'A' | 'B'
    ctrl: { A: 0, B: 0 }, // croisements contrôlés (étape 8)
    fini: false,
    vainqueur: null, // 'A' | 'B' | 'nul'
    raisonFin: null, // 'seuil' | 'tours'
    historique: [], // { tour, ordres, journal }
  });
}

/** Copie profonde modifiable. */
export function copier(etat) {
  return typeof structuredClone === 'function' ? structuredClone(etat) : JSON.parse(JSON.stringify(etat));
}

/** Gel profond, pour garantir l'immutabilité. */
export function geler(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) geler(v);
  }
  return obj;
}

export const adversaire = (j) => (j === 'A' ? 'B' : 'A');
export const nomJoueur = (j) => `Joueur ${j}`;

/** Joueur dont un pion occupe le croisement i, ou null. */
export function occupant(etat, i) {
  for (const j of JOUEURS) if (etat.pions[j].includes(i)) return j;
  return null;
}

/** Nombre de cases possédées par j. */
export const casesPossedees = (etat, j) => etat.proprietaires.filter((p) => p === j).length;
