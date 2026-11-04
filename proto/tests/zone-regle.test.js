// Réglage `zone_regle` (Q7, demande du CDP 03/11, en attente de Lomig) : qu'est-ce qu'une zone ?
// Défaut « actuel » (dehors = plus grande région) inchangé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { creerEtat, resoudreTour, zonesDe, copier, geler, indiceCase } from '../engine/index.js';
import { etatAvec } from './aide.js';

const OPTIONS = ['actuel', 'sans_pion_adverse', 'dehors_non_possede', 'moitie_libre'];
const tailles = (zs) => zs.map((z) => z.length).sort((a, b) => a - b);
// Grille 7 (6 × 6 cases). Coin 2 × 2 en haut à gauche fermé par A ; croisement intérieur (1,1).
const COIN = [[[2, 0], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[0, 2], [1, 2], 'A'], [[1, 2], [2, 2], 'A']];
/** A possède les `nb` premières cases (ordre de lecture) qui vérifient `f(i, j)`. */
const posseder = (f, nb) => (c) => {
  let k = 0;
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) if (f(i, j) && k++ < nb) c.proprietaires[indiceCase(7, i, j)] = 'A';
};
const avec = (e, zone_regle, maj = () => {}) => {
  const c = copier(e);
  c.params = { ...c.params, zone_regle };
  maj(c);
  return geler(c);
};

test('zone_regle : le défaut reste « actuel »', () => {
  assert.equal(creerEtat({ ordres: 'joueur', ordres: 'joueur' }).params.zone_regle, 'actuel');
});

test('zone_regle : sans pion adverse, une région avec un pion adverse sur un croisement intérieur n’est pas une zone', () => {
  const dedans = etatAvec({ params: { grille: 7 }, couleurs: COIN, pions: { B: [[1, 1]] } });
  assert.deepEqual(tailles(zonesDe(avec(dedans, 'actuel'), 'A')), [4]);
  assert.deepEqual(tailles(zonesDe(avec(dedans, 'sans_pion_adverse'), 'A')), []);
  // Choix signalé : un pion adverse sur le BORD de la région (ici sur le mur de A) ne l'empêche pas.
  const bord = etatAvec({ params: { grille: 7 }, couleurs: COIN, pions: { B: [[2, 1]] } });
  assert.deepEqual(tailles(zonesDe(avec(bord, 'sans_pion_adverse'), 'A')), [4]);
  // Son propre pion à l'intérieur ne compte pas.
  const propre = etatAvec({ params: { grille: 7 }, couleurs: COIN, pions: { A: [[1, 1]] } });
  assert.deepEqual(tailles(zonesDe(avec(propre, 'sans_pion_adverse'), 'A')), [4]);
});

test('zone_regle : dehors non possédé, le dehors est la région qui a le plus de cases non possédées', () => {
  const e = etatAvec({ params: { grille: 7 }, couleurs: COIN });
  // A possède 30 des 32 cases de la grande région : il en reste 2 non possédées, contre 4 dans le coin.
  const possede = posseder((i, j) => i >= 2 || j >= 2, 30);
  assert.deepEqual(tailles(zonesDe(avec(e, 'actuel', possede), 'A')), [4]);
  assert.deepEqual(tailles(zonesDe(avec(e, 'dehors_non_possede', possede), 'A')), [32]);
  // Sans cases possédées, même résultat que « actuel ».
  assert.deepEqual(tailles(zonesDe(avec(e, 'dehors_non_possede'), 'A')), [4]);
});

test('zone_regle : moitié libre, une zone fait au plus la moitié des cases que P ne possède pas', () => {
  // Région 2 × 3 (6 cases) contre 30.
  const mur = [[[2, 0], [2, 1], 'A'], [[2, 1], [2, 2], 'A'], [[2, 2], [2, 3], 'A'], [[0, 3], [1, 3], 'A'], [[1, 3], [2, 3], 'A']];
  const e = etatAvec({ params: { grille: 7 }, couleurs: mur });
  assert.deepEqual(tailles(zonesDe(avec(e, 'moitie_libre'), 'A')), [6]); // 6 <= 36 / 2
  // A possède déjà 25 cases de la grande région : 11 non possédées, 6 > 11 / 2.
  const possede = posseder((i, j) => i >= 2 || j >= 3, 25);
  assert.deepEqual(tailles(zonesDe(avec(e, 'actuel', possede), 'A')), [6]);
  assert.deepEqual(tailles(zonesDe(avec(e, 'moitie_libre', possede), 'A')), []);
  // Exactement la moitié : 24 possédées -> 12 non possédées, 6 <= 12 / 2, c'est une zone.
  assert.deepEqual(tailles(zonesDe(avec(e, 'moitie_libre', posseder((i, j) => i >= 2 || j >= 3, 24)), 'A')), [6]);
});

test('zone_regle : partie de Lomig, tour 11 (24 cases avec « actuel », 8 avec les trois autres options)', () => {
  const L = JSON.parse(fs.readFileSync(new URL('./journaux/lomig-2026-11-03-ordres.json', import.meta.url)));
  const casesA = (e) => e.proprietaires.filter((p) => p === 'A').length;
  let e = creerEtat({ ordres: 'joueur', comptage: 'frontiere', ...L.params, ordres: 'joueur' }); // partie jouée en croisements
  for (let t = 0; t < 10; t++) e = resoudreTour(e, { A: L.ordresA[t], B: L.ordresB[t] }).etat;
  const attendu = { actuel: [24, 81], sans_pion_adverse: [8, 73], dehors_non_possede: [8, 73], moitie_libre: [8, 73] };
  for (const z of OPTIONS) {
    const r = resoudreTour(avec(e, z), { A: L.ordresA[10], B: L.ordresB[10] }).etat;
    assert.equal(casesA(r) - casesA(e), attendu[z][0], z);
    assert.equal(r.ctrl.A, attendu[z][1], z);
    assert.equal(r.vainqueur, 'A', z); // 73 >= 61 : A gagne quand même au seuil
  }
});
