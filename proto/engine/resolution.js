// Résolution d'un tour : regles-proto.md §2 (9 étapes), variantes §3, cas limites §4,
// et décisions CDP du 03/11 (marquées « choix proto (CDP 03/11) »).
// Chaque étape est une fonction séparée et exportée (testable seule).

import {
  coord, segmentsDuChemin, nbCases, nbCroisements, cotesCase, casesAutourCroisement,
} from './grille.js';
import { copier, geler, adversaire, occupant, nomJoueur, casesPossedees } from './etat.js';
import { validerOrdre, validerLot } from './ordres.js';
import { JOUEURS, seuilCroisements, compteEnCases, uniteScore } from './params.js';

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
  const parPion = etat.params.ordres === 'pion';
  for (const j of JOUEURS) {
    const o = ordres?.[j];
    if (parPion) {
      // Mode `ordres = pion` : un lot par joueur ; pion sans ordre = Passer (implicite).
      const v = validerLot(etat, j, o, rencontreEntre(etat.params));
      lus[j] = { type: 'lot', ordres: v.ordres };
      for (const r of v.rejets) journal.push(entree(etat.tour, 'INVALIDE', `${nomJoueur(j)} : ordre invalide (${r.raison}), remplacé par « rien ».`, { joueur: j }));
      if (!v.ordres.length) {
        const passe = o?.type === 'passer' || (o?.type === 'lot' && !v.rejets.length);
        journal.push(passe ? entree(etat.tour, 'PASSE', `${nomJoueur(j)} passe.`, { joueur: j }) : entree(etat.tour, 'RIEN', `${nomJoueur(j)} : rien.`, { joueur: j }));
      }
      continue;
    }
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

/** Règle de rencontre entre deux trajets (segment ou croisement commun), selon depart_libere. */
export const rencontreEntre = (p) => (tA, tB) => segmentsCommuns(tA, tB).length > 0 || croisementsDeRencontre(tA, tB, p.depart_libere).length > 0;

/** Validation d'un lot (mode pion) avec la règle de rencontre du moteur. Raccourci pour l'IA et l'interface. */
export const validerLotJoueur = (etat, joueur, l) => validerLot(etat, joueur, l, rencontreEntre(etat.params));
/** Vrai si tous les ordres du lot sont acceptés. */
export const lotValide = (etat, joueur, l) => validerLotJoueur(etat, joueur, l).rejets.length === 0;

/** Ordres actifs d'un joueur sous forme de liste (un ordre seul, un lot, ou rien). */
export function listeOrdres(o) {
  if (!o) return [];
  if (Array.isArray(o)) return o.filter(Boolean);
  if (o.type === 'lot') return o.ordres.slice();
  if (o.type === 'rien' || o.type === 'passer') return [];
  return [o];
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
 * Étapes 3 à 5 de regles-proto v0.3 §2 : soutiens (S1, S2), coupures entre A et B (4a, 4b, 4c, avec les
 * conflits de forces S3 si soutien = oui), puis départs libérés en boucle jusqu'à stabilité (5).
 * Réglage `annule_coupe` (v0.3 §4) :
 *  - 'oui' (défaut) : 4a, 4b et 4c se lisent tous sur les ordres d'origine ; un ordre annulé ailleurs coupe
 *    quand même, et chaque cause d'annulation est journalisée ;
 *  - 'non' : lecture séquentielle (CDP 04/11, voir QUESTIONS.md) : 4a entre ordres actifs, puis 4b entre les
 *    survivants, puis 4c, puis 5, en boucle jusqu'à stabilité ; un ordre déjà annulé ne coupe plus.
 * Avec un ordre par joueur (`ordres = joueur`), il y a au plus un conflit en 4 : les deux lectures donnent le
 * même résultat et le même journal qu'avant la v0.3.
 * @returns {{actifs: {A: object|null, B: object|null}, journal: object[]}} (mode pion : actifs = listes)
 */
export function resoudreCoupures(etat, ordres) {
  const p = etat.params;
  const n = p.grille;
  const tour = etat.tour;
  const nc = (c) => nomCroisement(n, c);
  const parPion = p.ordres === 'pion';
  const avecSoutien = p.soutien === 'oui';
  const origine = p.annule_coupe !== 'non';
  const journal = [];
  const unites = [];
  const soutiens = [];
  for (const j of JOUEURS) {
    for (const o of listeOrdres(ordres[j])) {
      if (o.type === 'poser' || o.type === 'deplacer') unites.push({ j, o, actif: true });
      else if (o.type === 'soutenir' && avecSoutien) soutiens.push({ j, o, coupe: false });
    }
  }
  const actives = (j, type) => unites.filter((u) => u.actif && u.j === j && (!type || u.o.type === type));
  const toutes = (j, type) => unites.filter((u) => u.j === j && (!type || u.o.type === type));
  const libelle = (u) => (u.o.type === 'poser'
    ? (parPion ? `la pose en ${nc(u.o.croisement)}` : 'la pose')
    : (parPion ? `le déplacement depuis ${nc(u.o.chemin[0])}` : 'le déplacement'));
  // `toutes` causes : en lecture sur les ordres d'origine, un ordre déjà annulé reçoit aussi les causes suivantes.
  const annuler = (u, code, cause, toutesCauses = false) => {
    if (!u.actif && !toutesCauses) return;
    journal.push(entree(tour, code, `${nomJoueur(u.j)} : ${libelle(u)} est annulé${u.o.type === 'poser' ? 'e' : ''} — ${cause}`, { joueur: u.j }));
    u.actif = false;
  };

  // S1 et S2 (v0.3 §3) : collecte des soutiens, puis coupure en un seul passage sur les ordres d'origine.
  // Réglage `coupure` (L5) : 'arret' (défaut) = un trajet adverse qui s'arrête sur le pion qui soutient ;
  // 'traversee' = aussi un trajet adverse qui passe par ce croisement. Exception : le trajet part du croisement soutenu.
  for (const s of soutiens) {
    const { pion, cible } = s.o;
    const pour = s.o.pour === 'adverse' ? ` (pour ${nomJoueur(adversaire(s.j))})` : '';
    // S1 (v0.3.1 §3 point 2) : ce que vise le soutien, lu sur les ordres d'origine.
    const camp = s.o.pour === 'adverse' ? adversaire(s.j) : s.j;
    const departs = new Set(toutes(camp, 'deplacer').map((u) => u.o.chemin[0]));
    const vise = toutes(camp, 'deplacer').some((u) => u.o.chemin[u.o.chemin.length - 1] === cible) ? 'trajet'
      : occupant(etat, cible) === camp && !departs.has(cible) ? 'defense' : 'rien';
    s.vise = vise;
    const quoi = vise === 'trajet' ? 'soutien d’un trajet' : vise === 'defense' ? 'soutien en défense (sans effet : on ne déloge jamais un pion immobile)' : 'soutien sans objet';
    journal.push(entree(tour, 'SOUTIEN', `${nomJoueur(s.j)} : le pion en ${nc(pion)} soutient ${nc(cible)}${pour} — ${quoi}.`, { joueur: s.j, pion, cible, vise }));
    const coupeur = toutes(adversaire(s.j), 'deplacer').find(({ o }) => {
      const t = o.chemin;
      const touche = p.coupure === 'traversee' ? t.slice(1).includes(pion) : t[t.length - 1] === pion;
      return touche && t[0] !== cible;
    });
    if (coupeur) {
      s.coupe = true;
      journal.push(entree(tour, 'SOUTIEN_COUPE', `${nomJoueur(s.j)} : le soutien du pion en ${nc(pion)} est coupé — trajet de ${nomJoueur(adversaire(s.j))} depuis ${nc(coupeur.o.chemin[0])}.`, { joueur: s.j, pion }));
    }
  }
  // Soutiens non coupés qui renforcent les ordres de `j` (réglage `soutien_adverse`, L2).
  const soutiensPour = (j) => soutiens.filter((s) => !s.coupe && ((s.j === j && s.o.pour !== 'adverse') || (s.j !== j && s.o.pour === 'adverse')));
  const compte = (j, pred) => soutiensPour(j).filter((s) => pred(s.o.cible)).length;
  /** Force d'un ordre au point x = { c } (croisement) ou { seg } (segment) ; réglages soutien_point (L1), soutien_pose (L3). */
  const force = (u, x) => {
    if (!avecSoutien) return 1;
    if (u.o.type === 'poser') return p.soutien_pose === 'oui' ? 1 + compte(u.j, (c) => c === u.o.croisement) : 1;
    const t = u.o.chemin;
    if (p.soutien_point === 'rencontre') return x.c == null ? 1 : 1 + compte(u.j, (c) => c === x.c);
    if (p.soutien_point === 'trajet') { const ch = new Set(t.slice(1)); return 1 + compte(u.j, (c) => ch.has(c)); }
    return 1 + compte(u.j, (c) => c === t[t.length - 1]); // 'arrivee' (défaut) : soutenir l'arrivée soutient tout le trajet
  };
  const nomPoint = (x) => (x.c != null ? nc(x.c) : x.seg.split('-').map((c) => nc(+c)).join('–'));
  /** Conflit S3 : u perd s'il existe un point où il n'est pas strictement plus fort. Retourne la cause ou null. */
  const perd = (u, v, points) => {
    for (const x of points) {
      const fu = force(u, x), fv = force(v, x);
      if (fu < fv) return { faible: true, texte: `plus faible, ${fu} contre ${fv} (en ${nomPoint(x)}).` };
      if (fu === fv) return { faible: false };
    }
    return null;
  };

  // 4a. Trajet contre trajet (adverses).
  const etape4a = (liste) => {
    const conflits = [];
    for (const ua of liste('A', 'deplacer')) {
      for (const ub of liste('B', 'deplacer')) {
        const tA = ua.o.chemin;
        const tB = ub.o.chemin;
        const segs = segmentsCommuns(tA, tB);
        const crs = croisementsDeRencontre(tA, tB, p.depart_libere);
        if (!segs.length && !crs.length) continue;
        const ou = segs.length
          ? `rencontre sur le segment ${segs[0].split('-').map((c) => nc(+c)).join('–')}`
          : `rencontre au croisement ${nc(crs[0])}`;
        conflits.push({ ua, ub, ou, points: [...crs.map((c) => ({ c })), ...segs.map((seg) => ({ seg }))] });
      }
    }
    for (const { ua, ub, ou, points } of conflits) {
      if (!avecSoutien) {
        annuler(ua, 'RENCONTRE', `${ou}.`, origine);
        annuler(ub, 'RENCONTRE', `${ou}.`, origine);
        continue;
      }
      const pa = perd(ua, ub, points);
      const pb = perd(ub, ua, points);
      if (pa) annuler(ua, 'RENCONTRE', pa.faible ? pa.texte : `${ou}.`, origine);
      if (pb) annuler(ub, 'RENCONTRE', pb.faible ? pb.texte : `${ou}.`, origine);
    }
    return conflits.length;
  };
  // 4b. Pose sur le chemin d'un trajet adverse (départ exclu : une pose sur un départ est refusée à la validation).
  const etape4b = (liste) => {
    const conflits = [];
    for (const P of JOUEURS) {
      const Q = adversaire(P);
      for (const up of liste(P, 'poser')) {
        const c = up.o.croisement;
        const coupes = liste(Q, 'deplacer').filter((uq) => uq.o.chemin.slice(1).includes(c));
        if (coupes.length) conflits.push({ P, up, c, coupes });
      }
    }
    for (const { P, up, c, coupes } of conflits) {
      let coupe = false;
      for (const uq of coupes) {
        const fp = force(up, { c });
        const ft = force(uq, { c });
        if (ft > fp) {
          annuler(up, 'COUPURE', `plus faible, ${fp} contre ${ft} (en ${nc(c)}) : le trajet soutenu passe.`, origine);
        } else if (fp > ft) {
          annuler(uq, 'COUPURE', `plus faible, ${ft} contre ${fp} (en ${nc(c)}, pose de ${nomJoueur(P)}).`, origine);
        } else {
          annuler(uq, 'COUPURE', `${nomJoueur(P)} pose en ${nc(c)}, sur son trajet.`, origine);
          coupe = true;
        }
      }
      if (!coupe) continue;
      if (p.pose_coupante === 'annulee') annuler(up, 'COUPURE', `la pose en ${nc(c)} a coupé un trajet (réglage « pose qui coupe » : annulée).`, origine);
      else journal.push(entree(tour, 'COUPURE', `${nomJoueur(P)} : la pose en ${nc(c)} est maintenue (réglage « pose qui coupe » : maintenue).`, { joueur: P }));
    }
    return conflits.length;
  };
  // 4c. Deux poses adverses sur le même croisement : les deux annulées.
  const etape4c = (liste) => {
    const conflits = [];
    for (const ua of liste('A', 'poser')) for (const ub of liste('B', 'poser')) if (ua.o.croisement === ub.o.croisement) conflits.push([ua, ub]);
    for (const [ua, ub] of conflits) {
      annuler(ua, 'POSES', `les deux joueurs posent en ${nc(ua.o.croisement)}.`, origine);
      annuler(ub, 'POSES', `les deux joueurs posent en ${nc(ua.o.croisement)}.`, origine);
    }
    return conflits.length;
  };
  // 5. Départs libérés : un ordre qui vise ou traverse le croisement d'un pion qui ne part pas est annulé
  // (« départ non libéré »), une annulation à la fois, jusqu'à stabilité. Mode pion : aussi un pion AMI.
  const etape5 = () => {
    const partent = new Set(unites.filter((u) => u.actif && u.o.type === 'deplacer').map((u) => u.o.chemin[0]));
    for (const P of JOUEURS) {
      for (const u of actives(P)) {
        if (u.o.type === 'deplacer') {
          const t = u.o.chemin;
          const bloque = t.slice(1).find((c) => c !== t[0] && occupant(etat, c) != null && !partent.has(c));
          if (bloque != null) {
            annuler(u, 'CHAINE', occupant(etat, bloque) === P
              ? `votre pion en ${nc(bloque)} ne part pas : il ne peut être ni traversé ni rejoint.`
              : `le pion adverse en ${nc(bloque)} ne bouge pas : il ne peut être ni traversé ni rejoint.`);
            return true;
          }
        } else {
          const c = u.o.croisement;
          // Garde-fou (v0.3 §1 « Pose ») : une pose sur un croisement occupé est refusée à la validation.
          if (occupant(etat, c) != null && occupant(etat, c) !== P && !partent.has(c)) {
            annuler(u, 'CHAINE', `pose invalide : le croisement ${nc(c)} reste occupé par un pion adverse.`);
            return true;
          }
        }
      }
    }
    return false;
  };

  // Réglage `conflit = synchro` (piste de Lomig 04/11, voir QUESTIONS.md « conflit synchro ») : au pas k, un
  // pion qui se déplace est en chemin[k] (puis reste sur son arrivée) ; pose et pion immobile occupent leur
  // croisement à tous les pas. Conflit = même croisement au même pas, ou face-à-face sur un segment entre k et k+1.
  // Pour chaque paire, seul le PREMIER conflit compte. Passe 1 sur les ordres d'origine, puis on recommence sur
  // l'état obtenu (pions annulés ou arrêtés = obstacles) jusqu'à stabilité ; rien n'est repêché.
  const synchro = () => {
    const arret = p.conflit_issue === 'arret';
    for (const u of unites) u.ch = u.o.type === 'deplacer' ? u.o.chemin.slice() : null;
    const pos = (e, k) => (e.ch ? e.ch[Math.min(k, e.ch.length - 1)] : e.c);
    const enMouvement = (e, k) => !!e.ch && k <= e.ch.length - 1; // à k, le pion vient d'atteindre pos(e, k) (ou y part, k = 0)
    for (let garde = 0; garde < 10 + 4 * unites.length; garde++) {
      const act = unites.filter((u) => u.actif);
      for (const u of act) u.c = u.o.type === 'poser' ? u.o.croisement : null;
      const partent = new Set(act.filter((u) => u.ch).map((u) => u.ch[0]));
      const immobiles = [];
      for (const j of JOUEURS) for (const c of etat.pions[j]) if (!partent.has(c)) immobiles.push({ j, c, ch: null, immobile: true });
      const K = Math.max(0, ...act.filter((u) => u.ch).map((u) => u.ch.length - 1));
      const pertes = new Map(); // unité -> index d'arrêt minimal (-1 = annulée)
      const perdre = (u, k, type, code, cause, meta = {}) => {
        let stop = -1;
        if (u.ch && arret) stop = type === 'seg' ? k : k - 1;
        if (u.ch && stop >= u.ch.length - 1) return; // déjà arrivé avant le conflit : rien ne change
        if (u.ch && stop <= 0) stop = -1;
        const prec = pertes.get(u);
        pertes.set(u, prec == null ? { stop, code, cause } : (stop < prec.stop ? { stop, code, cause } : prec));
        if (stop === -1 || !arret) journal.push(entree(tour, code, `${nomJoueur(u.j)} : ${libelle(u)} est annulé${u.o.type === 'poser' ? 'e' : ''} — ${cause}`, { joueur: u.j, ...meta }));
        else journal.push(entree(tour, 'ARRET', `${nomJoueur(u.j)} : ${libelle(u)} s’arrête en ${nc(u.ch[stop])} — ${cause}`, { joueur: u.j, croisement: u.ch[stop], ...meta }));
      };
      const premier = (a, b) => {
        for (let k = 0; k <= K; k++) {
          if (pos(a, k) === pos(b, k)) return { k, type: 'c', x: { c: pos(a, k) } };
          if (k < K && a.ch && b.ch && pos(a, k) !== pos(a, k + 1) && pos(a, k) === pos(b, k + 1) && pos(a, k + 1) === pos(b, k)) {
            return { k, type: 'seg', x: { seg: [pos(a, k), pos(a, k + 1)].sort((m, q) => m - q).join('-') } };
          }
        }
        return null;
      };
      const ici = (ev) => (ev.type === 'c' ? `rencontre au croisement ${nc(ev.x.c)} au pas ${ev.k}` : `face-à-face sur le segment ${nomPoint(ev.x)} (pas ${ev.k} à ${ev.k + 1})`);
      for (let i = 0; i < act.length; i++) {
        const u = act[i];
        // Contre les pions immobiles (sans ordre de déplacement) : celui qui arrive perd toujours.
        for (const m of immobiles) {
          const ev = premier(u, m);
          if (!ev) continue;
          if (u.o.type === 'poser') { if (m.j !== u.j) perdre(u, ev.k, 'c', 'CHAINE', `pose invalide : le croisement ${nc(m.c)} reste occupé par un pion adverse.`); continue; }
          perdre(u, ev.k, ev.type, 'CHAINE', m.j === u.j
            ? `votre pion en ${nc(m.c)} ne part pas : il ne peut être ni traversé ni rejoint (pas ${ev.k}).`
            : `le pion adverse en ${nc(m.c)} ne bouge pas : il ne peut être ni traversé ni rejoint (pas ${ev.k}).`);
        }
        for (let q = i + 1; q < act.length; q++) {
          const v = act[q];
          const ev = premier(u, v);
          if (!ev) continue;
          if (u.j === v.j) {
            // Ami : seul un pion déjà arrêté (arrivé, posé) fait obstacle ; deux trajets amis qui se croisent sont refusés à la saisie.
            const mu = ev.type === 'c' && enMouvement(u, ev.k) && ev.k > 0, mv = ev.type === 'c' && enMouvement(v, ev.k) && ev.k > 0;
            if (mu && !mv) perdre(u, ev.k, 'c', 'CHAINE', `votre pion en ${nc(ev.x.c)} y est déjà : il ne peut être ni traversé ni rejoint (pas ${ev.k}).`);
            if (mv && !mu) perdre(v, ev.k, 'c', 'CHAINE', `votre pion en ${nc(ev.x.c)} y est déjà : il ne peut être ni traversé ni rejoint (pas ${ev.k}).`);
            continue;
          }
          if (u.o.type === 'poser' && v.o.type === 'poser') {
            perdre(u, 0, 'c', 'POSES', `les deux joueurs posent en ${nc(u.c)}.`);
            perdre(v, 0, 'c', 'POSES', `les deux joueurs posent en ${nc(u.c)}.`);
            continue;
          }
          if (u.o.type === 'poser' || v.o.type === 'poser') {
            const up = u.o.type === 'poser' ? u : v, uq = up === u ? v : u;
            const c = up.c, fp = force(up, { c }), ft = force(uq, { c });
            if (ft > fp) perdre(up, ev.k, 'c', 'COUPURE', `plus faible, ${fp} contre ${ft} (en ${nc(c)}) : le trajet soutenu passe.`);
            else {
              perdre(uq, ev.k, 'c', 'COUPURE', fp > ft ? `plus faible, ${ft} contre ${fp} (en ${nc(c)}, pose de ${nomJoueur(up.j)}).` : `${nomJoueur(up.j)} pose en ${nc(c)}, sur son trajet (pas ${ev.k}).`);
              // Décision Lomig 04/11 (11 h 49) : en synchro, à égalité, la pose tient (pose_coupante ne joue qu'en mode trajet).
              if (fp === ft) {
                journal.push(entree(tour, 'COUPURE', `${nomJoueur(up.j)} : la pose en ${nc(c)} est maintenue (égalité : la pose tient).`, { joueur: up.j }));
              }
            }
            continue;
          }
          // Décision Lomig 04/11 (11 h 49) : un pion déjà arrivé fait obstacle, même plus faible ; le trajet adverse qui
          // passe par son croisement s'arrête juste avant (on ne déloge jamais un pion ; jamais deux pions sur un croisement).
          if (ev.type === 'c') {
            const au = !enMouvement(u, ev.k), av = !enMouvement(v, ev.k);
            if (au !== av) {
              const [arrive, passe] = au ? [u, v] : [v, u];
              perdre(passe, ev.k, 'c', 'RENCONTRE', `le pion adverse déjà arrivé en ${nc(ev.x.c)} fait obstacle (pas ${ev.k}).`, { obstacle: 'arrive' });
              continue;
            }
          }
          const pa = perd(u, v, [ev.x]);
          const pb = perd(v, u, [ev.x]);
          if (pa) perdre(u, ev.k, ev.type, 'RENCONTRE', pa.faible ? pa.texte : `${ici(ev)}.`);
          if (pb) perdre(v, ev.k, ev.type, 'RENCONTRE', pb.faible ? pb.texte : `${ici(ev)}.`);
        }
      }
      if (!pertes.size) break;
      for (const [u, { stop }] of pertes) {
        if (stop === -1) u.actif = false;
        else u.ch = u.ch.slice(0, stop + 1);
      }
    }
  };

  if (p.conflit === 'synchro') {
    synchro();
    const actifs = {};
    for (const j of JOUEURS) {
      const l = unites.filter((u) => u.j === j && u.actif).map((u) => (u.ch && u.ch.length !== u.o.chemin.length ? { ...u.o, chemin: u.ch } : u.o));
      actifs[j] = parPion ? l : l[0] || null;
    }
    return { actifs, journal };
  }
  if (origine) {
    // 4a, 4b, 4c sur les ordres d'origine, puis 5 en boucle (un ordre retiré en 5 ne relance pas 4).
    etape4a(toutes);
    etape4b(toutes);
    etape4c(toutes);
    for (let garde = 0; garde < 10 + 4 * unites.length && etape5(); garde++);
  } else {
    for (let garde = 0; garde < 10 + 4 * unites.length; garde++) {
      if (etape4a(actives)) continue;
      if (etape4b(actives)) continue;
      if (etape4c(actives)) continue;
      if (!etape5()) break;
    }
  }
  const actifs = {};
  for (const j of JOUEURS) {
    const l = unites.filter((u) => u.j === j && u.actif).map((u) => u.o);
    actifs[j] = parPion ? l : l[0] || null;
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
  // conflit = synchro : deux trajets adverses peuvent parcourir le même segment à des pas différents (sans conflit).
  // La couleur se pose alors dans l'ordre des pas (le dernier passage recolore), pas dans l'ordre A puis B.
  const synchro = p.conflit === 'synchro';
  const evenements = [];
  for (const P of JOUEURS) {
    const liste = listeOrdres(actifs[P]);
    // Mode pion : les déplacements d'un même joueur sont simultanés (positions lues avant le tour).
    const arrivees = new Map(liste.filter((o) => o.type === 'deplacer').map((o) => [o.chemin[0], o.chemin[o.chemin.length - 1]]));
    if (arrivees.size) brouillon.pions[P] = brouillon.pions[P].map((c) => (arrivees.has(c) ? arrivees.get(c) : c));
    for (const o of liste) {
    if (o.type === 'poser') {
      brouillon.pions[P].push(o.croisement);
      brouillon.reserve[P] -= 1;
      journal.push(entree(tour, 'POSE', `${nomJoueur(P)} pose un pion en ${nomCroisement(n, o.croisement)}.`, { joueur: P, croisement: o.croisement }));
    } else if (o.type === 'deplacer') {
      const ch = o.chemin;
      const depart = ch[0];
      const arrivee = ch[ch.length - 1];
      let retraces = 0;
      segmentsDuChemin(ch).forEach((s, k) => { if (synchro) { trajets[P].add(s); if (couleursAvant[s] === P) retraces += 1; evenements.push({ P, s, k }); } });
      for (const s of synchro ? [] : segmentsDuChemin(ch)) {
        trajets[P].add(s);
        const avant = couleursAvant[s];
        // Réglage `trace_adverse` : « recolore » (défaut) ou « garde ».
        if (avant && avant !== P && p.trace_adverse === 'garde') continue;
        // v0.3 étape 6, réglage `retrace_ferme` : 'oui' (défaut, en vigueur) = un segment déjà à P et
        // reparcouru fait partie de nouveaux(P) ; 'non' = seuls les segments qui prennent la couleur de P.
        brouillon.couleurs[s] = P;
        if (avant === P) retraces += 1;
        if (avant === P && p.retrace_ferme === 'non') continue;
        nouveaux[P].add(s);
      }
      journal.push(entree(tour, 'DEPLACEMENT', `${nomJoueur(P)} déplace un pion de ${nomCroisement(n, depart)} à ${nomCroisement(n, arrivee)} (${ch.length - 1} segment${ch.length > 2 ? 's' : ''}).`, { joueur: P, chemin: ch.slice(), retraces }));
    }
    }
  }
  if (synchro) {
    evenements.sort((x, y) => x.k - y.k); // même segment au même pas par deux adverses = conflit, donc jamais à égalité
    for (const { P, s } of evenements) {
      const avant = brouillon.couleurs[s];
      // trace_adverse = garde : une trace adverse (d'avant le tour ou posée plus tôt dans ce tour) n'est pas recolorée.
      if (avant && avant !== P && p.trace_adverse === 'garde') continue;
      brouillon.couleurs[s] = P;
      if (avant && avant !== P) nouveaux[avant].delete(s);
      if (couleursAvant[s] === P && p.retrace_ferme === 'non') continue;
      nouveaux[P].add(s);
    }
  }
  return { nouveaux, trajets, journal, couleursAvant };
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
    else brouillon.retires[victime] += 1; // `sans_retour` et son alias `definitive` (CDP 03/11)
    journal.push(entree(brouillon.tour, 'CAPTURE', `Le pion de ${nomJoueur(victime)} en ${nomCroisement(n, croisement)} est capturé${p.capture === 'retour' ? ' et retourne en réserve' : ' et quitte la partie'}.`, { joueur: victime, croisement }));
  }
  // Cas limite (capture `sans_retour`/`definitive`) : un joueur qui perd son dernier pion continue la
  // partie et ne peut plus que passer ; il garde son territoire.
  // A CONFIRMER (regles-proto.md) : la v0.2 ne dit rien de ce cas ; choix neutre du CDP (03/11).
  for (const J of JOUEURS) {
    if (captures.some((x) => x.victime === J) && brouillon.pions[J].length === 0 && brouillon.reserve[J] === 0) {
      journal.push(entree(brouillon.tour, 'SANS_PION', `${nomJoueur(J)} n'a plus aucun pion : il ne pourra plus que passer.`, { joueur: J }));
    }
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

/** Étape 8 : score de chaque joueur : cases possédées (défaut, décision Lomig 03/11) ou croisements contrôlés. */
export function compter(etat) {
  if (compteEnCases(etat.params)) return { A: casesPossedees(etat, 'A'), B: casesPossedees(etat, 'B') };
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
  const score = compteEnCases(brouillon.params) ? `${A} à ${B} cases` : `${A} à ${B} croisements contrôlés`;
  if ((A >= S) !== (B >= S)) {
    const v = A >= S ? 'A' : 'B';
    return finir(v, 'seuil', `${nomJoueur(v)} atteint le seuil de ${S}${compteEnCases(brouillon.params) ? " cases" : ""} et gagne (${score}).`);
  }
  if (A >= S && B >= S && A !== B) {
    const v = A > B ? 'A' : 'B';
    return finir(v, 'seuil', `Les deux atteignent le seuil de ${S}${compteEnCases(brouillon.params) ? " cases" : ""} ; ${nomJoueur(v)} a le plus grand total et gagne (${score}).`);
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
    // Réglage `departage = traces` (proposé, v0.3 §4) : à égalité de cases, le plus de segments à sa couleur gagne.
    if (brouillon.params.departage === 'traces') {
      const sA = Object.values(brouillon.couleurs).filter((c) => c === 'A').length;
      const sB = Object.values(brouillon.couleurs).filter((c) => c === 'B').length;
      if (sA !== sB) {
        const v = sA > sB ? 'A' : 'B';
        return finir(v, 'tours', `Fin du tour ${tour} : égalité (${score}, ${cA} cases chacun) ; ${nomJoueur(v)} a plus de segments à sa couleur (${Math.max(sA, sB)} à ${Math.min(sA, sB)}) et gagne.`);
      }
    }
    return finir('nul', 'tours', `Fin du tour ${tour} : partie nulle (${score}, ${cA} cases chacun).`);
  }
  if (A >= S && B >= S) return [entree(tour, 'SEUIL_EGALITE', `Les deux atteignent le seuil à égalité (${score}) : la partie continue.`)];
  return [];
}

/**
 * Réglage `territoire_acquis = murs` (proposé, v0.3 §4) : une case possédée par P redevient sans propriétaire
 * si un de ses côtés qui était un mur de P (segment à la couleur de P) est recoloré par l'adversaire à ce tour.
 * Appliqué juste après l'exécution, avant les fermetures (choix CDP 04/11 : une fermeture du même tour peut la reprendre).
 */
export function perdreMurs(brouillon, couleursAvant) {
  const p = brouillon.params;
  if (p.territoire_acquis !== 'murs') return [];
  const n = p.grille;
  const perdues = { A: [], B: [] };
  brouillon.proprietaires.forEach((P, k) => {
    if (!P) return;
    if (cotesCase(n, k).some(({ segment }) => couleursAvant[segment] === P && brouillon.couleurs[segment] === adversaire(P))) perdues[P].push(k);
  });
  const journal = [];
  for (const P of JOUEURS) {
    if (!perdues[P].length) continue;
    for (const k of perdues[P]) brouillon.proprietaires[k] = null;
    journal.push(entree(brouillon.tour, 'MURS', `${nomJoueur(P)} perd ${perdues[P].length} case${perdues[P].length > 1 ? 's' : ''} : un de leurs murs a été recoloré par l’adversaire (réglage « Territoire » : murs).`, { joueur: P, cases: perdues[P] }));
  }
  return journal;
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

  journal.push(...perdreMurs(b, ex.couleursAvant)); // réglage territoire_acquis = murs (v0.3 §4)

  // 5 : en parallèle, sur l'état après l'étape 4 (avant toute attribution).
  const f = {};
  for (const P of JOUEURS) f[P] = fermeturesDe(b, P, ex.nouveaux[P], ex.trajets[P]);
  journal.push(...attribuer(b, { A: f.A.gain, B: f.B.gain })); // 6
  journal.push(...capturer(b, { A: f.A.fermees, B: f.B.fermees })); // 7
  b.ctrl = compter(b); // 8
  journal.push(entree(tour, 'SCORE', compteEnCases(b.params) ? `Cases possédées : A ${b.ctrl.A}, B ${b.ctrl.B}.` : `Croisements contrôlés : A ${b.ctrl.A}, B ${b.ctrl.B}.`));
  journal.push(...verifierFin(b)); // 9

  b.historique.push({ tour, ordres: { A: lu.ordres.A, B: lu.ordres.B }, journal });
  if (!b.fini) b.tour = tour + 1;
  return { etat: geler(b), journal };
}
