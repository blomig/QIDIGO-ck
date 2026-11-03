// Fermetures, comptage, fin de partie, et IA faible toujours légale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerEtat as creerEtatBase, longueurMax, resoudreTour, validerOrdre, deplacer, rien, creerRng, indiceCase, compter, copier, geler, nbCases,
} from '../engine/index.js';
import { choisirOrdre } from '../ai/ia-faible.js';
import { etatAvec as etatAvecBase, ch, cr } from './aide.js';

// Comptage en cases par défaut depuis la décision Lomig du 03/11 : ces tests vérifient la logique des CROISEMENTS
// (regles-proto.md), on les épingle donc à comptage = frontiere.
const etatAvec = (o = {}) => etatAvecBase({ ...o, params: { comptage: 'frontiere', ...(o.params || {}) } });
const creerEtat = (p = {}) => creerEtatBase({ comptage: 'frontiere', ...p });


const n = 9;

test('l’état n’est jamais muté', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  const avant = JSON.stringify(e);
  resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: rien() });
  assert.equal(JSON.stringify(e), avant);
  assert.ok(Object.isFrozen(e) && Object.isFrozen(e.pions.A));
});

test('boucle en un seul ordre : ferme une zone dès ce tour', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]])), B: rien() });
  assert.equal(r.etat.proprietaires[indiceCase(n, 2, 2)], 'A');
  assert.equal(r.etat.ctrl.A, 4);
});

test('trajet bord à bord : la plus petite part est gagnée', () => {
  // Trajet de 8 segments, au-delà du défaut de 5 (décision Lomig 03/11) : lancé avec trajet_max = illimité.
  const e = etatAvec({ pions: { A: [[2, 0]] }, params: { trajet_max: 'illimite' } });
  const chemin = [];
  for (let y = 0; y < n; y++) chemin.push([2, y]);
  const r = resoudreTour(e, { A: deplacer(ch(n, chemin)), B: rien() });
  // Colonne x = 2 : à gauche 2 × 8 = 16 cases, à droite 6 × 8 = 48.
  assert.equal(r.etat.proprietaires.filter((x) => x === 'A').length, 16);
  assert.equal(r.etat.ctrl.A, 27); // croisements x = 0..2, toutes lignes
});

test('régions à égalité pour le maximum : toutes sont le dehors', () => {
  // grille 7 : colonne x = 3 coupe 36 cases en 18 + 18 -> aucune zone.
  const e = etatAvec({ params: { grille: 7 }, pions: { A: [[3, 0]] } });
  const chemin = [];
  for (let y = 0; y < 7; y++) chemin.push([3, y]);
  const r = resoudreTour(e, { A: deplacer(ch(7, chemin)), B: rien() });
  assert.equal(r.etat.proprietaires.filter((x) => x).length, 0);
});

test('traces = decoratives : un ancien mur ne compte plus', () => {
  const e = etatAvec({ pions: { A: [[4, 4]] }, params: { traces: 'decoratives' } });
  const t1 = resoudreTour(e, { A: deplacer(ch(n, [[4, 4], [5, 4], [5, 5]])), B: rien() });
  const t2 = resoudreTour(t1.etat, { A: deplacer(ch(n, [[5, 5], [4, 5], [4, 4]])), B: rien() });
  assert.equal(t2.etat.proprietaires[indiceCase(n, 4, 4)], null);
});

test('comptage = interieur : une case seule vaut 0', () => {
  const e = copier(creerEtat({ comptage: 'interieur' }));
  e.proprietaires[indiceCase(n, 4, 4)] = 'A';
  assert.equal(compter(geler(e)).A, 0);
  const f = copier(creerEtat());
  f.proprietaires[indiceCase(n, 4, 4)] = 'A';
  assert.equal(compter(geler(f)).A, 4);
});

test('croisement sur une frontière commune : à personne', () => {
  const e = copier(creerEtat());
  e.proprietaires[indiceCase(n, 0, 0)] = 'A';
  e.proprietaires[indiceCase(n, 1, 0)] = 'B';
  const c = compter(geler(e));
  assert.equal(c.A, 2); // (0,0) et (0,1) ; (1,0) et (1,1) sont partagés
  assert.equal(c.B, 2);
});

test('fin au seuil (un seul joueur)', () => {
  const e = copier(creerEtat({ grille: 7, seuil: 10 })); // S = ⌈4,9⌉ = 5
  e.pions.A = [cr(7, 2, 2)];
  e.reserve.A = 4;
  const r = resoudreTour(geler(e), { A: deplacer(ch(7, [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]])), B: rien() });
  assert.equal(r.etat.ctrl.A, 4);
  assert.equal(r.etat.fini, false);
  const r2 = resoudreTour(r.etat, { A: deplacer(ch(7, [[2, 2], [1, 2], [1, 3], [2, 3]])), B: rien() });
  assert.ok(r2.etat.ctrl.A >= 5);
  assert.equal(r2.etat.fini, true);
  assert.equal(r2.etat.vainqueur, 'A');
  assert.equal(r2.etat.raisonFin, 'seuil');
});

test('fin après 20 tours : partie nulle à égalité parfaite', () => {
  let e = creerEtat();
  for (let t = 1; t <= 20; t++) {
    assert.equal(e.fini, false);
    assert.equal(e.tour, t);
    e = resoudreTour(e, { A: rien(), B: rien() }).etat;
  }
  assert.equal(e.fini, true);
  assert.equal(e.tour, 20);
  assert.equal(e.vainqueur, 'nul');
  assert.equal(e.raisonFin, 'tours');
  assert.equal(e.historique.length, 20);
  assert.throws(() => resoudreTour(e, {}));
});

test('fin après nbTours : départage par les cases possédées', () => {
  const e = copier(creerEtat({ nbTours: 1, comptage: 'interieur' }));
  e.proprietaires[indiceCase(n, 4, 4)] = 'A'; // 1 case, 0 croisement en « intérieur »
  const r = resoudreTour(geler(e), { A: rien(), B: rien() });
  assert.equal(r.etat.vainqueur, 'A');
});

test('IA faible : toujours légale et jamais au-delà de trajet_max sur 30 parties (7, 8, 9)', () => {
  for (let g = 1; g <= 30; g++) {
    const rng = creerRng(g);
    let e = creerEtat({ grille: [7, 8, 9][g % 3], soutien: g % 2 ? 'oui' : 'non', trajet_max: [5, 3, 'illimite', 4, 7][g % 5] });
    let tours = 0;
    while (!e.fini) {
      const oA = choisirOrdre(e, 'A', rng);
      const oB = choisirOrdre(e, 'B', rng);
      assert.ok(validerOrdre(e, 'A', oA).ok, `graine ${g} tour ${e.tour} A`);
      assert.ok(validerOrdre(e, 'B', oB).ok, `graine ${g} tour ${e.tour} B`);
      // décision Lomig 03/11 : l'IA ne dépasse jamais trajet_max.
      const max = longueurMax(e.params);
      for (const o of [oA, oB]) if (o.type === 'deplacer') assert.ok(o.chemin.length - 1 <= max, `graine ${g} : trajet de ${o.chemin.length - 1} > ${max}`);
      const r = resoudreTour(e, { A: oA, B: oB });
      assert.ok(!r.journal.some((x) => x.code === 'INVALIDE'));
      // Invariants : pas deux pions sur un croisement, réserves cohérentes.
      const tous = [...r.etat.pions.A, ...r.etat.pions.B];
      assert.equal(new Set(tous).size, tous.length);
      for (const j of ['A', 'B']) assert.equal(r.etat.pions[j].length + r.etat.reserve[j] + r.etat.retires[j], 5);
      assert.equal(r.etat.proprietaires.length, nbCases(r.etat.params.grille));
      e = r.etat;
      tours++;
    }
    assert.ok(tours <= 20);
  }
});

test('IA faible : déterministe à graine égale', () => {
  const jouer = () => {
    const rng = creerRng(42);
    let e = creerEtat();
    while (!e.fini) e = resoudreTour(e, { A: choisirOrdre(e, 'A', rng), B: choisirOrdre(e, 'B', rng) }).etat;
    return JSON.stringify(e);
  };
  assert.equal(jouer(), jouer());
});
