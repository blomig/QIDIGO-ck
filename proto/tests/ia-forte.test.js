// IA forte : positions-pièges (non-régression), légalité, reproductibilité.
// Toutes les vérifications passent par le vrai moteur (resoudreTour).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudreTour, passer, deplacer, creerRng, indiceCase, creerEtat, validerOrdre } from '../engine/index.js';
import { choisirOrdre, ordresLegaux, POIDS_BASE, evaluer } from '../ai/ia-forte.js';
import { choisirOrdre as choisirFaible } from '../ai/ia-faible.js';
import { etatAvec, ch, cr } from './aide.js';

const n = 9;
const cases = (e, j) => e.proprietaires.filter((p) => p === j).length;
const jouer = (e, ordres) => resoudreTour(e, ordres).etat;

// Case (x, y) entourée sur 3 côtés par des traces de `j` ; il manque le côté gauche.
const troisCotes = (x, y, j) => [[[x, y], [x + 1, y], j], [[x + 1, y], [x + 1, y + 1], j], [[x, y + 1], [x + 1, y + 1], j]];

test('piège : fermer une zone en un coup', () => {
  const e = etatAvec({ pions: { A: [[4, 4]] }, couleurs: troisCotes(4, 4, 'A') });
  const o = choisirOrdre(e, 'A', creerRng(1));
  const apres = jouer(e, { A: o, B: passer() });
  assert.ok(cases(apres, 'A') >= 1, `l’IA devait fermer une zone (ordre ${JSON.stringify(o)})`);
});

test('piège : couper un trajet adverse évident', () => {
  // B ferme la case (4,4) en un segment ; A n'a que des pions en réserve et doit l'en empêcher.
  const e = etatAvec({ pions: { B: [[4, 4]] }, couleurs: troisCotes(4, 4, 'B') });
  const o = choisirOrdre(e, 'A', creerRng(2));
  const apres = jouer(e, { A: o, B: deplacer(ch(n, [[4, 4], [4, 5]])) });
  assert.equal(cases(apres, 'B'), 0, `la fermeture évidente de B devait être coupée (ordre de A ${JSON.stringify(o)})`);
});

test('piège : éviter une coupure évidente', () => {
  // A peut fermer (6,2) en 1 segment, mais le pion b en (5,3) rejoint (6,3) et coupe (rencontre).
  // A peut aussi fermer (1,6), loin de tout pion b ; B n'a plus de réserve (pas de pose possible).
  // B n'a que ce pion : sa seule réponse utile est la coupure (avec d'autres pions, sa meilleure réponse
  // serait de fermer pour lui, et un trajet coupable mais plus riche devient un choix défendable).
  const e0 = etatAvec({
    pions: { A: [[6, 2], [1, 6]], B: [[5, 3]] },
    couleurs: [...troisCotes(6, 2, 'A'), ...troisCotes(1, 6, 'A')],
  });
  const e = Object.freeze({ ...e0, reserve: Object.freeze({ A: 3, B: 0 }) });
  // la fermeture « naïve » est bien coupable
  const naive = deplacer(ch(n, [[6, 2], [6, 3]]));
  assert.equal(cases(jouer(e, { A: naive, B: deplacer(ch(n, [[5, 3], [6, 3]])) }), 'A'), 0);
  const o = choisirOrdre(e, 'A', creerRng(3));
  // l'ordre choisi gagne une case contre TOUTES les réponses légales de B
  const pire = Math.min(...ordresLegaux(e, 'B').map((r) => cases(jouer(e, { A: o, B: r }), 'A')));
  assert.ok(pire >= 1, `l’ordre ${JSON.stringify(o)} peut être coupé`);
});

test('piège : reprendre une zone (reprise = oui)', () => {
  const base = etatAvec({ pions: { A: [[4, 4]] }, couleurs: troisCotes(4, 4, 'A') });
  const e = { ...base, proprietaires: base.proprietaires.map((p, k) => (k === indiceCase(n, 4, 4) ? 'B' : p)), ctrl: { A: 0, B: 4 } };
  const o = choisirOrdre(e, 'A', creerRng(4));
  const apres = jouer(e, { A: o, B: passer() });
  assert.equal(apres.proprietaires[indiceCase(n, 4, 4)], 'A', `la case de B devait être reprise (ordre ${JSON.stringify(o)})`);
});

test('l’IA forte est reproductible (même graine, même ordre) et toujours légale', () => {
  let e = creerEtat({ grille: 7 });
  const r1 = creerRng(9), r2 = creerRng(10);
  while (!e.fini) {
    const oA = choisirOrdre(e, 'A', r1, { budget: 150 });
    assert.deepEqual(choisirOrdre(e, 'A', creerRng(5), { budget: 150 }), choisirOrdre(e, 'A', creerRng(5), { budget: 150 }));
    assert.ok(validerOrdre(e, 'A', oA).ok, JSON.stringify(oA));
    e = jouer(e, { A: oA, B: choisirFaible(e, 'B', r2) });
  }
  assert.ok(e.fini);
});

test('évaluation : symétrique et terminale', () => {
  const e = etatAvec({ pions: { A: [[4, 4]] }, couleurs: troisCotes(4, 4, 'A') });
  assert.ok(Math.abs(evaluer(e, 'A', POIDS_BASE) + evaluer(e, 'B', POIDS_BASE)) < 1e-9);
  const fin = { ...e, fini: true, vainqueur: 'A' };
  assert.ok(evaluer(fin, 'A') > 900 && evaluer(fin, 'B') < -900);
});
