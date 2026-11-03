// « Passer » (choix proto CDP 03/11) et décompte des croisements contrôlés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resoudreTour, validerOrdre, passer, poser, deplacer, creerEtat as creerEtatBase, copier, geler, indiceCase, indice,
  croisementsControles, compter, seuilCroisements,
} from '../engine/index.js';
import { etatAvec as etatAvecBase, ch, cr, codes } from './aide.js';

// Comptage en cases par défaut depuis la décision Lomig du 03/11 : ces tests vérifient le décompte des
// CROISEMENTS (regles-proto.md), on les épingle donc à comptage = frontiere. Variante en cases à la fin.
const etatAvec = (o = {}) => etatAvecBase({ ...o, params: { comptage: 'frontiere', ...(o.params || {}) } });
const creerEtat = (p = {}) => creerEtatBase({ comptage: 'frontiere', ...p });

const n = 9;

test('Passer : ordre valide, ne fait rien, journalisé', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  assert.deepEqual(validerOrdre(e, 'A', passer()), { ok: true, ordre: { type: 'passer' } });
  const r = resoudreTour(e, { A: passer(), B: passer() });
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 2)]);
  assert.equal(codes(r.journal).filter((c) => c === 'PASSE').length, 2);
  assert.ok(!codes(r.journal).includes('INVALIDE'));
  assert.equal(r.etat.tour, 2);
});

test('Passer ne coupe rien : le trajet adverse aboutit', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: passer() });
  assert.deepEqual(r.etat.pions.A, [cr(n, 3, 2)]);
});

test('Passer ne libère pas de croisement : une arrivée sur un pion qui passe est annulée', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[2, 2], [3, 2]])), B: passer() });
  assert.deepEqual(r.etat.pions.A, [cr(n, 2, 2)]);
});

test('Ordre absent (chrono) : traité comme ne rien faire', () => {
  const r = resoudreTour(etatAvec(), { A: poser(cr(n, 4, 4)) });
  assert.deepEqual(r.etat.pions.A, [cr(n, 4, 4)]);
});

test('Décompte : une case seule vaut 4 croisements, deux cases voisines 6', () => {
  const e = copier(creerEtat());
  e.proprietaires[indiceCase(n, 4, 4)] = 'A';
  assert.equal(compter(geler(copier(e))).A, 4);
  e.proprietaires[indiceCase(n, 5, 4)] = 'A';
  const c = croisementsControles(geler(e));
  assert.equal(c.A.length, 6);
  assert.ok(c.A.includes(indice(n, 5, 5)));
  assert.equal(c.B.length, 0);
});

test('Décompte : toute la grille possédée = 81 croisements, au-dessus du seuil de 61', () => {
  const e = copier(creerEtat());
  e.proprietaires.fill('A');
  const c = compter(geler(e));
  assert.equal(c.A, 81);
  assert.ok(c.A >= seuilCroisements(e.params));
});

test('Décompte : coin -> 1 case suffit au coin, frontière commune exclue', () => {
  const e = copier(creerEtat());
  e.proprietaires[indiceCase(n, 0, 0)] = 'A';
  e.proprietaires[indiceCase(n, 0, 1)] = 'B';
  const c = croisementsControles(geler(e));
  // A : (0,0), (1,0) ; frontière (0,1), (1,1) partagée ; B : (0,2), (1,2).
  assert.deepEqual(c.A.sort((a, b) => a - b), [indice(n, 0, 0), indice(n, 1, 0)]);
  assert.deepEqual(c.B.sort((a, b) => a - b), [indice(n, 0, 2), indice(n, 1, 2)]);
});

test('ctrl est mis à jour après chaque tour (étape 8)', () => {
  const e = etatAvec({ pions: { A: [[4, 4]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, [[4, 4], [5, 4], [5, 5], [4, 5], [4, 4]])), B: passer() });
  assert.deepEqual(r.etat.ctrl, { A: 4, B: 0 });
});

test('comptage = cases (défaut) : ctrl compte les cases possédées, grille pleine = 64 >= 48', () => {
  const e = etatAvecBase({ pions: { A: [[4, 4]] } });
  assert.equal(e.params.comptage, 'cases');
  const r = resoudreTour(e, { A: deplacer(ch(n, [[4, 4], [5, 4], [5, 5], [4, 5], [4, 4]])), B: passer() });
  assert.deepEqual(r.etat.ctrl, { A: 1, B: 0 });
  const p = copier(creerEtatBase());
  p.proprietaires.fill('A');
  assert.equal(compter(geler(p)).A, 64);
  assert.equal(seuilCroisements(p.params), 48);
});
