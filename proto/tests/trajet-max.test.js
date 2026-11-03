// décision Lomig 03/11 : un déplacement fait au plus 5 pas (5 segments) par défaut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerOrdre, deplacer, parametresParDefaut, longueurMax, resoudreTour, rien } from '../engine/index.js';
import { etatAvec, ch, cr } from './aide.js';

const n = 9;
const ligne = (k) => Array.from({ length: k + 1 }, (_, x) => [x, 0]); // k segments sur la ligne y = 0

test('trajet_max vaut 5 par défaut', () => {
  assert.equal(parametresParDefaut().trajet_max, 5);
  assert.equal(longueurMax(parametresParDefaut()), 5);
});

test('défaut : un trajet de 5 segments est valide, un de 6 est invalide', () => {
  const e = etatAvec({ pions: { A: [[0, 0]] } });
  assert.ok(validerOrdre(e, 'A', deplacer(ch(n, ligne(5)))).ok);
  const v = validerOrdre(e, 'A', deplacer(ch(n, ligne(6))));
  assert.ok(!v.ok);
  assert.match(v.raison, /max 5/);
});

test('défaut : un trajet de 6 segments donné quand même devient « rien » à la résolution', () => {
  const e = etatAvec({ pions: { A: [[0, 0]] } });
  const r = resoudreTour(e, { A: deplacer(ch(n, ligne(6))), B: rien() });
  assert.deepEqual(r.etat.pions.A, [cr(n, 0, 0)]);
  assert.ok(r.journal.some((x) => x.code === 'INVALIDE' && x.joueur === 'A'));
});

test('trajet_max = 3 : un trajet de 4 segments est invalide (3 valide)', () => {
  const e = etatAvec({ pions: { A: [[0, 0]] }, params: { trajet_max: 3 } });
  assert.ok(validerOrdre(e, 'A', deplacer(ch(n, ligne(3)))).ok);
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, ligne(4)))).ok);
});

test('trajet_max = illimité : un long trajet (24 segments) est valide', () => {
  const e = etatAvec({ pions: { A: [[0, 0]] }, params: { trajet_max: 'illimite' } });
  // Serpentin : ligne 0 vers la droite, descente, ligne 1 vers la gauche, descente, ligne 2 vers la droite.
  const pts = [];
  for (let x = 0; x <= 8; x++) pts.push([x, 0]);
  for (let x = 8; x >= 0; x--) pts.push([x, 1]);
  for (let x = 0; x <= 6; x++) pts.push([x, 2]);
  assert.equal(pts.length - 1, 24);
  assert.ok(validerOrdre(e, 'A', deplacer(ch(n, pts))).ok);
});
