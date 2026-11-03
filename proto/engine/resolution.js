// Résolution d'un tour : regles-proto.md §2 (9 étapes), variantes §3, cas limites §4,
// et décisions CDP du 03/11 (marquées « choix proto (CDP 03/11) »).
// Chaque étape est une fonction séparée et exportée (testable seule).

import {
  coord, segmentsDuChemin, nbCases, nbCroisements, cotesCase, casesAutourCroisement,
} from './grille.js';
import { copier, geler, adversaire, occupant, nomJoueur, casesPossedees } from './etat.js';
import { validerOrdre } from './ordres.js';
import { JOUEURS, seuilCroisements } from './params.js';

/** Entrée de journal lisible. */
export const entree = (tour, code, texte, extra = {}) => ({ tour, code, texte, ...extra });

/** « (x, y) » pour le journal. */
export function nomCroisement(n, c) {
  const { x, y } = coord(n, c);
  return `(${x}, ${y})`;
}

// ---------------------------------------------------------------------------
// Étapes 1 et 2 : lecture et validation
// ---------------------------------------------------------------------------

/** Ordre absent ou invalide -> RIEN (étapes 1 et 2). Retourne les ordres normalisés. */
export function lireEtValider(etat, ordres) {
  const journal = [];
  const lus = {};
  for (const j of JOUEURS) {
    const o = ordres?.[j];
    if (o?.type === 'passer') {
      lus[j] = { type: 'passer' };
      journal.push(entree(etat.tour, 'PASSE', `${nomJoueur(j)} passe.`, { joueur: j }));
      continue;
    }
    if (!o || o.type === 'rien') {
      lus[j] = { type: 'rien' };
      journal.push(entree(etat.tour, 'RIEN', `${nomJoueur(j)} : rien.`, { joueur: j }));
      continue;
    }
    const v = validerOrdre(etat, j, o);
    if (v.ok) lus[j] = v.ordre;
    else {
      lus[j] = { type: 'rien' };
      journal.push(entree(etat.tour, 'INVALIDE', `${nomJoueur(j)} : ordre invalide (${v.raison}), remplacé par « rien ».`, { joueur: j }));
    }
  }
  return { ordres: lus, journal };
}

// ---------------------------------------------------------------------------
// Étape 3 : coupures, avec annulations en chaîne
// ---------------------------------------------------------------------------

/**
 * Croisements communs aux deux trajets qui comptent comme une RENCONTRE.
 * décision Lomig 03/11 (réglage `depart_libere`) :
 *  - 'traversee' (défaut, = regles-proto.md v0.2) : le croisement de départ ne compte pas dans
 *    croisements(t), sauf si le trajet y revient plus loin. On peut donc s'arrêter sur le départ
 *    que quitte le pion adverse, ou le traverser.
 *  - 'arrivee_seule' (ancien choix CDP) : on peut seulement FINIR sur ce départ. Le croisement est
 *    exempté s'il n'apparaît qu'à la DERNIÈRE position d'un trajet et qu'à la PREMIÈRE de l'autre ;
 *    y passer est une rencontre.
 */
export function croisementsDeRencontre(tA, tB, mode = 'traversee') {
  if (mode === 'traversee') {
    const sB = new Set(tB.slice(1));
    return [...new Set(tA.slice(1))].filter((c) => sB.has(c));
  }
  const seulementA = (t, c, pos) => t.every((x, k) => x !== c || k === pos);
  const exempt = (c) =>
    (seulementA(tA, c, tA.length - 1) && seulementA(tB, c, 0)) ||
    (seulementA(tB, c, tB.length - 1) && seulementA(tA, c, 0));
  const setB = new Set(tB);
  return [...new Set(tA)].filter((c) => setB.has(c) && !exempt(c));
}

/** Segments (non orientés) communs aux deux trajets. */
export function segmentsCommuns(tA, tB) {
  const sA = new Set(segmentsDuChemin(tA));
  return segmentsDuChemin(tB).filter((s) => sA.has(s));
}

/**
 * Étape 3 : applique 3a, 3b, 3c puis 3d (croisements libérés), en boucle jusqu'à stabilité.
 * choix proto (CDP 03/11) : cette boucle unique remplace la cascade de l'étape 3d de
 * regles-proto.md v0.2. Comme retirer un ordre ne crée jamais de nouvelle rencontre, le premier
 * passage de 3a–3c se fait bien « sur les ordres d'origine », et le résultat est le même.
 * @returns {{actifs: {A: object|null, B: object|null}, journal: object[]}}
 */
export function resoudreCoupures(etat, ordres) {
  const p = etat.params;
  const n = p.grille;
  const tour = etat.tour;
  const nc = (c) => nomCroisement(n, c);
  const journal = [];
  const actifs = {};
  for (const j of JOUEURS) actifs[j] = ordres[j] && ordres[j].type !== 'rien' && ordres[j].type !== 'passer' ? ordres[j] : null;

  const trajet = (j) => (actifs[j]?.type === 'deplacer' ? actifs[j].chemin : null);
  const pose = (j) => (actifs[j]?.type === 'poser' ? actifs[j].croisement : null);
  const soutenu = (j) => p.soutien === 'oui' && actifs[j]?.type === 'deplacer' && actifs[j].soutien != null;
  const libelle = (j) => (actifs[j]?.type === 'poser' ? 'la pose' : 'le déplacement');
  const annuler = (j, code, cause) => {
    journal.push(entree(tour, code, `${nomJoueur(j)} : ${libelle(j)} est annulé${actifs[j].type === 'poser' ? 'e' : ''} — ${cause}`, { joueur: j }));
    actifs[j] = null;
  };

  for (let garde = 0; garde < 10; garde++) {
    let change = false;

    // 3a. DÉPLACER / DÉPLACER : rencontre sur un croisement ou un segment.
    const tA = trajet('A');
    const tB = trajet('B');
    if (tA && tB) {
      const segs = segmentsCommuns(tA, tB);
      const crs = croisementsDeRencontre(tA, tB, p.depart_libere);
      if (segs.length || crs.length) {
        const ou = segs.length
          ? `rencontre sur le segment ${segs[0].split('-').map((c) => nc(+c)).join('–')}`
          : `rencontre au croisement ${nc(crs[0])}`;
        if (soutenu('A') !== soutenu('B')) {
          // Soutien (§3) : seul le trajet non soutenu est annulé.
          const perdant = soutenu('A') ? 'B' : 'A';
          annuler(perdant, 'RENCONTRE', `${ou} ; le trajet adverse est soutenu.`);
        } else {
          annuler('A', 'RENCONTRE', `${ou}.`);
          annuler('B', 'RENCONTRE', `${ou}.`);
        }
        change = true;
      }
    }
    if (change) continue;

    // 3b. POSER(c) / DÉPLACER(t) : pose sur un croisement du trajet adverse.
    for (const P of JOUEURS) {
      const Q = adversaire(P);
      const c = pose(P);
      const t = trajet(Q);
      if (c == null || !t || !t.includes(c)) continue;
      // décision Lomig 03/11 (Q10) : une pose sur le départ t[0] est illégale (croisement occupé au
      // début du tour, refusée par validerOrdre), donc c est un croisement libre du trajet.
      if (soutenu(Q)) {
        // Soutien (§3) : une pose sur un trajet soutenu ne le coupe pas ; la pose est annulée.
        annuler(P, 'COUPURE', `pose en ${nc(c)} sur un trajet soutenu : le trajet s’exécute.`);
      } else {
        annuler(Q, 'COUPURE', `${nomJoueur(P)} pose en ${nc(c)}, sur son trajet.`);
        if (p.pose_coupante === 'annulee') annuler(P, 'COUPURE', `la pose en ${nc(c)} a coupé un trajet (réglage « pose qui coupe » : annulée).`);
        else journal.push(entree(tour, 'COUPURE', `${nomJoueur(P)} : la pose en ${nc(c)} est maintenue (réglage « pose qui coupe » : maintenue).`, { joueur: P }));
      }
      change = true;
      break;
    }
    if (change) continue;

    // 3c. POSER(c) / POSER(c) : les deux annulées (choix proto `poses_meme_croisement`).
    if (pose('A') != null && pose('A') === pose('B')) {
      const c = pose('A');
      annuler('A', 'POSES', `les deux joueurs posent en ${nc(c)}.`);
      annuler('B', 'POSES', `les deux joueurs posent en ${nc(c)}.`);
      continue;
    }

    // 3d. Croisements libérés (chaîne) : un ordre qui vise le croisement d'un pion adverse est
    // annulé si ce pion ne part pas (v0.2) ; le soutien n'en protège pas (v0.2 §3).
    // décision Lomig 03/11 : si le pion adverse ne part pas (il ne bouge pas, ou son ordre est
    // annulé), l'ordre qui visait OU traversait son croisement est annulé ; boucle jusqu'à stabilité.
    for (const P of JOUEURS) {
      const Q = adversaire(P);
      const tQ = trajet(Q);
      const part = (c) => tQ != null && tQ[0] === c;
      const t = trajet(P);
      if (t) {
        const bloque = t.slice(1).find((c) => occupant(etat, c) === Q && !part(c));
        if (bloque != null) {
          annuler(P, 'CHAINE', `le pion adverse en ${nc(bloque)} ne bouge pas : il ne peut être ni traversé ni rejoint.`);
          change = true;
          break;
        }
      }
      const c = pose(P);
      if (c != null && occupant(etat, c) === Q && !part(c)) {
        annuler(P, 'CHAINE', `le croisement ${nc(c)} reste occupé par un pion adverse.`);
        change = true;
        break;
      }
    }
    if (!change) break;
  }
  return { actifs, journal };
}

// ---------------------------------------------------------------------------
// Étape 4 : exécution simultanée
// ---------------------------------------------------------------------------

/**
 * Exécute les ordres restants sur `brouillon` (copie modifiable).
 * @returns {{nouveaux: {A:Set,B:Set}, trajets: {A:Set,B:Set}, journal: object[]}}
 *   nouveaux(P) = segments colorés par P à ce tour ; trajets(P) = segments du trajet de P.
 */
export function executer(brouillon, actifs) {
  const p = brouillon.params;
  const n = p.grille;
  const tour = brouillon.tour;
  const journal = [];
  const nouveaux = { A: new Set(), B: new Set() };
  const trajets = { A: new Set(), B: new Set() };
  const couleursAvant = { ...brouillon.couleurs };
  for (const P of JOUEURS) {
    const o = actifs[P];
    if (!o) continue;
    if (o.type === 'poser') {
      brouillon.pions[P].push(o.croisement);
      brouillon.reserve[P] -= 1;
      journal.push(entree(tour, 'POSE', `${nomJoueur(P)} pose un pion en ${nomCroisement(n, o.croisement)}.`, { joueur: P, croisement: o.croisement }));
    } else if (o.type === 'deplacer') {
      const ch = o.chemin;
      const depart = ch[0];
      const arrivee = ch[ch.length - 1];
      brouillon.pions[P] = brouillon.pions[P].map((c) => (c === depart ? arrivee : c));
      for (const s of segmentsDuChemin(ch)) {
        trajets[P].add(s);
        const avant = couleursAvant[s];
        // Réglage `trace_adverse` : « recolore » (défaut) ou « garde ».
        if (avant && avant !== P && p.trace_adverse === 'garde') continue;
        // A CONFIRMER (regles-proto.md) : un segment déjà à P et reparcouru compte-t-il dans
        // nouveaux(P) ? Provisoire : oui (il « prend la couleur du joueur » à ce tour).
        brouillon.couleurs[s] = P;
        nouveaux[P].add(s);
      }
      journal.push(entree(tour, 'DEPLACEMENT', `${nomJoueur(P)} déplace un pion de ${nomCroisement(n, depart)} à ${nomCroisement(n, arrivee)} (${ch.length - 1} segment${ch.length > 2 ? 's' : ''}).`, { joueur: P, chemin: ch.slice() }));
    }
  }
  return { nouveaux, trajets, journal };
}

// ---------------------------------------------------------------------------
// Étape 5 : fermetures
// ---------------------------------------------------------------------------

/**
 * Régions de cases pour un prédicat de mur (remplissage 4-connexe ; le bord est implicite).
 * @returns {number[][]}
 */
export function regions(n, estMur) {
  const N = nbCases(n);
  const vu = new Uint8Array(N);
  const res = [];
  for (let s = 0; s < N; s++) {
    if (vu[s]) continue;
    const r = [];
    const pile = [s];
    vu[s] = 1;
    while (pile.length) {
      const k = pile.pop();
      r.push(k);
      for (const { segment, voisine } of cotesCase(n, k)) {
        if (voisine >= 0 && !vu[voisine] && !estMur(segment)) {
          vu[voisine] = 1;
          pile.push(voisine);
        }
      }
    }
    res.push(r.sort((a, b) => a - b));
  }
  return res;
}

/**
 * Zones de P : toutes les régions sauf le dehors, la (les) plus grande(s) (choix proto `dehors_egalite`).
 * Réglage `traces` : « bord_de_zone » -> murs = bord + segments de couleur P ;
 * « decoratives » -> murs = bord + segments du seul trajet de P à ce tour.
 * Réglage `zone_regle` (Q7, demande CDP 03/11, défaut « actuel » inchangé) :
 * - actuel : dehors = plus grande(s) région(s) en nombre de cases ;
 * - sans_pion_adverse : idem, et une région avec un pion adverse sur un croisement INTÉRIEUR
 *   (ses 4 cases dans la région) n'est pas une zone. Choix : un pion sur le bord de la région
 *   (sur un mur de P ou au bord du plateau) ne l'empêche pas (à confirmer) ;
 * - dehors_non_possede : dehors = la (les) région(s) qui ont le plus de cases non possédées par P ;
 * - moitie_libre : idem actuel, et une zone fait au plus la moitié des cases que P ne possède pas
 *   (taille = toutes ses cases, comparée au nombre de cases du plateau non possédées par P).
 * Les pions lus sont ceux de l'état passé (après les déplacements et poses du tour, avant captures).
 */
export function zonesDe(etat, P, trajetP = new Set()) {
  const n = etat.params.grille;
  const estMur = etat.params.traces === 'decoratives' ? (s) => trajetP.has(s) : (s) => etat.couleurs[s] === P;
  const rs = regions(n, estMur);
  const regle = etat.params.zone_regle || 'actuel';
  const nonPossede = (r) => r.reduce((t, k) => t + (etat.proprietaires[k] === P ? 0 : 1), 0);
  if (regle === 'dehors_non_possede') {
    const tailles = rs.map(nonPossede);
    const max = Math.max(...tailles);
    return rs.filter((_, i) => tailles[i] < max);
  }
  const max = Math.max(...rs.map((r) => r.length));
  let zs = rs.filter((r) => r.length < max);
  if (regle === 'sans_pion_adverse') {
    const Q = adversaire(P);
    zs = zs.filter((z) => {
      const dans = new Set(z);
      return !etat.pions[Q].some((c) => {
        const cases = casesAutourCroisement(n, c);
        return cases.length === 4 && cases.every((k) => dans.has(k));
      });
    });
  } else if (regle === 'moitie_libre') {
    const libres = etat.proprietaires.reduce((t, p) => t + (p === P ? 0 : 1), 0);
    zs = zs.filter((z) => 2 * z.length <= libres);
  }
  return zs;
}

/**
 * Étape 5 pour un joueur : zones fermées à ce tour et gain.
 * Une zone est fermée si au moins un segment de nouveaux(P) sépare une de ses cases
 * d'une case extérieure à elle.
 */
export function fermeturesDe(etat, P, nouveauxP, trajetP) {
  const n = etat.params.grille;
  const fermees = [];
  for (const z of zonesDe(etat, P, trajetP)) {
    const dans = new Set(z);
    const ferme = z.some((k) => cotesCase(n, k).some(({ segment, voisine }) => voisine >= 0 && !dans.has(voisine) && nouveauxP.has(segment)));
    if (ferme) fermees.push(z);
  }
  // Réglage `reprise` (regles-proto.md §3, étape 5) : « non » -> seulement les cases sans propriétaire
  // (le territoire est alors acquis pour toujours) ; « oui » (décision Lomig 03/11, défaut) -> toutes
  // les cases de la zone fermée, y compris celles de l'adversaire : seules les cases COUVERTES par la
  // zone changent de main (reprise par morceaux). « Territoire acquis » reste vrai dans les deux cas :
  // une case ne se perd jamais parce que ses murs disparaissent, seulement par une reprise adverse.
  const gain = new Set();
  for (const z of fermees) {
    for (const k of z) {
      const proprio = etat.proprietaires[k];
      if (etat.params.reprise !== 'oui') {
        if (proprio === null) gain.add(k);
      } else if (proprio !== P || etat.params.reprise_meme_tour === 'defense') {
        // A CONFIRMER (regles-proto.md) : avec « defense », ses propres cases sont aussi dans le gain,
        // pour qu'une case disputée au même tour reste à son propriétaire (étape 6).
        gain.add(k);
      }
    }
  }
  return { fermees, gain };
}

// ---------------------------------------------------------------------------
// Étapes 6 à 9
// ---------------------------------------------------------------------------

/**
 * Étape 6 : attribution simultanée (une case gagnée par les deux garde son propriétaire d'avant).
 * Les cases prises à l'adversaire (reprise) sont journalisées à part, avec leur liste (`cases`),
 * pour que l'interface les fasse clignoter.
 */
export function attribuer(brouillon, gains) {
  const journal = [];
  const nouvelles = { A: 0, B: 0 };
  const reprises = { A: [], B: [] };
  const avant = brouillon.proprietaires.slice(); // attribution sur l'état d'avant l'étape 6
  for (const P of JOUEURS) {
    for (const k of gains[P]) {
      if (gains[adversaire(P)].has(k)) continue;
      if (avant[k] === P) continue; // déjà à P : rien ne change
      if (avant[k] === adversaire(P)) reprises[P].push(k);
      else nouvelles[P]++;
      brouillon.proprietaires[k] = P;
    }
  }
  for (const P of JOUEURS) {
    const nb = nouvelles[P];
    if (nb) journal.push(entree(brouillon.tour, 'ZONE', `${nomJoueur(P)} ferme une zone et gagne ${nb} case${nb > 1 ? 's' : ''}.`, { joueur: P }));
    const r = reprises[P].length;
    // décision Lomig 03/11 : une ligne de journal par reprise.
    if (r) journal.push(entree(brouillon.tour, 'REPRISE', `${nomJoueur(P)} reprend ${r} case${r > 1 ? 's' : ''} à ${nomJoueur(adversaire(P))}.`, { joueur: P, cases: reprises[P].slice().sort((a, b) => a - b) }));
  }
  return journal;
}

/** Étape 7 : captures (réglage `capture`), calculées en parallèle puis appliquées ensemble. */
export function capturer(brouillon, fermees) {
  const p = brouillon.params;
  const n = p.grille;
  const journal = [];
  if (p.capture === 'aucune') return journal;
  const captures = []; // { victime, croisement }
  for (const P of JOUEURS) {
    const Q = adversaire(P);
    for (const c of brouillon.pions[Q]) {
      const cases = casesAutourCroisement(n, c);
      const z = fermees[P].find((zone) => zone.includes(cases[0]));
      if (z && cases.every((k) => z.includes(k) && brouillon.proprietaires[k] === P)) captures.push({ victime: Q, croisement: c });
    }
  }
  for (const { victime, croisement } of captures) {
    brouillon.pions[victime] = brouillon.pions[victime].filter((c) => c !== croisement);
    if (p.capture === 'retour') brouillon.reserve[victime] += 1;
    else brouillon.retires[victime] += 1;
    journal.push(entree(brouillon.tour, 'CAPTURE', `Le pion de ${nomJoueur(victime)} en ${nomCroisement(n, croisement)} est capturé${p.capture === 'retour' ? ' et retourne en réserve' : ' et quitte la partie'}.`, { joueur: victime, croisement }));
  }
  return journal;
}

/**
 * Croisements contrôlés par chaque joueur (réglage `comptage`).
 * « frontiere » : au moins une case voisine à P et aucune à l'adversaire.
 * « interieur » : toutes les cases voisines à P.
 */
export function croisementsControles(etat) {
  const n = etat.params.grille;
  const res = { A: [], B: [] };
  for (let c = 0; c < nbCroisements(n); c++) {
    const props = casesAutourCroisement(n, c).map((k) => etat.proprietaires[k]);
    for (const P of JOUEURS) {
      const ok = etat.params.comptage === 'interieur'
        ? props.every((x) => x === P)
        : props.includes(P) && !props.includes(adversaire(P));
      if (ok) res[P].push(c);
    }
  }
  return res;
}

/** Étape 8 : nombre de croisements contrôlés. */
export function compter(etat) {
  const c = croisementsControles(etat);
  return { A: c.A.length, B: c.B.length };
}

/** Étape 9 : fin de partie. Modifie `brouillon` (fini, vainqueur, raisonFin). */
export function verifierFin(brouillon) {
  const { A, B } = brouillon.ctrl;
  const S = seuilCroisements(brouillon.params);
  const tour = brouillon.tour;
  const dernier = tour >= brouillon.params.nbTours;
  const finir = (v, raison, texte) => {
    brouillon.fini = true;
    brouillon.vainqueur = v;
    brouillon.raisonFin = raison;
    return [entree(tour, 'FIN', texte, { vainqueur: v })];
  };
  const score = `${A} à ${B} croisements contrôlés`;
  if ((A >= S) !== (B >= S)) {
    const v = A >= S ? 'A' : 'B';
    return finir(v, 'seuil', `${nomJoueur(v)} atteint le seuil de ${S} et gagne (${score}).`);
  }
  if (A >= S && B >= S && A !== B) {
    const v = A > B ? 'A' : 'B';
    return finir(v, 'seuil', `Les deux atteignent le seuil de ${S} ; ${nomJoueur(v)} a le plus grand total et gagne (${score}).`);
  }
  // A CONFIRMER (regles-proto.md) : les deux au seuil à égalité AU DERNIER TOUR (« on continue »
  // n'est plus possible). Provisoire : on applique la règle du dernier tour ci-dessous.
  if (dernier) {
    if (A !== B) {
      const v = A > B ? 'A' : 'B';
      return finir(v, 'tours', `Fin du tour ${tour} : ${nomJoueur(v)} gagne (${score}).`);
    }
    const cA = casesPossedees(brouillon, 'A');
    const cB = casesPossedees(brouillon, 'B');
    if (cA !== cB) {
      const v = cA > cB ? 'A' : 'B';
      return finir(v, 'tours', `Fin du tour ${tour} : égalité (${score}) ; ${nomJoueur(v)} possède plus de cases (${cA} à ${cB}) et gagne.`);
    }
    return finir('nul', 'tours', `Fin du tour ${tour} : partie nulle (${score}, ${cA} cases chacun).`);
  }
  if (A >= S && B >= S) return [entree(tour, 'SEUIL_EGALITE', `Les deux atteignent le seuil à égalité (${score}) : la partie continue.`)];
  return [];
}

/**
 * Résout un tour complet (étapes 1 à 9).
 * @param {object} etat état gelé au début du tour
 * @param {{A?: object, B?: object}} ordres un ordre (ou rien) par joueur
 * @returns {{etat: object, journal: object[]}} nouvel état gelé et entrées du tour
 */
export function resoudreTour(etat, ordres) {
  if (etat.fini) throw new Error('La partie est terminée.');
  const tour = etat.tour;
  const journal = [entree(tour, 'TOUR', `— Tour ${tour} —`)];

  const lu = lireEtValider(etat, ordres); // 1-2
  journal.push(...lu.journal);
  const coup = resoudreCoupures(etat, lu.ordres); // 3
  journal.push(...coup.journal);

  const b = copier(etat);
  const ex = executer(b, coup.actifs); // 4
  journal.push(...ex.journal);

  // 5 : en parallèle, sur l'état après l'étape 4 (avant toute attribution).
  const f = {};
  for (const P of JOUEURS) f[P] = fermeturesDe(b, P, ex.nouveaux[P], ex.trajets[P]);
  journal.push(...attribuer(b, { A: f.A.gain, B: f.B.gain })); // 6
  journal.push(...capturer(b, { A: f.A.fermees, B: f.B.fermees })); // 7
  b.ctrl = compter(b); // 8
  journal.push(entree(tour, 'SCORE', `Croisements contrôlés : A ${b.ctrl.A}, B ${b.ctrl.B}.`));
  journal.push(...verifierFin(b)); // 9

  b.historique.push({ tour, ordres: { A: lu.ordres.A, B: lu.ordres.B }, journal });
  if (!b.fini) b.tour = tour + 1;
  return { etat: geler(b), journal };
}
