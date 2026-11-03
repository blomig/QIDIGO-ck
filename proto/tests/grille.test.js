import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nbCroisements, coord, indice, voisins, sontAdjacents, cleSegment, segmentsDuChemin,
  estSurBord, cheminDroit, composantesConnexes,
} from '../engine/grille.js';

test('nombre de croisements : 49, 64, 81', () => {
  assert.equal(nbCroisements(7), 49);
  assert.equal(nbCroisements(8), 64);
  assert.equal(nbCroisements(9), 81);
});

test('indice et coordonnées sont réciproques', () => {
  for (const n of [7, 8, 9]) {
    for (let i = 0; i < n * n; i++) {
      const { x, y } = coord(n, i);
      assert.equal(indice(n, x, y), i);
    }
  }
  assert.equal(indice(9, 9, 0), -1);
  assert.equal(indice(9, -1, 3), -1);
});

test('voisins orthogonaux : coin 2, bord 3, centre 4', () => {
  assert.equal(voisins(9, indice(9, 0, 0)).length, 2);
  assert.equal(voisins(9, indice(9, 4, 0)).length, 3);
  assert.equal(voisins(9, indice(9, 4, 4)).length, 4);
  assert.deepEqual(voisins(9, indice(9, 4, 4)).sort((a, b) => a - b), [31, 39, 41, 49]);
});

test('adjacence : pas de diagonale, pas de saut de ligne', () => {
  assert.ok(sontAdjacents(9, indice(9, 2, 2), indice(9, 3, 2)));
  assert.ok(!sontAdjacents(9, indice(9, 2, 2), indice(9, 3, 3)));
  assert.ok(!sontAdjacents(9, indice(9, 8, 0), indice(9, 0, 1))); // 8 et 9 consécutifs mais pas voisins
  assert.ok(!sontAdjacents(9, 0, 0));
});

test('segments : clé indépendante du sens', () => {
  assert.equal(cleSegment(3, 4), cleSegment(4, 3));
  assert.deepEqual(segmentsDuChemin([0, 1, 10]), ['0-1', '1-10']);
});

test('bord et chemin droit', () => {
  assert.ok(estSurBord(9, indice(9, 0, 5)));
  assert.ok(!estSurBord(9, indice(9, 4, 4)));
  assert.deepEqual(cheminDroit(9, indice(9, 1, 1), indice(9, 4, 1)), [indice(9, 2, 1), indice(9, 3, 1), indice(9, 4, 1)]);
  assert.equal(cheminDroit(9, indice(9, 1, 1), indice(9, 2, 2)), null);
});

test('composantes connexes : une colonne coupe la grille en deux', () => {
  const n = 7;
  const comps = composantesConnexes(n, (i) => coord(n, i).x !== 2);
  assert.equal(comps.length, 2);
  assert.deepEqual(comps.map((c) => c.length).sort((a, b) => a - b), [14, 28]);
});

import { nbCases, cotesCase, casesAutourCroisement, indiceCase, estSegmentDuBord, cleSegment as cs } from '../engine/grille.js';

test('cases : (N−1)² cases, côtés et voisines', () => {
  assert.equal(nbCases(9), 64);
  assert.equal(nbCases(7), 36);
  const k = indiceCase(9, 0, 0);
  const cotes = cotesCase(9, k);
  assert.equal(cotes.filter((c) => c.voisine === -1).length, 2); // coin : haut et gauche sur le bord
  assert.equal(cotes[1].segment, cs(indice(9, 1, 0), indice(9, 1, 1))); // côté droit
});

test('cases autour d’un croisement : 1 au coin, 2 au bord, 4 au centre', () => {
  assert.equal(casesAutourCroisement(9, indice(9, 0, 0)).length, 1);
  assert.equal(casesAutourCroisement(9, indice(9, 3, 0)).length, 2);
  assert.equal(casesAutourCroisement(9, indice(9, 3, 3)).length, 4);
});

test('segments du bord', () => {
  assert.ok(estSegmentDuBord(9, cs(indice(9, 0, 0), indice(9, 1, 0))));
  assert.ok(estSegmentDuBord(9, cs(indice(9, 8, 3), indice(9, 8, 4))));
  assert.ok(!estSegmentDuBord(9, cs(indice(9, 1, 1), indice(9, 2, 1))));
});
