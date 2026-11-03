#!/usr/bin/env node
// Arène et tuning de l'IA (node, sans dépendance). Tous les tirages sont graïnés : mêmes options =>
// mêmes parties (le budget de l'IA forte se compte en résolutions, pas en millisecondes).
//
//   node tools/arena.js match  --a forte --b faible --parties 200 [--reglages grille=9,reprise=oui] [--graine 1]
//   node tools/arena.js banc   [--parties 100] [--graine 1]          (forte/faible, tunée/base, par réglage)
//   node tools/arena.js tuning [--generations 10] [--population 8] [--parties 24] [--validation 300] [--graine 7]
//   node tools/arena.js expansion [--parties 60] [--graine 3]        (vitesse d'expansion selon trajet_max)
// Options communes : --workers N (défaut : nb de cœurs), --json fichier (résultats bruts).
// Configurations : faible | forte (poids de base) | tunee (ai/poids-tunes.json) | fichier:chemin.json
// Le moteur (engine/) est le seul arbitre : l'arène ne contient aucune règle.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerEtat, resoudreTour, creerRng, adversaire, nbCases, cotesCase } from '../engine/index.js';
import * as faible from '../ai/ia-faible.js';
import * as forte from '../ai/ia-forte.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const FICHIER_POIDS = path.join(ICI, '..', 'ai', 'poids-tunes.json');

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

/** Intervalle de Wilson à 95 % pour k succès sur n. */
export function wilson(k, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const e = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - e) / d, (c + e) / d];
}

/** Graine dérivée (entier 32 bits) à partir d'une graine et d'indices. */
export function deriver(...xs) {
  let h = 2166136261;
  for (const x of xs) {
    h ^= x >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

const pct = (x) => (100 * x).toFixed(1) + ' %';
const moyenne = (t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0);
const quantile = (t, q) => {
  if (!t.length) return 0;
  const s = t.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

// ---------------------------------------------------------------------------
// Configurations de joueurs
// ---------------------------------------------------------------------------

export function lirePoidsTunes() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_POIDS, 'utf8')).poids;
  } catch {
    return null;
  }
}

/** Résout une configuration nommée en objet sérialisable. */
export function config(nom, extra = {}) {
  if (typeof nom === 'object') return nom;
  if (nom === 'faible') return { nom, type: 'faible' };
  if (nom === 'forte') return { nom, type: 'forte', poids: { ...forte.POIDS_BASE }, ...extra };
  if (nom === 'tunee') {
    const p = lirePoidsTunes();
    if (!p) throw new Error('ai/poids-tunes.json absent : lancez d’abord « node tools/arena.js tuning ».');
    return { nom, type: 'forte', poids: { ...forte.POIDS_BASE, ...p }, ...extra };
  }
  if (nom.startsWith('fichier:')) {
    const j = JSON.parse(fs.readFileSync(nom.slice(8), 'utf8'));
    return { nom, type: 'forte', poids: { ...forte.POIDS_BASE, ...(j.poids || j) }, ...extra };
  }
  throw new Error(`Configuration inconnue : ${nom}`);
}

function jouerOrdre(cfg, etat, j, rng) {
  if (cfg.type === 'faible') return faible.choisirOrdre(etat, j, rng);
  return forte.choisirOrdre(etat, j, rng, { poids: cfg.poids, budget: cfg.budget ?? 700, kCandidats: cfg.kCandidats, mReponses: cfg.mReponses });
}

/** Cases gagnées ce tour par P, regroupées en morceaux 4-connexes ; un morceau « s'appuie sur le bord » s'il touche le bord. */
function fermeturesDuTour(n, avant, apres, P) {
  const N = nbCases(n);
  const neuves = new Set();
  for (let k = 0; k < N; k++) if (apres[k] === P && avant[k] !== P) neuves.add(k);
  const res = [];
  const vu = new Set();
  for (const s of neuves) {
    if (vu.has(s)) continue;
    let taille = 0;
    let bord = false;
    const pile = [s];
    vu.add(s);
    while (pile.length) {
      const k = pile.pop();
      taille++;
      for (const { voisine } of cotesCase(n, k)) {
        if (voisine < 0) bord = true;
        else if (neuves.has(voisine) && !vu.has(voisine)) {
          vu.add(voisine);
          pile.push(voisine);
        }
      }
    }
    res.push({ taille, bord });
  }
  return res;
}

/**
 * Joue une partie. cfg.A / cfg.B : configurations. Retourne un résumé sérialisable.
 */
export function jouerPartie({ cfgA, cfgB, params, graine }) {
  let e = creerEtat(params);
  const rngs = { A: creerRng(deriver(graine, 1)), B: creerRng(deriver(graine, 2)) };
  const cfg = { A: cfgA, B: cfgB };
  const temps = { A: [], B: [] };
  const ctrlParTour = [];
  const fermetures = { A: [], B: [] };
  const ordres = { A: { poser: 0, deplacer: 0, passer: 0, rien: 0 }, B: { poser: 0, deplacer: 0, passer: 0, rien: 0 } };
  const longueurs = { A: [], B: [] };
  let coupes = 0;
  while (!e.fini) {
    const o = {};
    for (const j of ['A', 'B']) {
      const t = performance.now();
      o[j] = jouerOrdre(cfg[j], e, j, rngs[j]);
      temps[j].push(performance.now() - t);
      ordres[j][o[j].type]++;
      if (o[j].type === 'deplacer') longueurs[j].push(o[j].chemin.length - 1);
    }
    const avant = e.proprietaires;
    const r = resoudreTour(e, o);
    coupes += r.journal.filter((x) => x.code === 'COUPURE' || x.code === 'RENCONTRE').length;
    e = r.etat;
    for (const j of ['A', 'B']) for (const f of fermeturesDuTour(e.params.grille, avant, e.proprietaires, j)) fermetures[j].push({ ...f, tour: e.historique.at(-1).tour });
    ctrlParTour.push({ A: e.ctrl.A, B: e.ctrl.B });
  }
  return { vainqueur: e.vainqueur, raison: e.raisonFin, tours: e.historique.length, ctrl: e.ctrl, temps, ctrlParTour, fermetures, ordres, longueurs, coupes, params };
}

// ---------------------------------------------------------------------------
// Parallélisme (worker_threads)
// ---------------------------------------------------------------------------

if (!isMainThread) {
  parentPort.on('message', (tache) => {
    if (tache === 'fin') process.exit(0);
    parentPort.postMessage({ id: tache.id, res: jouerPartie(tache) });
  });
}

let nbWorkers = Math.max(1, os.cpus().length);

/** Joue toutes les tâches en parallèle ; l'ordre des résultats suit celui des tâches. */
export async function jouerTout(taches, { workers = nbWorkers, progression } = {}) {
  if (workers <= 1) return taches.map((t) => jouerPartie(t));
  const res = new Array(taches.length);
  let suivant = 0;
  let finis = 0;
  await new Promise((ok, ko) => {
    const pool = [];
    const nb = Math.min(workers, taches.length);
    if (nb === 0) return ok();
    for (let w = 0; w < nb; w++) {
      const wk = new Worker(new URL(import.meta.url));
      pool.push(wk);
      const donner = () => {
        if (suivant < taches.length) {
          const id = suivant++;
          wk.postMessage({ ...taches[id], id });
        } else wk.postMessage('fin');
      };
      wk.on('message', ({ id, res: r }) => {
        res[id] = r;
        finis++;
        if (progression) progression(finis, taches.length);
        if (finis === taches.length) ok();
        donner();
      });
      wk.on('error', ko);
      donner();
    }
  });
  return res;
}

// ---------------------------------------------------------------------------
// Matchs et rapports
// ---------------------------------------------------------------------------

/** Tâches d'un match : couleurs alternées (partie paire : X joue A ; impaire : X joue B). */
export function tachesMatch(cfgX, cfgY, params, n, graine) {
  const t = [];
  for (let i = 0; i < n; i++) {
    const xA = i % 2 === 0;
    t.push({ cfgA: xA ? cfgX : cfgY, cfgB: xA ? cfgY : cfgX, params, graine: deriver(graine, i), xA });
  }
  return t;
}

/** Agrège les résultats d'un match du point de vue de X. */
export function bilan(taches, res) {
  let v = 0, d = 0, nul = 0, seuil = 0, tours20 = 0;
  const durees = [];
  const tX = [], tY = [];
  const passesX = [];
  for (let i = 0; i < res.length; i++) {
    const r = res[i];
    const X = taches[i].xA ? 'A' : 'B';
    const Y = adversaire(X);
    if (r.vainqueur === X) v++;
    else if (r.vainqueur === 'nul') nul++;
    else d++;
    if (r.vainqueur !== 'nul') (r.raison === 'seuil' ? seuil++ : tours20++);
    durees.push(r.tours);
    tX.push(...r.temps[X]);
    tY.push(...r.temps[Y]);
    const tot = Object.values(r.ordres[X]).reduce((a, b) => a + b, 0);
    passesX.push(r.ordres[X].passer / tot);
  }
  const n = res.length;
  const decisives = v + d;
  return {
    parties: n, victoires: v, defaites: d, nuls: nul,
    tauxSansNuls: decisives ? v / decisives : 0, icSansNuls: wilson(v, decisives),
    tauxNulsDemi: (v + nul / 2) / n, icAvecNuls: wilson(v + nul / 2, n),
    victoiresAuSeuil: seuil, victoiresAuTour20: tours20,
    dureeMoy: moyenne(durees), dureeP95: quantile(durees, 0.95),
    msParCoupX: { moy: moyenne(tX), p95: quantile(tX, 0.95) }, msParCoupY: { moy: moyenne(tY), p95: quantile(tY, 0.95) },
    partPassesX: moyenne(passesX),
  };
}

export function texteBilan(nomX, nomY, reglage, b) {
  const [lo, hi] = b.icSansNuls;
  return `${nomX} contre ${nomY} [${reglage}] : ${b.victoires} V / ${b.defaites} D / ${b.nuls} N sur ${b.parties}` +
    ` — victoires (nuls exclus) ${pct(b.tauxSansNuls)} [IC95 ${pct(lo)} ; ${pct(hi)}]` +
    ` ; nuls = ½ : ${pct(b.tauxNulsDemi)} [${pct(b.icAvecNuls[0])} ; ${pct(b.icAvecNuls[1])}]` +
    ` — fins au seuil ${b.victoiresAuSeuil}, au dernier tour ${b.victoiresAuTour20} — durée ${b.dureeMoy.toFixed(1)} tours (p95 ${b.dureeP95})` +
    ` — ms/coup ${nomX} ${b.msParCoupX.moy.toFixed(0)} (p95 ${b.msParCoupX.p95.toFixed(0)}), ${nomY} ${b.msParCoupY.moy.toFixed(1)} (p95 ${b.msParCoupY.p95.toFixed(1)})`;
}

export function lireReglages(txt) {
  const p = {};
  if (!txt) return p;
  for (const kv of txt.split(',')) {
    const [k, v] = kv.split('=');
    p[k] = /^\d+$/.test(v) ? Number(v) : v;
  }
  return p;
}
const nomReglage = (p) => Object.entries(p).map(([k, v]) => `${k}=${v}`).join(',') || 'défauts';

/** Réglages du banc : grille 7/8/9 × reprise oui/non, et quelques variantes. */
export const REGLAGES_BANC = [
  { grille: 9, reprise: 'oui' }, { grille: 9, reprise: 'non' },
  { grille: 8, reprise: 'oui' }, { grille: 8, reprise: 'non' },
  { grille: 7, reprise: 'oui' }, { grille: 7, reprise: 'non' },
  { grille: 9, trajet_max: 3 }, { grille: 9, trajet_max: 7 },
  { grille: 9, capture: 'retour' }, { grille: 9, traces: 'decoratives' },
];

async function match(nomX, nomY, params, n, graine, options = {}) {
  const cx = config(nomX, options.extraX);
  const cy = config(nomY, options.extraY);
  const taches = tachesMatch(cx, cy, params, n, graine);
  const res = await jouerTout(taches, options);
  return { b: bilan(taches, res), res, taches };
}

// ---------------------------------------------------------------------------
// Tuning : stratégie évolutionnaire (1+λ) contre un pool d'adversaires
// ---------------------------------------------------------------------------

const BORNES = {
  croisements: [0.1, 5], cases: [0, 3], potentiel: [0, 6], exposition: [0, 4], coupure: [0, 4], reserve: [-2, 2],
  seuil: [0, 60], tours_restants: [0, 3], maximin: [0, 1], temperature: [0.3, 10], poids_coupe: [0, 3], profondeur2: [0, 0.8], alea: [0, 2],
};

export function muter(poids, rng, sigma) {
  const p = { ...poids };
  for (const [k, [lo, hi]] of Object.entries(BORNES)) {
    if (rng.reel() > 0.6) continue; // on ne touche qu'à une partie des poids
    const g = (rng.reel() + rng.reel() + rng.reel() - 1.5) * 2; // ~ normale
    const v = p[k] + g * sigma * (hi - lo) * 0.25;
    p[k] = Math.min(hi, Math.max(lo, Number(v.toFixed(3))));
  }
  return p;
}

async function tuning(o) {
  const rng = creerRng(o.graine);
  const budgetTuning = { budget: o.budgetTuning }; // mêmes kCandidats et mReponses que l'IA du jeu
  const base = { nom: 'base', type: 'forte', poids: { ...forte.POIDS_BASE }, ...budgetTuning };
  const pool = [{ nom: 'faible', type: 'faible' }, base];
  let parent = { ...base, nom: 'gen0' };
  const histoire = [];
  const reglagesTuning = [{ grille: 9, reprise: 'oui' }, { grille: 9, reprise: 'non' }, { grille: 8, reprise: 'oui' }, { grille: 7, reprise: 'oui' }];
  const fitness = async (cands, gen) => {
    // mêmes graines pour tous les candidats d'une génération (nombres aléatoires communs)
    const taches = [];
    const meta = [];
    for (let c = 0; c < cands.length; c++) {
      for (let a = 0; a < pool.length; a++) {
        const nb = pool[a].type === 'faible' ? Math.max(2, Math.round(o.parties / 6)) : o.parties;
        for (let i = 0; i < nb; i++) {
          const params = reglagesTuning[i % reglagesTuning.length];
          const xA = i % 2 === 0;
          const g = deriver(o.graine, 1000 + gen, a, i);
          taches.push({ cfgA: xA ? cands[c] : pool[a], cfgB: xA ? pool[a] : cands[c], params, graine: g, xA });
          meta.push({ c, a });
        }
      }
    }
    const res = await jouerTout(taches, o);
    const sc = cands.map(() => ({ pts: 0, n: 0, parAdv: {} }));
    res.forEach((r, i) => {
      const X = taches[i].xA ? 'A' : 'B';
      const pts = r.vainqueur === X ? 1 : r.vainqueur === 'nul' ? 0.5 : 0;
      const { c, a } = meta[i];
      const w = pool[a].type === 'faible' ? 0.5 : 1; // la faible pèse moins (elle ne départage pas)
      sc[c].pts += w * pts;
      sc[c].n += w;
      const k = pool[a].nom;
      sc[c].parAdv[k] = (sc[c].parAdv[k] || 0) + pts;
    });
    return sc.map((s) => ({ f: s.pts / s.n, parAdv: s.parAdv }));
  };
  let sigma = o.sigma;
  for (let gen = 1; gen <= o.generations; gen++) {
    const t0 = Date.now();
    const mutants = [];
    for (let m = 0; m < o.population; m++) mutants.push({ ...parent, nom: `g${gen}m${m}`, poids: muter(parent.poids, rng, sigma) });
    const cands = [parent, ...mutants];
    const f = await fitness(cands, gen);
    let best = 0;
    for (let c = 1; c < cands.length; c++) if (f[c].f > f[best].f) best = c;
    const ligne = { gen, parent: f[0].f, meilleur: f[best].f, choisi: cands[best].nom, parAdv: f[best].parAdv, sigma, s: (Date.now() - t0) / 1000 };
    histoire.push(ligne);
    console.log(`génération ${gen} : parent ${pct(f[0].f)} ; meilleur ${cands[best].nom} ${pct(f[best].f)} ${JSON.stringify(f[best].parAdv)} (${ligne.s.toFixed(0)} s)`);
    if (best !== 0) {
      parent = { ...cands[best], nom: `gen${gen}` };
      pool.push({ ...parent, nom: `hof${gen}` }); // les meilleures versions précédentes rejoignent le pool
      if (pool.length > 4) pool.splice(2, 1); // pool : faible, base, et les 2 dernières meilleures
      sigma = Math.min(1, sigma * 1.2);
    } else sigma = Math.max(0.15, sigma * 0.8);
  }
  // Validation : parties séparées (autres graines), budget complet, tunée contre forte de base.
  const tunee = { nom: 'tunee', type: 'forte', poids: parent.poids };
  const baseV = { nom: 'forte', type: 'forte', poids: { ...forte.POIDS_BASE } };
  const valid = [];
  const regV = [{ grille: 9, reprise: 'oui' }, { grille: 9, reprise: 'non' }, { grille: 8, reprise: 'oui' }, { grille: 7, reprise: 'oui' }];
  const tachesV = [];
  regV.forEach((params, r) => tachesV.push(...tachesMatch(tunee, baseV, params, Math.round(o.validation / regV.length), deriver(o.graine, 99999, r))));
  const resV = await jouerTout(tachesV, o);
  const bTot = bilan(tachesV, resV);
  console.log('\nValidation (graines séparées, budget complet) :');
  console.log(texteBilan('tunée', 'forte de base', 'tous réglages', bTot));
  let i0 = 0;
  for (const params of regV) {
    const n = Math.round(o.validation / regV.length);
    const b = bilan(tachesV.slice(i0, i0 + n), resV.slice(i0, i0 + n));
    valid.push({ reglage: nomReglage(params), ...b });
    console.log('  ' + texteBilan('tunée', 'base', nomReglage(params), b));
    i0 += n;
  }
  const sortie = {
    description: 'Poids de l’IA forte tunés par tools/arena.js (stratégie évolutionnaire 1+λ contre un pool : faible, forte de base, meilleures versions précédentes). Lu par ai/ia-forte.js (niveau Fort).',
    date: new Date().toISOString(), graine: o.graine, generations: o.generations, population: o.population, partiesParAdversaire: o.parties,
    budgetTuning: o.budgetTuning, poids: parent.poids, historique: histoire,
    validation: { total: bTot, parReglage: valid },
  };
  if (bTot.icSansNuls[0] > 0.5 || o.forcer) {
    fs.writeFileSync(o.sortie, JSON.stringify(sortie, null, 2) + '\n');
    console.log(`\nPoids enregistrés : ${o.sortie}`);
  } else {
    fs.writeFileSync(o.sortie.replace(/\.json$/, '.rejet.json'), JSON.stringify(sortie, null, 2) + '\n');
    console.log('\nLa version tunée ne bat pas la base de façon significative : poids NON enregistrés (voir .rejet.json).');
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Expansion (vitesse) selon trajet_max, fermetures avec ou sans bord
// ---------------------------------------------------------------------------

export function statsExpansion(res) {
  const vit = [];
  const premier58 = [];
  let fB = 0, fS = 0, cB = 0, cS = 0;
  for (const r of res) {
    // vitesse : croisements gagnés par tour par le joueur en tête, entre sa première fermeture et la fin
    const j = r.ctrl.A >= r.ctrl.B ? 'A' : 'B';
    const serie = r.ctrlParTour.map((x) => x[j]);
    const debut = serie.findIndex((x) => x > 0);
    if (debut >= 0) vit.push(serie[serie.length - 1] / (serie.length - debut));
    const t58 = serie.findIndex((x) => x >= 58);
    premier58.push(t58 >= 0 ? t58 + 1 : null);
    for (const P of ['A', 'B']) for (const f of r.fermetures[P]) {
      if (f.bord) { fB++; cB += f.taille; } else { fS++; cS += f.taille; }
    }
  }
  const atteint = premier58.filter((x) => x != null);
  return {
    vitesse: moyenne(vit), vitesseP90: quantile(vit, 0.9),
    part58: atteint.length / res.length, tour58: moyenne(atteint),
    fermeturesBord: fB, casesBord: cB, fermeturesSansBord: fS, casesSansBord: cS,
    tailleBord: fB ? cB / fB : 0, tailleSansBord: fS ? cS / fS : 0,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argv() {
  const a = process.argv.slice(2);
  const o = { cmd: a[0] };
  for (let i = 1; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
  return o;
}

async function principal() {
  const a = argv();
  if (a.workers) nbWorkers = Number(a.workers);
  const opts = { workers: nbWorkers };
  const graine = Number(a.graine ?? 1);
  const brut = {};
  const t0 = Date.now();
  if (a.cmd === 'match') {
    const params = lireReglages(a.reglages);
    const { b } = await match(a.a || 'forte', a.b || 'faible', params, Number(a.parties ?? 100), graine, { ...opts, extraX: a.budget ? { budget: Number(a.budget) } : {}, extraY: a.budget ? { budget: Number(a.budget) } : {} });
    console.log(texteBilan(a.a || 'forte', a.b || 'faible', nomReglage(params), b));
    brut.match = b;
  } else if (a.cmd === 'banc') {
    const n = Number(a.parties ?? 100);
    const paires = (a.paires || 'forte:faible,tunee:forte').split(',').map((x) => x.split(':'));
    const reglages = a.reglages ? a.reglages.split(';').map(lireReglages) : REGLAGES_BANC;
    for (const [x, y] of paires) {
      brut[`${x}:${y}`] = [];
      for (const [r, params] of reglages.entries()) {
        const { b } = await match(x, y, params, n, deriver(graine, r, x.length * 31 + y.length), opts);
        console.log(texteBilan(x, y, nomReglage(params), b));
        brut[`${x}:${y}`].push({ reglage: nomReglage(params), ...b });
      }
    }
  } else if (a.cmd === 'tuning') {
    brut.tuning = await tuning({
      ...opts, graine: Number(a.graine ?? 7), generations: Number(a.generations ?? 10), population: Number(a.population ?? 8),
      parties: Number(a.parties ?? 24), validation: Number(a.validation ?? 300), sigma: Number(a.sigma ?? 0.6),
      budgetTuning: Number(a.budgetTuning ?? 300), sortie: a.sortie || FICHIER_POIDS, forcer: !!a.forcer,
    });
  } else if (a.cmd === 'expansion') {
    const n = Number(a.parties ?? 60);
    const paires = (a.paires || 'forte:forte,forte:faible').split(',').map((x) => x.split(':'));
    for (const [x, y] of paires) {
      for (const tm of [3, 4, 5, 7]) {
        for (const reprise of ['oui', 'non']) {
          const params = { grille: 9, trajet_max: tm, reprise };
          const { res, b } = await match(x, y, params, n, deriver(graine, tm, reprise === 'oui' ? 1 : 0), opts);
          const s = statsExpansion(res);
          brut[`${x}:${y}:${tm}:${reprise}`] = { ...s, bilan: b };
          console.log(`${x} contre ${y} [trajet_max=${tm}, reprise=${reprise}] : ${s.vitesse.toFixed(2)} croisements/tour pour le meneur (p90 ${s.vitesseP90.toFixed(2)})` +
            ` ; 58 atteint dans ${pct(s.part58)} des parties, au tour ${s.tour58.toFixed(1)} en moyenne` +
            ` ; fermetures appuyées sur le bord ${s.fermeturesBord} (${s.tailleBord.toFixed(1)} cases en moy.), sans le bord ${s.fermeturesSansBord} (${s.tailleSansBord.toFixed(1)} cases)` +
            ` ; durée ${b.dureeMoy.toFixed(1)} tours, fins au seuil ${b.victoiresAuSeuil}/${b.parties}`);
        }
      }
    }
  } else {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).join('\n'));
    return;
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s, ${nbWorkers} workers)`);
  if (a.json) fs.writeFileSync(a.json, JSON.stringify(brut, null, 2));
}

if (isMainThread && process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) principal();
