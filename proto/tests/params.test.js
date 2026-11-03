import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parametresParDefaut, normaliserParametres, seuilCroisements, REGLAGES, creerEtat } from '../engine/index.js';
import { seuilScore, totalScore, uniteScore } from '../engine/params.js';

test('capture vaut « aucune » par défaut (décision CDP 03/11)', () => {
  assert.equal(parametresParDefaut().capture, 'aucune');
  assert.equal(creerEtat().params.capture, 'aucune');
});

test('valeurs par défaut de regles-proto.md §3', () => {
  const p = parametresParDefaut();
  assert.equal(p.grille, 9);
  assert.equal(p.nbPions, 5);
  assert.equal(p.nbTours, 20);
  assert.equal(p.dureeTourS, 20);
  assert.equal(p.trajet_max, 5); // décision Lomig 03/11
  assert.equal(p.soutien, 'non');
  assert.equal(p.traces, 'bord_de_zone');
  assert.equal(p.reprise, 'oui'); // décision Lomig 03/11
  assert.equal(p.seuil, 75);
  assert.equal(p.pose_coupante, 'annulee');
  assert.equal(p.trace_adverse, 'recolore');
  assert.equal(p.comptage, 'cases'); // décision Lomig 03/11 (seul défaut changé)
  assert.equal(p.repasser_croisement, 'oui');
});

test('comptage = cases par défaut, seuil 75 % : 48/64, 37/49, 27/36 (arrondi au supérieur)', () => {
  assert.equal(parametresParDefaut().comptage, 'cases');
  assert.equal(creerEtat().params.comptage, 'cases');
  const v = (grille) => { const p = normaliserParametres({ grille }); return [seuilScore(p), totalScore(p), uniteScore(p)]; };
  assert.deepEqual(v(9), [48, 64, 'cases']);
  assert.deepEqual(v(8), [37, 49, 'cases']); // 36,75 -> 37
  assert.deepEqual(v(7), [27, 36, 'cases']);
  // un 9×9 neuf : il faut 48 cases sur 64 pour gagner au seuil
  const e = creerEtat();
  assert.equal(seuilScore(e.params), 48);
});

test('seuil à 75 % en croisements (comptage = frontiere) : 61/81, 48/64, 37/49', () => {
  assert.equal(seuilCroisements(normaliserParametres({ grille: 9, comptage: 'frontiere' })), 61);
  assert.equal(seuilCroisements(normaliserParametres({ grille: 8, comptage: 'frontiere' })), 48);
  assert.equal(seuilCroisements(normaliserParametres({ grille: 7, comptage: 'frontiere' })), 37);
  assert.equal(uniteScore(normaliserParametres({ comptage: 'interieur' })), 'croisements');
});

test('valeur inconnue refusée', () => {
  assert.throws(() => normaliserParametres({ capture: 'peut-etre' }));
  assert.throws(() => normaliserParametres({ grille: 10 }));
});

test('chaque réglage a un libellé, une description et un défaut parmi ses valeurs', () => {
  for (const r of REGLAGES) {
    assert.ok(r.libelle && r.description, r.id);
    if (r.type === 'choix') assert.ok(r.valeurs.some(([v]) => v === r.defaut), r.id);
  }
});
