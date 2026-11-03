// IA forte (niveau « Fort », défaut). Elle ne contient AUCUNE règle : tout passe par le vrai moteur
// (validerOrdre, executer, fermeturesDe, resoudreTour). Elle est pure (sans DOM) : elle tourne dans
// un Web Worker côté navigateur (ai/worker-ia.js) et dans node pour l'arène (tools/arena.js).
//
// Principe (coups simultanés) :
//  1. Génération de tous les ordres légaux : poses, trajets jusqu'à trajet_max (dédoublonnés, élagués),
//     et « Passer ».
//  2. Pré-tri rapide avec les étapes 4-5 du moteur (executer + fermeturesDe) : gain immédiat + potentiel.
//  3. Évaluation à 1 tour contre « Passer » (resoudreTour), pour soi et pour l'adversaire.
//  4. Matrice de gains : chaque ordre candidat contre un échantillon de réponses adverses probables
//     (ses meilleurs ordres, ses coupures plausibles, Passer), résolue par resoudreTour.
//     Score = mélange maximin / moyenne pondérée.
//  5. Profondeur 2 dans le budget : pour les meilleurs candidats, on estime le meilleur coup du tour suivant.
//  6. Aléa graïné entre les coups proches.
// Le budget se compte en résolutions (reproductible) ; `msMax` ajoute une limite de temps (navigateur).

import {
  voisins, cleSegment, nbCroisements, nbCases, cotesCase, casesAutourCroisement, estSurBord,
} from '../engine/grille.js';
import { adversaire, occupant } from '../engine/etat.js';
import { longueurMax, seuilCroisements, compteEnCases } from '../engine/params.js';
import { validerOrdre, poser, deplacer, passer, rien } from '../engine/ordres.js';
import { resoudreTour, executer, fermeturesDe } from '../engine/resolution.js';

/** Poids « forte de base » (choisis à la main avant tuning). Les noms sont ceux du rapport. */
export const POIDS_BASE = Object.freeze({
  // évaluation
  croisements: 1.0, // score (différence) : croisements contrôlés, ou cases avec comptage = cases
  // décision Lomig 03/11 : comptage = cases par défaut. Une case gagnée vaut environ 2 croisements
  // contrôlés (zones de 4 à 12 cases) : on multiplie le terme de score par ce facteur en cases, pour
  // garder l'équilibre avec potentiel, exposition, etc., calibrés en croisements. Seuil : ratio, inchangé.
  echelle_cases: 2.0,
  cases: 0.3, // cases possédées (départage au tour 20)
  potentiel: 1.2, // territoire potentiel : cases presque fermées par ses murs
  exposition: 0.4, // murs exposés à la recoloration, cases exposées à la reprise
  coupure: 0.5, // risque de coupure : pions coincés ou collés à un pion adverse
  reserve: 0.2, // pions en réserve (chacun) ; inchangé depuis la v1
  // passe « IA robuste » (CDP/Lomig 03/11, 20 h) : présence et mobilité. Diagnostic : la v1 (ai/ia-forte-v1.js)
  // ne voyait aucun intérêt à poser (une pose ne vaut rien à 1 tour) et gardait ~4 pions en réserve.
  reserve_garde: 0.0, // avoir au moins 1 pion en réserve (munition de coupure : une pose coupante ne coûte rien)
  presence: 0.0, // pions en jeu, concave : √(pions en jeu)
  mobilite: 0.0, // croisements atteignables en un trajet par au moins un pion (en dixièmes de la grille)
  menaces: 0.0, // pions distincts capables d'atteindre une case presque fermée (3 murs), plafonné à 3
  // demande CDP 03/11 (Q4) : avec la capture activée, chaque pion capturé à ce tour (différence entre
  // les deux camps). Sans capture (défaut), ce terme vaut toujours 0 : l'IA par défaut ne change pas.
  capture: 4.0, // 2.0 au banc Q4 (croisements) ; 4.0 depuis le comptage en cases (piège 1 : 9/20 à 2, 20/20 à 4)
  // demande CDP 03/11 : capture `definitive` (alias `sans_retour`) : le pion pris est perdu pour de bon.
  // Poids par pion capturé à ce tour, utilisé à la place de `capture` dans ce mode (calibré au banc).
  capture_definitive: 8.0,
  seuil: 15, // distance au seuil : (ctrl / seuil)²
  tours_restants: 1.0, // exposant : le potentiel compte moins quand il reste peu de tours
  // recherche
  maximin: 0.5, // 1 = pur maximin, 0 = pure moyenne pondérée
  temperature: 3, // pondération des réponses adverses (softmax)
  poids_coupe: 0.6, // poids relatif d'une réponse adverse « coupure » dans la moyenne
  profondeur2: 0.35, // part de l'estimation du tour suivant
  alea: 0.4, // écart toléré (en points d'évaluation) pour tirer au hasard entre coups proches
  // passe « IA robuste » : jeu simultané, donc stratégie mixte. Probabilité de jouer selon l'équilibre
  // (regret matching sur la matrice candidats × réponses) plutôt que le meilleur score. 0 = comme la v1.
  equilibre: 0.0,
  // passe « IA robuste » : marge de déploiement. Parmi les lignes à moins de `deploiement` points de la
  // meilleure, on préfère la meilleure pose tant qu'il reste au moins 2 pions en réserve (1 sert de munition
  // de coupure). Les pièges tactiques (écart > marge) ne changent donc pas. 0 = comme la v1.
  deploiement: 2.0,
  // passe « IA robuste » : un ordre qui vient d'être annulé (RENCONTRE, COUPURE) dans la même position est
  // prévisible ; pénalité par tour consécutif où ce même ordre a échoué. Sans elle, deux fortes rejouent le même
  // trajet percuté jusqu'au tour 20 (banc/ia-passivite-diagnostic.md). 0 = comme la v1.
  repetition: 0.0, // testé à 3 : 34,7 % contre la v1 (abandonner un blocage laisse passer la fermeture adverse)
});

export const NOMS_POIDS = Object.keys(POIDS_BASE);

// v2 (passe « IA robuste », 03/11) : 16 réponses au lieu de 30 et matrice limitée à 65 % du budget, pour que
// la profondeur 2 (tour suivant) s'exécute enfin ; 10 poses gardées au pré-tri (v1 : 30, 100 %, 6).
const OPTIONS_DEFAUT = { budget: 700, msMax: Infinity, poids: null, kCandidats: 40, mReponses: 30, partMatrice: 1, nPoses: 10 };

// Poids tunés (ai/poids-tunes.json, écrit par tools/arena.js tuning). Tant qu'ils ne sont pas chargés,
// ou si le fichier est absent, l'IA utilise POIDS_BASE.
let POIDS_TUNES = null;
export const poidsActifs = () => POIDS_TUNES || POIDS_BASE;

/** Lit ai/poids-tunes.json (fetch dans le navigateur, fs dans node). Retourne les poids, ou null. */
export async function chargerPoidsTunes() {
  try {
    const url = new URL('./poids-tunes.json', import.meta.url);
    let txt;
    if (url.protocol === 'file:') {
      const fs = await import('node:fs');
      txt = fs.readFileSync(url, 'utf8');
    } else {
      const r = await fetch(url);
      if (!r.ok) return null;
      txt = await r.text();
    }
    const j = JSON.parse(txt);
    POIDS_TUNES = Object.freeze({ ...POIDS_BASE, ...j.poids });
    return POIDS_TUNES;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Génération des ordres légaux
// ---------------------------------------------------------------------------

/** Toutes les poses légales (validées par le moteur). */
export function posesLegales(etat, P) {
  const res = [];
  if (etat.reserve[P] <= 0) return res;
  for (let c = 0; c < nbCroisements(etat.params.grille); c++) {
    const o = poser(c);
    if (validerOrdre(etat, P, o).ok) res.push(o);
  }
  return res;
}

/**
 * Trajets légaux jusqu'à trajet_max segments (plafond `plafond` si illimité), dédoublonnés :
 * deux trajets de même arrivée et de mêmes segments ont le même effet. Élagage : on ne traverse
 * pas un pion adverse (le moteur l'annule s'il ne part pas). Chaque trajet retenu est validé par le moteur.
 */
export function trajetsLegaux(etat, P, { plafond = 7, maxParPion = 1500 } = {}) {
  const n = etat.params.grille;
  const L = Math.min(longueurMax(etat.params), plafond);
  const Q = adversaire(P);
  const occ = new Map();
  for (const c of etat.pions[P]) occ.set(c, P);
  for (const c of etat.pions[Q]) occ.set(c, Q);
  const repasser = etat.params.repasser_croisement !== 'non';
  const vus = new Set();
  const res = [];
  for (const depart of etat.pions[P]) {
    let compte = 0;
    const ch = [depart];
    const segs = [];
    const rec = () => {
      if (compte >= maxParPion) return;
      if (ch.length > 1) {
        const cle = ch[ch.length - 1] + '|' + segs.slice().sort().join(',');
        if (!vus.has(cle)) {
          vus.add(cle);
          compte++;
          res.push(ch.slice());
        }
      }
      if (segs.length >= L) return;
      const dernier = ch[ch.length - 1];
      for (const v of voisins(n, dernier)) {
        const s = cleSegment(dernier, v);
        if (segs.includes(s)) continue;
        const o = occ.get(v);
        if (o === Q || (o === P && v !== depart)) continue;
        if (!repasser && ch.includes(v)) continue;
        ch.push(v);
        segs.push(s);
        rec();
        ch.pop();
        segs.pop();
      }
    };
    rec();
  }
  return res.map((c) => deplacer(c)).filter((o) => validerOrdre(etat, P, o).ok);
}

/** Tous les ordres légaux (poses, trajets, Passer). */
export function ordresLegaux(etat, P, opts) {
  return [...posesLegales(etat, P), ...trajetsLegaux(etat, P, opts), passer()];
}

// ---------------------------------------------------------------------------
// Évaluation
// ---------------------------------------------------------------------------

// Géométrie mise en cache par taille de grille (tirée de engine/grille.js).
const GEO = new Map();
function geo(n) {
  let g = GEO.get(n);
  if (!g) {
    const N = nbCases(n);
    const cotes = [];
    for (let k = 0; k < N; k++) cotes.push(cotesCase(n, k).map(({ segment, voisine }) => [segment, voisine]));
    // cases de part et d'autre de chaque segment
    const casesDuSegment = new Map();
    for (let k = 0; k < N; k++) for (const [s] of cotes[k]) {
      if (!casesDuSegment.has(s)) casesDuSegment.set(s, []);
      casesDuSegment.get(s).push(k);
    }
    const vois = [];
    for (let c = 0; c < nbCroisements(n); c++) vois.push(voisins(n, c));
    const autour = [];
    for (let c = 0; c < nbCroisements(n); c++) autour.push(casesAutourCroisement(n, c));
    g = { N, cotes, casesDuSegment, vois, autour };
    GEO.set(n, g);
  }
  return g;
}

/** Nombre de murs (bord ou trace de X) autour de chaque case. */
function mursParCase(etat, X) {
  const { N, cotes } = geo(etat.params.grille);
  const m = new Uint8Array(N);
  const coul = etat.couleurs;
  for (let k = 0; k < N; k++) {
    let c = 0;
    for (const [s, v] of cotes[k]) if (v < 0 || coul[s] === X) c++;
    m[k] = c;
  }
  return m;
}

/** Caractéristiques brutes pour X (chacune « plus c'est grand, plus c'est fort pour X » sauf exposition et coupure). */
export function caracteristiques(etat, X) {
  const n = etat.params.grille;
  const Y = adversaire(X);
  const N = nbCases(n);
  const mX = mursParCase(etat, X);
  const mY = mursParCase(etat, Y);
  const reprise = etat.params.reprise === 'oui';
  let potentiel = 0;
  let casesX = 0;
  let exposition = 0;
  for (let k = 0; k < N; k++) {
    const p = etat.proprietaires[k];
    if (p === X) {
      casesX++;
      if (reprise && mY[k] >= 3) exposition += 0.5; // reprise possible par Y
      continue;
    }
    if (p === Y && !reprise) continue; // jamais prenable sans reprise
    const g = mX[k] >= 3 ? 1 : mX[k] === 2 ? 0.3 : 0;
    potentiel += p === Y ? g * 1.3 : g;
  }
  // murs de X recolorables : un segment de X dont une extrémité est voisine d'un pion de Y
  if (etat.params.trace_adverse === 'recolore') {
    const proches = new Set();
    const { vois } = geo(n);
    for (const c of etat.pions[Y]) {
      proches.add(c);
      for (const v of vois[c]) proches.add(v);
    }
    for (const [s, j] of Object.entries(etat.couleurs)) {
      if (j !== X) continue;
      const [a, b] = s.split('-');
      if (proches.has(+a) || proches.has(+b)) exposition += 0.25;
    }
  }
  // risque de coupure : pions coincés (moins de 2 sorties libres) ou collés à un pion adverse
  let coupure = 0;
  const { vois } = geo(n);
  for (const c of etat.pions[X]) {
    let libres = 0;
    let colle = false;
    for (const v of vois[c]) {
      const o = etat.pions[X].includes(v) ? X : etat.pions[Y].includes(v) ? Y : null;
      if (o === null) libres++;
      if (o === Y) colle = true;
    }
    if (libres < 2) coupure += 1;
    if (colle) coupure += 0.5;
  }
  const pr = presenceEtMobilite(etat, X, mX);
  return { ctrl: etat.ctrl[X], cases: casesX, potentiel, exposition, coupure, reserve: etat.reserve[X], pions: etat.pions[X].length, ...pr };
}

/**
 * Mobilité et menaces de X (passe « IA robuste ») : parcours en largeur depuis chaque pion, sur les
 * croisements libres, jusqu'à trajet_max segments (plafond 7). Approximation : pas de règle ici, seul le
 * moteur juge les ordres ; ces nombres servent seulement à évaluer une position.
 */
function presenceEtMobilite(etat, X, mX) {
  const n = etat.params.grille;
  const { vois, autour } = geo(n);
  const nb = nbCroisements(n);
  const L = Math.min(longueurMax(etat.params), 7);
  const occ = new Uint8Array(nb);
  for (const c of etat.pions.A) occ[c] = 1;
  for (const c of etat.pions.B) occ[c] = 1;
  const chaud = (c) => autour[c].some((k) => etat.proprietaires[k] !== X && mX[k] >= 3);
  const vu = new Uint8Array(nb);
  let atteint = 0;
  let menaces = 0;
  const dist = new Int8Array(nb);
  for (const p of etat.pions[X]) {
    dist.fill(-1);
    dist[p] = 0;
    const file = [p];
    let menace = false;
    for (let h = 0; h < file.length; h++) {
      const c = file[h];
      if (!vu[c]) { vu[c] = 1; atteint++; }
      if (!menace && c !== p && chaud(c)) menace = true;
      if (dist[c] >= L) continue;
      for (const v of vois[c]) if (dist[v] < 0 && !occ[v]) { dist[v] = dist[c] + 1; file.push(v); }
    }
    if (menace) menaces++;
  }
  return { mobilite: (10 * atteint) / nb, menaces: Math.min(3, menaces) };
}

/** Évaluation de `etat` du point de vue de P. */
export function evaluer(etat, P, poids = POIDS_BASE) {
  const Q = adversaire(P);
  if (etat.fini) {
    const marge = (etat.ctrl[P] - etat.ctrl[Q]) * (compteEnCases(etat.params) ? 2 : 1);
    if (etat.vainqueur === P) return 1000 + marge;
    if (etat.vainqueur === Q) return -1000 + marge;
    return marge;
  }
  const a = caracteristiques(etat, P);
  const b = caracteristiques(etat, Q);
  const S = seuilCroisements(etat.params);
  const restant = Math.max(0, etat.params.nbTours - etat.tour + 1) / etat.params.nbTours;
  const ft = Math.pow(restant, Math.max(0, poids.tours_restants));
  const k = compteEnCases(etat.params) ? poids.echelle_cases ?? POIDS_BASE.echelle_cases : 1;
  return (
    poids.croisements * k * (a.ctrl - b.ctrl) +
    poids.cases * (a.cases - b.cases) +
    poids.potentiel * ft * (a.potentiel - b.potentiel) -
    poids.exposition * ft * (a.exposition - b.exposition) -
    poids.coupure * (a.coupure - b.coupure) +
    poids.reserve * (a.reserve - b.reserve) +
    (poids.reserve_garde || 0) * (Math.min(1, a.reserve) - Math.min(1, b.reserve)) +
    (poids.presence || 0) * (Math.sqrt(Math.max(0, a.pions - 1)) - Math.sqrt(Math.max(0, b.pions - 1))) + // à partir du 2e pion : le 1er est toujours posé
    (poids.mobilite || 0) * ft * (a.mobilite - b.mobilite) +
    (poids.menaces || 0) * ft * (a.menaces - b.menaces) +
    poids.seuil * ((a.ctrl / S) ** 2 - (b.ctrl / S) ** 2)
  );
}

// ---------------------------------------------------------------------------
// Pré-tri rapide (étapes 4 et 5 du moteur, sans copie profonde ni journal conservé)
// ---------------------------------------------------------------------------

/**
 * Contexte de pré-tri pour P : murs par case et union-find des murs (bord = un seul nœud).
 * Sert seulement à ÉLAGUER : un trajet qui ne crée aucun cycle de murs ne peut pas séparer de
 * régions, donc ne ferme rien ; on n'appelle les étapes 4-5 du moteur que pour les autres.
 */
function contextePreTri(etat, P) {
  const n = etat.params.grille;
  const nb = nbCroisements(n);
  const BORD = nb;
  const parent = new Int32Array(nb + 1);
  for (let i = 0; i <= nb; i++) parent[i] = i;
  const trouver = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const noeud = (c) => (estSurBord(n, c) ? BORD : c);
  for (const [s, j] of Object.entries(etat.couleurs)) {
    if (j !== P) continue;
    const [a, b] = s.split('-');
    const ra = trouver(noeud(+a)), rb = trouver(noeud(+b));
    if (ra !== rb) parent[ra] = rb;
  }
  return { murs: mursParCase(etat, P), trouver, noeud };
}

function creeCycle(ctx, etat, P, chemin) {
  // union-find local (superposé) : un nouveau segment qui relie deux nœuds déjà reliés crée un cycle
  const loc = new Map();
  const tr = (x) => { let r = ctx.trouver(x); while (loc.has(r)) r = loc.get(r); return r; };
  for (let k = 1; k < chemin.length; k++) {
    const s = cleSegment(chemin[k - 1], chemin[k]);
    if (etat.couleurs[s] === P) continue;
    const a = tr(ctx.noeud(chemin[k - 1])), b = tr(ctx.noeud(chemin[k]));
    if (a === b) return true;
    loc.set(a, b);
  }
  return false;
}

function preScore(etat, P, ordre, poids, ctx) {
  if (ordre.type === 'poser') {
    // passe « IA robuste » : une pose près de ses murs (cases à 2-3 murs non possédées) prépare une fermeture.
    const { autour } = geo(etat.params.grille);
    let v = 0;
    for (const k of autour[ordre.croisement]) if (etat.proprietaires[k] !== P) v += ctx.murs[k] >= 3 ? 1 : ctx.murs[k] === 2 ? 0.4 : ctx.murs[k] === 1 ? 0.1 : 0;
    return v;
  }
  if (ordre.type !== 'deplacer') return 0;
  const g = geo(etat.params.grille);
  // potentiel ajouté : cases touchées par les nouveaux segments
  const touchees = new Map();
  const segsNeufs = new Set();
  for (let k = 1; k < ordre.chemin.length; k++) {
    const s = cleSegment(ordre.chemin[k - 1], ordre.chemin[k]);
    if (etat.couleurs[s] === P || segsNeufs.has(s)) continue;
    segsNeufs.add(s);
    for (const c of g.casesDuSegment.get(s) || []) touchees.set(c, (touchees.get(c) || 0) + 1);
  }
  const f = (m) => (m >= 3 ? 1 : m === 2 ? 0.3 : 0);
  let pot = 0;
  for (const [c, plus] of touchees) if (etat.proprietaires[c] !== P) pot += f(ctx.murs[c] + plus) - f(ctx.murs[c]);
  let gain = 0;
  // Repasser sur sa propre trace compte dans nouveaux(P) (moteur) : on vérifie alors aussi.
  const retrace = segsNeufs.size < ordre.chemin.length - 1;
  if (retrace || creeCycle(ctx, etat, P, ordre.chemin)) {
    const b = { ...etat, pions: { A: etat.pions.A.slice(), B: etat.pions.B.slice() }, reserve: { ...etat.reserve }, couleurs: { ...etat.couleurs } };
    const ex = executer(b, { A: null, B: null, [P]: ordre });
    const fe = fermeturesDe(b, P, ex.nouveaux[P], ex.trajets[P]);
    for (const k of fe.gain) if (etat.proprietaires[k] !== P) gain++;
  }
  ordre._gain = gain; // mémo local (l'ordre n'est jamais transmis au moteur avec ce champ : voir nettoyer)
  return gain * 4 + poids.potentiel * pot + 0.05 * segsNeufs.size;
}

/**
 * Cibles de coupure : croisements par où passent le plus de fermetures adverses (pondérées par leur gain).
 * décision Lomig 03/11 (Q10) : on ne pose pas sur un croisement occupé (départ d'un pion qui bouge
 * compris). Les appelants passent chaque cible par validerOrdre, qui écarte ces poses : l'IA ne les
 * génère jamais. On ne les retire pas ici, exprès : les retirer en amont ajoute d'autres coupures
 * à la recherche (budget fixe) et, dans la partie de Lomig, la forte ne bloque plus le tour 9.
 */
function ciblesDeCoupure(_etat, fermants, nb) {
  const poidsC = new Map();
  for (const { ordre, gain } of fermants) {
    for (const c of new Set(ordre.chemin)) poidsC.set(c, (poidsC.get(c) || 0) + gain);
  }
  return [...poidsC.entries()].sort((x, y) => y[1] - x[1]).slice(0, nb).map(([c]) => c);
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

function creerCompteur(opts) {
  const debut = Date.now();
  return {
    n: 0,
    reste() {
      return this.n < opts.budget && Date.now() - debut < opts.msMax;
    },
  };
}

// Pions capturés pendant la résolution qui a produit un état (par victime). Les états sont gelés :
// on garde l'information à côté, dans une WeakMap.
const CAPTURES = new WeakMap();

function resoudre(etat, P, oP, oQ, cpt) {
  cpt.n++;
  const Q = adversaire(P);
  const r = resoudreTour(etat, { [P]: oP, [Q]: oQ });
  if (etat.params.capture && etat.params.capture !== 'aucune') {
    const c = { A: 0, B: 0 };
    for (const x of r.journal) if (x.code === 'CAPTURE') c[x.joueur]++;
    if (c.A || c.B) CAPTURES.set(r.etat, c);
  }
  return r.etat;
}

/** Évaluation d'un état issu de `resoudre` : evaluer + pions capturés à ce tour (poids `capture`). */
function valeur(apres, P, poids) {
  const v = evaluer(apres, P, poids);
  const c = CAPTURES.get(apres);
  if (!c) return v;
  const def = apres.params.capture === 'definitive' || apres.params.capture === 'sans_retour';
  const w = def ? poids.capture_definitive ?? POIDS_BASE.capture_definitive : poids.capture ?? POIDS_BASE.capture;
  return v + w * (c[adversaire(P)] - c[P]);
}

/** Ordres de P classés : pré-tri puis évaluation à 1 tour contre « Passer ». */
function meilleursOrdres(etat, P, poids, cpt, { nPre, nGarde, rng, nPoses = 6 }) {
  const tous = ordresLegaux(etat, P);
  const ctx = contextePreTri(etat, P);
  let notes = tous.map((ordre) => {
    const pre = preScore(etat, P, ordre, poids, ctx) + (rng ? rng.reel() * 0.01 : 0);
    const gain = ordre._gain || 0;
    delete ordre._gain;
    return { ordre, pre, gain };
  });
  notes.sort((a, b) => b.pre - a.pre);
  const fermants = notes.filter((x) => x.gain > 0).map((x) => ({ ordre: x.ordre, gain: x.gain }));
  // On garde toujours quelques poses et Passer, même si le pré-tri les classe bas.
  const tete = notes.slice(0, nPre);
  for (const t of notes.filter((x) => x.ordre.type === 'poser').slice(0, nPoses)) if (!tete.includes(t)) tete.push(t);
  if (!tete.some((x) => x.ordre.type === 'passer')) tete.push(notes.find((x) => x.ordre.type === 'passer'));
  const res = [];
  for (const t of tete) {
    const apres = resoudre(etat, P, t.ordre, passer(), cpt);
    res.push({ ordre: t.ordre, score: valeur(apres, P, poids), etat: apres });
  }
  res.sort((a, b) => b.score - a.score);
  return { classes: res.slice(0, nGarde), nb: tous.length, fermants };
}

const cleCible = (o) => (o.type === 'poser' ? 'p' + o.croisement : o.type === 'deplacer' ? 'd' + o.chemin.at(-1) : o.type);
const cleOrdre = (o) => (o.type === 'poser' ? 'p' + o.croisement : o.type === 'deplacer' ? 'd' + o.chemin.join('.') : o.type);

/**
 * Choisit l'ordre de `joueur`.
 * @param {object} etat état gelé
 * @param {'A'|'B'} joueur
 * @param {object} rng générateur à graine (engine/rng.js)
 * @param {object} [options] { poids, budget (résolutions), msMax, kCandidats, mReponses, stats }
 */
export function choisirOrdre(etat, joueur, rng, options = {}) {
  if (etat.fini) return rien();
  const definies = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  const opts = { ...OPTIONS_DEFAUT, ...definies, poids: { ...POIDS_BASE, ...(options.poids || poidsActifs()) } };
  const w = opts.poids;
  const P = joueur;
  const Q = adversaire(P);
  const cpt = creerCompteur(opts);
  // Copie légère pour la simulation : l'historique ne sert pas à la résolution.
  const base = { ...etat, historique: [] };

  // 1-3. Nos meilleurs ordres et ceux de l'adversaire, à 1 tour.
  const nous = meilleursOrdres(base, P, w, cpt, { nPre: 40, nGarde: opts.kCandidats, rng, nPoses: opts.nPoses });
  const eux = meilleursOrdres(base, Q, w, cpt, { nPre: 30, nGarde: opts.mReponses, rng });

  // Nos coupures : poses sur les croisements des trajets adverses qui ferment (étape 3b du moteur).
  // Elles passent juste après nos 3 meilleurs ordres : si le budget s'épuise, les lignes de fin sautent, pas elles.
  const tete = nous.classes.map((x) => x.ordre);
  const coupures = [];
  if (base.reserve[P] > 0) {
    for (const c of ciblesDeCoupure(base, eux.fermants, 4)) {
      const o = poser(c);
      if (validerOrdre(base, P, o).ok && ![...tete, ...coupures].some((x) => cleOrdre(x) === cleOrdre(o))) coupures.push(o);
    }
  }
  const candidats = [...tete.slice(0, 3), ...coupures, ...tete.slice(3)];
  if (!candidats.some((o) => o.type === 'passer')) candidats.splice(Math.min(candidats.length, 3 + coupures.length), 0, passer());

  // Réponses adverses probables, pondérées (softmax de leur valeur à 1 tour).
  const reponses = [];
  const maxQ = Math.max(...eux.classes.map((x) => x.score));
  for (const x of eux.classes) reponses.push({ ordre: x.ordre, poids: Math.exp((x.score - maxQ) / Math.max(0.1, w.temperature)) });
  // Leurs autres fermetures : la meilleure de chaque pion qui n'est pas déjà dans l'échantillon.
  const parPion = new Map();
  for (const f of eux.fermants) if (!parPion.has(f.ordre.chemin[0])) parPion.set(f.ordre.chemin[0], f);
  for (const f of parPion.values()) {
    if (reponses.some((r) => cleOrdre(r.ordre) === cleOrdre(f.ordre))) continue;
    reponses.push({ ordre: f.ordre, poids: Math.exp((-4) / Math.max(0.1, w.temperature)) });
  }
  const sommeQ = reponses.reduce((s, r) => s + r.poids, 0) || 1;
  for (const r of reponses) r.poids /= sommeQ;
  if (base.reserve[Q] > 0) {
    for (const c of ciblesDeCoupure(base, nous.fermants, 3)) {
      const o = poser(c);
      if (validerOrdre(base, Q, o).ok && !reponses.some((r) => cleOrdre(r.ordre) === cleOrdre(o))) reponses.push({ ordre: o, poids: w.poids_coupe / 3 });
    }
  }
  if (!reponses.some((r) => r.ordre.type === 'passer')) reponses.push({ ordre: passer(), poids: 0.05 });
  const total = reponses.reduce((s, r) => s + r.poids, 0);
  for (const r of reponses) r.poids /= total;

  // 4. Matrice de gains.
  const lignes = [];
  for (const o of candidats) {
    if ((!cpt.reste() || cpt.n >= opts.partMatrice * opts.budget) && lignes.length >= 3) break;
    const vals = [];
    for (const r of reponses) {
      const apres = resoudre(base, P, o, r.ordre, cpt);
      vals.push({ v: valeur(apres, P, w), etat: apres, p: r.poids });
    }
    const min = Math.min(...vals.map((x) => x.v));
    const moy = vals.reduce((s, x) => s + x.v * x.p, 0);
    lignes.push({ ordre: o, vals, score: w.maximin * min + (1 - w.maximin) * moy });
  }
  lignes.sort((a, b) => b.score - a.score);

  // 5. Profondeur 2 : pour les meilleurs candidats, meilleur coup suivant contre les réponses les plus probables.
  if (w.profondeur2 > 0 && etat.tour < etat.params.nbTours) {
    const top = lignes.slice(0, 4);
    const probables = reponses.map((r, i) => ({ i, p: r.poids })).sort((a, b) => b.p - a.p).slice(0, 2);
    for (const l of top) {
      let somme = 0;
      let poidsTot = 0;
      for (const { i, p } of probables) {
        const s1 = l.vals[i].etat;
        if (s1.fini || !cpt.reste()) continue;
        const suite = meilleursOrdres({ ...s1, historique: [] }, P, w, cpt, { nPre: 8, nGarde: 1 });
        somme += p * suite.classes[0].score;
        poidsTot += p;
      }
      if (poidsTot > 0) l.score = (1 - w.profondeur2) * l.score + w.profondeur2 * (somme / poidsTot);
    }
    lignes.sort((a, b) => b.score - a.score);
  }

  // 5 bis. Équilibre de la matrice (jeu simultané) : un coup prévisible se fait couper ou percuter.
  if ((w.equilibre || 0) > 0 && lignes.length > 1 && rng.reel() < w.equilibre) {
    const x = equilibreMatrice(lignes.map((l) => l.vals.map((v) => v.v)));
    const garde = x.map((p, i) => ({ p, i })).filter((z) => z.p >= 0.04);
    if (opts.stats) opts.stats.mixte = garde.map((z) => +z.p.toFixed(2));
    if (garde.length) {
      const tot = garde.reduce((a, z) => a + z.p, 0);
      let u = rng.reel() * tot;
      for (const z of garde) { u -= z.p; if (u <= 0) return finir(lignes[z.i]); }
      return finir(lignes[garde[garde.length - 1].i]);
    }
  }

  // 5 bis'. Répétition d'un ordre annulé.
  if ((w.repetition || 0) > 0 && etat.historique?.length) {
    const echecs = new Map();
    for (let h = etat.historique.length - 1; h >= 0; h--) {
      const t = etat.historique[h];
      const o = t.ordres?.[P];
      if (!o || (o.type !== 'deplacer' && o.type !== 'poser')) break;
      if (t.journal?.some((x) => x.joueur === P && (x.code === 'DEPLACEMENT' || x.code === 'POSE'))) break;
      // clé : la destination (un autre chemin vers la même arrivée se fait percuter de la même façon)
      const k = cleCible(o);
      echecs.set(k, (echecs.get(k) || 0) + 1);
    }
    if (echecs.size) {
      for (const l of lignes) l.score -= w.repetition * (echecs.get(cleCible(l.ordre)) || 0);
      lignes.sort((a, b) => b.score - a.score);
    }
  }

  // 5 ter. Marge de déploiement.
  if ((w.deploiement || 0) > 0 && base.reserve[P] >= 2) {
    const pose = lignes.find((l) => l.ordre.type === 'poser' && l.score >= lignes[0].score - w.deploiement);
    if (pose && pose !== lignes[0]) return finir(pose);
  }

  // 6. Aléa graïné entre les coups proches.
  const meilleur = lignes[0].score;
  const proches = lignes.filter((l) => l.score >= meilleur - Math.max(0, w.alea));
  const choix = proches.length > 1 ? rng.choisir(proches) : lignes[0];
  return finir(choix);
  function finir(choix) {
  if (opts.stats) {
    opts.stats.resolutions = cpt.n;
    opts.stats.candidats = candidats.length;
    opts.stats.reponses = reponses.length;
    opts.stats.ordresLegaux = nous.nb;
    opts.stats.lignes = lignes.slice(0, 6).map((l) => ({ ordre: l.ordre, score: +l.score.toFixed(2), vals: l.vals.map((x) => +x.v.toFixed(1)) }));
    opts.stats.toutes = lignes.map((l) => ({ type: l.ordre.type, score: l.score, min: Math.min(...l.vals.map((x) => x.v)) }));
    opts.stats.candidatsTypes = candidats.map((o) => o.type);
    opts.stats.reponsesDetail = reponses.map((r) => ({ ordre: r.ordre, p: +r.poids.toFixed(3) }));
  }
  return choix.ordre;
  }
}

/**
 * Stratégie mixte approchée du joueur « lignes » sur une matrice de gains M[i][j] (somme nulle :
 * l'adversaire minimise). Regret matching des deux côtés, stratégie moyenne. Déterministe.
 */
export function equilibreMatrice(M, iterations = 400) {
  const n = M.length, m = M[0].length;
  const rL = new Float64Array(n), rC = new Float64Array(m), sL = new Float64Array(n);
  const strat = (r) => { let t = 0; for (const v of r) if (v > 0) t += v; return Array.from(r, (v) => (t > 0 ? Math.max(0, v) / t : 1 / r.length)); };
  for (let it = 0; it < iterations; it++) {
    const x = strat(rL), y = strat(rC);
    const uL = new Float64Array(n), uC = new Float64Array(m);
    let val = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { uL[i] += M[i][j] * y[j]; uC[j] += M[i][j] * x[i]; }
    for (let i = 0; i < n; i++) val += x[i] * uL[i];
    for (let i = 0; i < n; i++) rL[i] += uL[i] - val;
    for (let j = 0; j < m; j++) rC[j] += val - uC[j];
    // moyenne pondérée (les itérations tardives comptent plus), plus stable
    for (let i = 0; i < n; i++) sL[i] += (it + 1) * x[i];
  }
  const t = sL.reduce((a, b) => a + b, 0);
  return Array.from(sL, (v) => v / t);
}
