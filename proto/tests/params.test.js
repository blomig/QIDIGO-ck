import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parametresParDefaut, normaliserParametres, seuilCroisements, REGLAGES, creerEtat } from '../engine/index.js';

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
  assert.equal(p.comptage, 'frontiere');
  assert.equal(p.repasser_croisement, 'oui');
});

test('seuil à 75 % : 61/81, 48/64, 37/49', () => {
  assert.equal(seuilCroisements(normaliserParametres({ grille: 9 })), 61);
  assert.equal(seuilCroisements(normaliserParametres({ grille: 8 })), 48);
  assert.equal(seuilCroisements(normaliserParametres({ grille: 7 })), 37);
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
