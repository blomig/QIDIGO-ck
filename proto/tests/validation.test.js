import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerOrdre, poser, deplacer, rien } from '../engine/index.js';
import { etatAvec, ch, cr } from './aide.js';

const n = 9;

test('poser : croisement libre, réserve non vide', () => {
  const e = etatAvec({ pions: { A: [[1, 1]] } });
  assert.ok(validerOrdre(e, 'A', poser(cr(n, 4, 4))).ok);
  assert.ok(!validerOrdre(e, 'A', poser(cr(n, 1, 1))).ok, 'sur son propre pion');
  assert.ok(!validerOrdre(e, 'A', poser(81)).ok, 'hors grille');
  const plein = etatAvec({ pions: { A: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] } });
  assert.ok(!validerOrdre(plein, 'A', poser(cr(n, 5, 5))).ok, 'réserve vide');
});

test('déplacer : part d’un pion à soi, au moins 1 segment, le long des traits', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[6, 6]] } });
  assert.ok(validerOrdre(e, 'A', deplacer(ch(n, [[2, 2], [3, 2], [3, 3]]))).ok);
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, [[2, 2]]))).ok, '0 segment');
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, [[2, 2], [3, 3]]))).ok, 'diagonale');
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, [[2, 2], [4, 2]]))).ok, 'saut');
  assert.ok(!validerOrdre(e, 'B', deplacer(ch(n, [[2, 2], [3, 2]]))).ok, 'pion adverse');
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, [[8, 0], [0, 1]]))).ok, 'pas de pion au départ');
});

test('déplacer : jamais deux fois le même segment ; boucle par le départ permise', () => {
  const e = etatAvec({ pions: { A: [[2, 2]] } });
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, [[2, 2], [3, 2], [2, 2]]))).ok, 'aller-retour sur un segment');
  const boucle = ch(n, [[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]);
  assert.ok(validerOrdre(e, 'A', deplacer(boucle)).ok);
  const e2 = etatAvec({ pions: { A: [[2, 2]] }, params: { repasser_croisement: 'non' } });
  assert.ok(!validerOrdre(e2, 'A', deplacer(boucle)).ok, 'réglage repasser = non');
});

test('déplacer : un autre pion allié est infranchissable', () => {
  const e = etatAvec({ pions: { A: [[2, 2], [3, 2]] } });
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, [[2, 2], [3, 2], [4, 2]]))).ok);
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, [[2, 2], [3, 2]]))).ok);
});

test('déplacer : croisement de pion adverse accepté à la validation (tranché à la résolution, CDP 03/11)', () => {
  const e = etatAvec({ pions: { A: [[2, 2]], B: [[3, 2]] } });
  assert.ok(validerOrdre(e, 'A', deplacer(ch(n, [[2, 2], [3, 2]]))).ok);
});

test('trajet_max : 3 segments', () => {
  const e = etatAvec({ pions: { A: [[0, 0]] }, params: { trajet_max: 3 } });
  assert.ok(validerOrdre(e, 'A', deplacer(ch(n, [[0, 0], [1, 0], [2, 0], [3, 0]]))).ok);
  assert.ok(!validerOrdre(e, 'A', deplacer(ch(n, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]))).ok);
});

test('soutien : ignoré s’il n’est pas adjacent au départ', () => {
  const e = etatAvec({ pions: { A: [[2, 2], [2, 3], [6, 6]] }, params: { soutien: 'oui' } });
  const t = ch(n, [[2, 2], [3, 2]]);
  assert.equal(validerOrdre(e, 'A', deplacer(t, cr(n, 2, 3))).ordre.soutien, cr(n, 2, 3));
  const v = validerOrdre(e, 'A', deplacer(t, cr(n, 6, 6)));
  assert.ok(v.ok);
  assert.equal(v.ordre.soutien, undefined);
});

test('rien est toujours valide', () => {
  assert.ok(validerOrdre(etatAvec(), 'A', rien()).ok);
  assert.ok(validerOrdre(etatAvec(), 'A', null).ok);
});
